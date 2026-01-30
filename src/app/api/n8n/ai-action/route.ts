import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

/**
 * POST /api/n8n/ai-action
 *
 * Called by n8n to execute an AI-powered action step.
 * Uses Gemini to process the step according to the blueprint constraints.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workflowId,
      executionId,
      stepId,
      stepLabel,
      blueprint,
      input,
      workerName,
      guidanceContext,
    } = body

    if (!workflowId || !stepId) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId and stepId' },
        { status: 400 }
      )
    }

    // Parse blueprint
    let blueprintData = { greenList: [], redList: [] }
    try {
      blueprintData = typeof blueprint === 'string' ? JSON.parse(blueprint) : blueprint || blueprintData
    } catch {
      console.warn('Failed to parse blueprint, using defaults')
    }

    // Parse input data
    let inputData = {}
    try {
      inputData = typeof input === 'string' ? JSON.parse(input) : input || {}
    } catch {
      console.warn('Failed to parse input, using empty object')
    }

    const supabase = await createClient()

    // Log step execution start
    await supabase.from('activity_logs').insert({
      type: 'workflow_step_execution',
      worker_name: workerName,
      workflow_id: workflowId,
      data: {
        stepId,
        stepLabel,
        message: `Executing AI action: ${stepLabel}`,
      },
    })

    // Build the prompt for Gemini
    const systemPrompt = buildSystemPrompt(stepLabel, blueprintData, guidanceContext)
    const userPrompt = buildUserPrompt(inputData)

    // Call Gemini API
    const geminiResponse = await callGemini(systemPrompt, userPrompt)

    if (geminiResponse.needsGuidance) {
      // Agent is uncertain, request human guidance
      return NextResponse.json({
        success: false,
        needsGuidance: true,
        guidanceQuestion: geminiResponse.guidanceQuestion,
        partialResult: geminiResponse.partialResult,
        message: 'AI agent requires guidance to proceed',
      })
    }

    // Log successful execution
    await supabase.from('activity_logs').insert({
      type: 'workflow_step_complete',
      worker_name: workerName,
      workflow_id: workflowId,
      data: {
        stepId,
        stepLabel,
        result: geminiResponse.result,
        message: `AI action completed: ${stepLabel}`,
      },
    })

    return NextResponse.json({
      success: true,
      result: geminiResponse.result,
      actions: geminiResponse.actions,
      message: geminiResponse.message,
    })
  } catch (error) {
    console.error('Error in ai-action:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

function buildSystemPrompt(
  stepLabel: string,
  blueprint: { greenList: string[]; redList: string[] },
  guidanceContext?: string
): string {
  let prompt = `You are an AI agent executing a workflow step: "${stepLabel}".

## Your Capabilities (Allowed Actions):
${blueprint.greenList.length > 0 ? blueprint.greenList.map(item => `- ${item}`).join('\n') : '- General task execution'}

## Hard Limits (NEVER do these):
${blueprint.redList.length > 0 ? blueprint.redList.map(item => `- ${item}`).join('\n') : '- No specific restrictions'}

## Response Format:
Respond with a JSON object containing:
{
  "result": <the output of your action>,
  "actions": [<list of actions taken>],
  "message": "<brief summary of what was done>",
  "needsGuidance": false
}

If you are uncertain or need human input, respond with:
{
  "needsGuidance": true,
  "guidanceQuestion": "<your specific question>",
  "partialResult": <any partial work completed>
}
`

  if (guidanceContext) {
    prompt += `\n## Previous Guidance from Manager:\n${guidanceContext}\n`
  }

  return prompt
}

function buildUserPrompt(inputData: Record<string, unknown>): string {
  return `Execute the task with the following input data:

${JSON.stringify(inputData, null, 2)}

Perform the required action and return the result in the specified JSON format.`
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<{
  result?: unknown
  actions?: string[]
  message?: string
  needsGuidance?: boolean
  guidanceQuestion?: string
  partialResult?: unknown
}> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

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
          temperature: 0.7,
          maxOutputTokens: 4096,
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
    // If response isn't valid JSON, wrap it
    return {
      result: content,
      actions: ['processed'],
      message: 'Action completed',
      needsGuidance: false,
    }
  }
}
