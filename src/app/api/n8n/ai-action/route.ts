import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

// Retry configuration for Gemini API
const MAX_RETRIES = 3
const INITIAL_DELAY_MS = 1000
const MAX_DELAY_MS = 10000

// Error types for classification
type ErrorType = 'validation' | 'configuration' | 'rate_limit' | 'transient' | 'permanent' | 'unknown'

interface ClassifiedError {
  type: ErrorType
  message: string
  retryable: boolean
  statusCode: number
  details?: string
}

/**
 * Classify an error for appropriate handling
 */
function classifyError(error: unknown, context?: string): ClassifiedError {
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Configuration errors
  if (errorMessage.includes('API_KEY') || errorMessage.includes('not configured')) {
    return {
      type: 'configuration',
      message: 'AI service not properly configured',
      retryable: false,
      statusCode: 503,
      details: context,
    }
  }

  // Rate limiting
  if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
    return {
      type: 'rate_limit',
      message: 'AI service rate limited. Please try again later.',
      retryable: true,
      statusCode: 429,
      details: context,
    }
  }

  // Transient errors (5xx, network issues)
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('504') ||
    errorMessage.includes('network') ||
    errorMessage.includes('ECONNREFUSED')
  ) {
    return {
      type: 'transient',
      message: 'Temporary service issue. The system will retry automatically.',
      retryable: true,
      statusCode: 503,
      details: context,
    }
  }

  // Validation errors (4xx except rate limit)
  if (errorMessage.includes('400') || errorMessage.includes('invalid')) {
    return {
      type: 'validation',
      message: 'Invalid request to AI service',
      retryable: false,
      statusCode: 400,
      details: context,
    }
  }

  // Default to unknown
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retryable: false,
    statusCode: 500,
    details: errorMessage,
  }
}

/**
 * Sleep for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate backoff delay with jitter
 */
function calculateBackoff(attempt: number): number {
  const exponential = INITIAL_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponential
  return Math.min(exponential + jitter, MAX_DELAY_MS)
}

/**
 * POST /api/n8n/ai-action
 *
 * Called by n8n to execute an AI-powered action step.
 * Uses Gemini to process the step according to the blueprint constraints.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  const supabase = await createClient()

  try {
    body = await request.json()
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
      logger.warn('Failed to parse blueprint, using defaults')
    }

    // Parse input data
    let inputData = {}
    try {
      inputData = typeof input === 'string' ? JSON.parse(input) : input || {}
    } catch {
      logger.warn('Failed to parse input, using empty object')
    }

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
    const systemPrompt = buildSystemPrompt(stepLabel as string, blueprintData, guidanceContext as string | undefined)
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
    logger.error('Error in ai-action:', error)

    // Classify the error for appropriate response
    const classified = classifyError(error, `Step: ${body?.stepLabel || 'unknown'}`)

    // Log detailed error for debugging
    // Log error - don't await to avoid blocking
    void supabase.from('activity_logs').insert({
      type: 'workflow_step_error',
      worker_name: body?.workerName,
      workflow_id: body?.workflowId,
      data: {
        stepId: body?.stepId,
        stepLabel: body?.stepLabel,
        errorType: classified.type,
        errorMessage: classified.message,
        retryable: classified.retryable,
      },
    }) // Fire and forget

    return NextResponse.json(
      {
        error: classified.message,
        errorType: classified.type,
        retryable: classified.retryable,
        details: classified.details,
      },
      { status: classified.statusCode }
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

  let lastError: Error | null = null

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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
        const errorText = await response.text()
        const error = new Error(`Gemini API error: ${response.status} - ${errorText}`)

        // Check if error is retryable
        const isRetryable = response.status >= 500 || response.status === 429

        if (isRetryable && attempt < MAX_RETRIES) {
          lastError = error
          const delay = calculateBackoff(attempt)
          logger.warn(`Gemini API error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`, {
            status: response.status,
          })
          await sleep(delay)
          continue
        }

        throw error
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
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (attempt < MAX_RETRIES) {
          lastError = error
          const delay = calculateBackoff(attempt)
          logger.warn(`Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`)
          await sleep(delay)
          continue
        }
      }

      // Non-retryable error or max retries reached
      throw error
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('Gemini request failed after all retries')
}
