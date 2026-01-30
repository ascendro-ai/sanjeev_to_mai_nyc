import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getModel } from '@/lib/gemini/server'
import type { ConversationMessage, Workflow, WorkflowStep } from '@/types'

/**
 * POST /api/gemini/extract
 *
 * Extracts a workflow definition from a conversation.
 * Called in the background as the user chats with the consultant.
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
    const { messages, existingWorkflowId } = body as {
      messages: ConversationMessage[]
      existingWorkflowId?: string
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid messages array' },
        { status: 400 }
      )
    }

    const model = getModel()

    const conversationText = messages
      .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n')

    const prompt = `You are a Workflow Visualization Agent. Analyze the following conversation and extract a complete workflow definition.

CRITICAL EXTRACTION RULES:
- Extract ALL sequential steps mentioned (don't skip any)
- Maintain chronological order exactly as discussed
- Extract verbatim when possible, infer logically when needed
- Look for patterns: "first... then... then... finally..." or "step 1, step 2, step 3"
- Each step should be a distinct action or event

STEP CLASSIFICATION RULES:
- Trigger: Event that starts the workflow (e.g., "Email received", "Form submitted", "Customer inquiry")
- Action: Specific action to perform (e.g., "Send reply", "Update Excel", "Generate PDF", "Notify worker")
- Decision: Conditional branch point (e.g., "If negative review", "If price > threshold", "Check if approved")
- End: Final completion step (e.g., "Email sent to customer", "Quote delivered", "Task completed")

AUTO-ASSIGNMENT LOGIC:
- If conversation mentions "worker", "staff", "person", "human", "someone", "employee" doing a step → assignedTo.type = "human"
- If conversation mentions "my worker", "the worker", "worker does", "worker handles" → assignedTo.type = "human"
- If step explicitly mentions a person doing it → assignedTo.type = "human"
- If conversation mentions automation/AI/agent explicitly → assignedTo.type = "ai" with descriptive agentName
- If step involves email, Excel, PDF, calculations, data processing AND no human mentioned → default to "ai"
- If step involves review, approval, decision-making, consultation, manual work → default to "human"
- If unclear → default to "ai" for automatable steps

Return ONLY a valid JSON object (no markdown, no code blocks, just JSON):
{
  "workflowName": "Descriptive workflow name",
  "description": "Brief description of what this workflow does",
  "steps": [
    {
      "id": "step-1",
      "label": "Verbose step description",
      "type": "trigger|action|decision|end",
      "order": 0,
      "assignedTo": {
        "type": "ai|human",
        "agentName": "Descriptive agent name (if AI)"
      }
    }
  ]
}

IMPORTANT:
- Always return a valid JSON object, even if workflow is incomplete
- Create at least 2-3 steps based on what was discussed
- Use "trigger" for the first step, "action" for middle steps, "end" for the last step
- Order should start at 0 and increment sequentially

Conversation:
${conversationText}`

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to extract workflow - no valid JSON in response' },
        { status: 500 }
      )
    }

    const workflowData = JSON.parse(jsonMatch[0])

    // Generate IDs for steps if not provided
    const steps: WorkflowStep[] = workflowData.steps.map((step: Record<string, unknown>, index: number) => ({
      id: (step.id as string) || `step-${index + 1}`,
      label: step.label as string,
      type: (step.type as WorkflowStep['type']) || 'action',
      order: step.order !== undefined ? (step.order as number) : index,
      assignedTo: step.assignedTo || undefined,
    }))

    // Ensure at least one step
    if (steps.length === 0) {
      return NextResponse.json(
        { error: 'No workflow steps could be extracted' },
        { status: 400 }
      )
    }

    const workflow: Partial<Workflow> = {
      id: existingWorkflowId || undefined,
      name: workflowData.workflowName || workflowData.name || 'Untitled Workflow',
      description: workflowData.description,
      steps,
      status: 'draft',
    }

    return NextResponse.json({
      workflow,
      success: true,
    })
  } catch (error) {
    logger.error('Error in extract:', error)
    return NextResponse.json(
      { error: 'Failed to extract workflow', details: String(error) },
      { status: 500 }
    )
  }
}
