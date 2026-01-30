import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getModel } from '@/lib/gemini/server'
import type { Workflow, AgentConfiguration } from '@/types'

/**
 * POST /api/gemini/build-agents
 *
 * Intelligently groups workflow steps into shared AI agents.
 * Called when activating a digital worker to run a workflow.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { workflow, digitalWorkerName } = body as {
      workflow: Workflow
      digitalWorkerName?: string
    }

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid workflow data' },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    const workerName = digitalWorkerName || workflow.assignedTo?.stakeholderName || 'default'

    // Log agent building start
    await supabase.from('activity_logs').insert({
      type: 'agent_building_start',
      worker_name: workerName,
      workflow_id: workflow.id,
      data: {
        message: `Starting to build agents for workflow "${workflow.name}"`,
        stepCount: workflow.steps.length,
      },
    })

    const model = getModel()

    const workflowInfo = {
      name: workflow.name,
      steps: workflow.steps.map((step) => ({
        id: step.id,
        label: step.label,
        type: step.type,
        requirements: step.requirements,
      })),
    }

    const prompt = `Analyze this workflow and intelligently group steps into shared AI agents.
Group steps that:
- Share similar integrations (e.g., Gmail)
- Have related actions
- Can be efficiently handled by the same agent

Return ONLY a valid JSON array of agent configurations:
[
  {
    "name": "Agent name",
    "stepIds": ["step1", "step2"],
    "blueprint": {
      "greenList": ["allowed actions"],
      "redList": ["forbidden actions"]
    },
    "integrations": {
      "gmail": true/false
    }
  }
]

Workflow:
${JSON.stringify(workflowInfo, null, 2)}`

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Failed to parse agent configurations')
    }

    const agentDataArray = JSON.parse(jsonMatch[0])

    const agents: AgentConfiguration[] = agentDataArray.map(
      (agentData: {
        name?: string
        stepIds: string[]
        blueprint?: { greenList: string[]; redList: string[] }
        integrations?: { gmail?: boolean }
      }, index: number) => {
        const primaryStepId = agentData.stepIds[0]

        return {
          id: `agent-${Date.now()}-${index}`,
          name: agentData.name || `Agent ${index + 1}`,
          stepId: primaryStepId,
          workflowId: workflow.id,
          blueprint: agentData.blueprint || { greenList: [], redList: [] },
          integrations: agentData.integrations || {},
          status: 'configured' as const,
          createdAt: new Date(),
        }
      }
    )

    const duration = Date.now() - startTime

    // Log agent building complete
    await supabase.from('activity_logs').insert({
      type: 'agent_building_complete',
      worker_name: workerName,
      workflow_id: workflow.id,
      data: {
        message: `Successfully built ${agents.length} agents for workflow "${workflow.name}"`,
        agentCount: agents.length,
        agentNames: agents.map((a) => a.name),
        durationMs: duration,
      },
    })

    return NextResponse.json({
      agents,
      success: true,
      duration,
    })
  } catch (error) {
    logger.error('Error in build-agents:', error)
    return NextResponse.json(
      { error: 'Failed to build agents', details: String(error) },
      { status: 500 }
    )
  }
}
