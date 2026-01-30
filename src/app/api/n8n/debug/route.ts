import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

interface DebugAnalysis {
  summary: string
  rootCause: string
  affectedStep: string
  suggestedFixes: string[]
  preventionTips: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'configuration' | 'data' | 'integration' | 'logic' | 'timeout' | 'permission' | 'unknown'
}

/**
 * POST /api/n8n/debug
 *
 * Analyze a failed workflow execution using AI to identify root cause
 * and suggest fixes.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { executionId, workflowId } = body

    if (!executionId && !workflowId) {
      return NextResponse.json(
        { error: 'Either executionId or workflowId is required' },
        { status: 400 }
      )
    }

    // Fetch execution data
    let executionData
    if (executionId) {
      const { data, error } = await supabase
        .from('executions')
        .select('*, workflow:workflows(*)')
        .eq('id', executionId)
        .single()

      if (error) throw error
      executionData = data
    } else {
      // Get most recent failed execution for the workflow
      const { data, error } = await supabase
        .from('executions')
        .select('*, workflow:workflows(*)')
        .eq('workflow_id', workflowId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      executionData = data
    }

    if (!executionData) {
      return NextResponse.json(
        { error: 'No execution found' },
        { status: 404 }
      )
    }

    // Fetch execution steps/logs
    const { data: executionSteps } = await supabase
      .from('execution_steps')
      .select('*')
      .eq('execution_id', executionData.id)
      .order('created_at', { ascending: true })

    // Fetch activity logs for this execution
    const { data: activityLogs } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('data->>executionId', executionData.id)
      .order('created_at', { ascending: true })
      .limit(50)

    // Build context for AI analysis
    const analysisContext = {
      workflow: {
        name: executionData.workflow?.name,
        steps: executionData.workflow?.steps,
      },
      execution: {
        id: executionData.id,
        status: executionData.status,
        startedAt: executionData.started_at,
        completedAt: executionData.completed_at,
        error: executionData.error,
        currentStepIndex: executionData.current_step_index,
      },
      steps: executionSteps?.map((step) => ({
        stepIndex: step.step_index,
        stepName: step.step_name,
        status: step.status,
        error: step.error,
        inputData: step.input_data,
        outputData: step.output_data,
      })),
      logs: activityLogs?.map((log) => ({
        type: log.type,
        data: log.data,
        createdAt: log.created_at,
      })),
    }

    // Call Gemini for analysis
    const analysis = await analyzeWithGemini(analysisContext)

    // Log the debug analysis
    await supabase.from('activity_logs').insert({
      type: 'debug_analysis',
      workflow_id: executionData.workflow_id,
      data: {
        executionId: executionData.id,
        analysis,
      },
    })

    return NextResponse.json({
      executionId: executionData.id,
      workflowName: executionData.workflow?.name,
      analysis,
    })
  } catch (error) {
    logger.error('Error in debug analysis:', error)
    return NextResponse.json(
      { error: 'Failed to analyze execution' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/n8n/debug
 *
 * Get debug analysis history for a workflow
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      )
    }

    // Fetch recent debug analyses
    const { data: analyses, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('type', 'debug_analysis')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error

    return NextResponse.json({
      analyses: analyses?.map((a) => ({
        id: a.id,
        executionId: a.data?.executionId,
        analysis: a.data?.analysis,
        createdAt: a.created_at,
      })),
    })
  } catch (error) {
    logger.error('Error fetching debug history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debug history' },
      { status: 500 }
    )
  }
}

async function analyzeWithGemini(context: unknown): Promise<DebugAnalysis> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  const systemPrompt = `You are an expert workflow debugger. Analyze the following failed workflow execution and provide a detailed diagnosis.

Your response MUST be a valid JSON object with this exact structure:
{
  "summary": "Brief 1-2 sentence summary of what went wrong",
  "rootCause": "Detailed explanation of the root cause",
  "affectedStep": "Name or index of the step that failed",
  "suggestedFixes": ["Fix 1", "Fix 2", "Fix 3"],
  "preventionTips": ["Tip 1", "Tip 2"],
  "severity": "low|medium|high|critical",
  "category": "configuration|data|integration|logic|timeout|permission|unknown"
}

Analyze the execution context, identify patterns, and provide actionable recommendations.`

  const userPrompt = `Analyze this failed workflow execution:

${JSON.stringify(context, null, 2)}

Provide your analysis as JSON.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content) {
    throw new Error('No content in Gemini response')
  }

  try {
    return JSON.parse(content)
  } catch {
    // If parsing fails, return a generic analysis
    return {
      summary: 'Unable to parse AI analysis',
      rootCause: content,
      affectedStep: 'Unknown',
      suggestedFixes: ['Review execution logs manually', 'Check workflow configuration'],
      preventionTips: ['Add error handling to workflow steps'],
      severity: 'medium',
      category: 'unknown',
    }
  }
}
