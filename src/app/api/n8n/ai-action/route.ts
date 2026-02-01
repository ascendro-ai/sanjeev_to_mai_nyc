/**
 * @fileoverview API endpoint for AI-powered workflow step execution.
 *
 * This endpoint is called by n8n when a workflow reaches an AI Agent node.
 * It uses Google Gemini to process the step according to the workflow's
 * blueprint constraints (greenList/redList), returning the action result
 * or requesting human guidance when uncertain.
 *
 * AI Agent Capabilities:
 * - Executes actions within defined greenList permissions
 * - Refuses actions on redList (hard limits)
 * - Requests human guidance when uncertain
 * - Filters PII before sending data to Gemini
 *
 * Guidance Flow:
 * 1. AI encounters uncertain situation
 * 2. Returns `needsGuidance: true` with question
 * 3. n8n creates review request for human manager
 * 4. Human provides guidance
 * 5. n8n retries with `guidanceContext` parameter
 *
 * Error Handling:
 * - Exponential backoff with jitter for retries
 * - Error classification (transient vs permanent)
 * - Structured error responses for n8n decision nodes
 *
 * @module api/n8n/ai-action
 *
 * @example
 * ```typescript
 * // From n8n HTTP Request node:
 * // POST https://yourapp.com/api/n8n/ai-action
 * {
 *   "workflowId": "workflow-uuid",
 *   "executionId": "n8n-exec-123",
 *   "stepId": "step-2",
 *   "stepLabel": "Categorize email",
 *   "workerName": "Email Categorizer",
 *   "blueprint": {
 *     "greenList": ["read emails", "categorize content", "apply labels"],
 *     "redList": ["delete emails", "forward externally"]
 *   },
 *   "input": {
 *     "subject": "Q4 Report",
 *     "from": "manager@company.com",
 *     "body": "Please review the attached quarterly report..."
 *   }
 * }
 * ```
 */

import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { filterPII, warnIfSensitiveData } from '@/lib/pii-filter'

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Gemini API key for AI processing.
 * Required for this endpoint to function.
 */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

/**
 * Gemini model to use for AI actions.
 * @default 'gemini-2.0-flash'
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

// -----------------------------------------------------------------------------
// Retry Configuration
// -----------------------------------------------------------------------------

/**
 * Maximum number of retry attempts for transient failures.
 * After this many failures, the error is considered permanent.
 */
const MAX_RETRIES = 3

/**
 * Initial delay in milliseconds before first retry.
 * Subsequent retries use exponential backoff.
 */
const INITIAL_DELAY_MS = 1000

/**
 * Maximum delay in milliseconds between retries.
 * Caps exponential backoff to prevent extremely long waits.
 */
const MAX_DELAY_MS = 10000

// -----------------------------------------------------------------------------
// Error Classification Types
// -----------------------------------------------------------------------------

/**
 * Categories of errors for appropriate handling.
 */
type ErrorType = 'validation' | 'configuration' | 'rate_limit' | 'transient' | 'permanent' | 'unknown'

/**
 * Structured error information for consistent error handling.
 */
interface ClassifiedError {
  /** Error category for routing/handling */
  type: ErrorType
  /** User-friendly error message */
  message: string
  /** Whether the operation should be retried */
  retryable: boolean
  /** HTTP status code to return */
  statusCode: number
  /** Additional context for debugging */
  details?: string
}

// -----------------------------------------------------------------------------
// Request/Response Types
// -----------------------------------------------------------------------------

/**
 * Request body for AI action execution.
 */
interface AIActionRequest {
  /** Our workflow UUID */
  workflowId: string
  /** n8n execution ID */
  executionId?: string
  /** Step identifier within the workflow */
  stepId: string
  /** Human-readable step label */
  stepLabel?: string
  /** AI agent blueprint with permissions */
  blueprint?: string | { greenList: string[]; redList: string[] }
  /** Input data for this step */
  input?: string | Record<string, unknown>
  /** Digital worker name executing this step */
  workerName?: string
  /** Previous human guidance (if retrying after guidance request) */
  guidanceContext?: string
}

/**
 * Response from AI action execution.
 */
interface AIActionResponse {
  /** Whether the action completed successfully */
  success: boolean
  /** Action result data */
  result?: unknown
  /** List of actions taken by the AI */
  actions?: string[]
  /** Human-readable summary */
  message?: string
  /** True if AI needs human guidance to proceed */
  needsGuidance?: boolean
  /** Question for the human manager */
  guidanceQuestion?: string
  /** Partial work completed before needing guidance */
  partialResult?: unknown
  /** Error information if success is false */
  error?: string
  errorType?: ErrorType
  retryable?: boolean
  details?: string
}

// -----------------------------------------------------------------------------
// Error Classification
// -----------------------------------------------------------------------------

/**
 * Classifies an error for appropriate handling and response.
 *
 * Error categories:
 * - validation: Bad request (4xx except rate limit)
 * - configuration: Missing API keys or setup issues
 * - rate_limit: Gemini API quota exceeded
 * - transient: Temporary issues (5xx, network errors)
 * - permanent: Non-recoverable errors
 * - unknown: Unclassified errors
 *
 * @param error - The error to classify
 * @param context - Additional context for logging
 * @returns Structured error information
 *
 * @example
 * ```typescript
 * try {
 *   await callGemini(...)
 * } catch (error) {
 *   const classified = classifyError(error, 'Step: Categorize email')
 *   // { type: 'rate_limit', retryable: true, statusCode: 429, ... }
 * }
 * ```
 */
function classifyError(error: unknown, context?: string): ClassifiedError {
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Configuration errors - missing API keys, etc.
  if (errorMessage.includes('API_KEY') || errorMessage.includes('not configured')) {
    return {
      type: 'configuration',
      message: 'AI service not properly configured',
      retryable: false,
      statusCode: 503,
      details: context,
    }
  }

  // Rate limiting - Gemini quota exceeded
  if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
    return {
      type: 'rate_limit',
      message: 'AI service rate limited. Please try again later.',
      retryable: true,
      statusCode: 429,
      details: context,
    }
  }

  // Transient errors - 5xx, network issues (retryable)
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

  // Validation errors - bad requests (4xx except rate limit)
  if (errorMessage.includes('400') || errorMessage.includes('invalid')) {
    return {
      type: 'validation',
      message: 'Invalid request to AI service',
      retryable: false,
      statusCode: 400,
      details: context,
    }
  }

  // Default to unknown - log for investigation
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retryable: false,
    statusCode: 500,
    details: errorMessage,
  }
}

// -----------------------------------------------------------------------------
// Retry Utilities
// -----------------------------------------------------------------------------

/**
 * Pauses execution for a specified duration.
 * Used for retry backoff delays.
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculates exponential backoff delay with jitter.
 *
 * Formula: min(initial * 2^attempt + jitter, max)
 * Jitter: 0-30% of exponential value (prevents thundering herd)
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @returns Delay in milliseconds before next retry
 *
 * @example
 * ```typescript
 * calculateBackoff(0) // ~1000-1300ms
 * calculateBackoff(1) // ~2000-2600ms
 * calculateBackoff(2) // ~4000-5200ms
 * calculateBackoff(3) // ~8000-10000ms (capped)
 * ```
 */
function calculateBackoff(attempt: number): number {
  const exponential = INITIAL_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponential
  return Math.min(exponential + jitter, MAX_DELAY_MS)
}

// -----------------------------------------------------------------------------
// POST Handler - Execute AI Action
// -----------------------------------------------------------------------------

/**
 * Executes an AI-powered workflow step using Google Gemini.
 *
 * The AI agent operates within the constraints defined in the blueprint:
 * - greenList: Actions the AI is allowed to perform
 * - redList: Actions the AI must never perform (hard limits)
 *
 * When the AI is uncertain about how to proceed, it returns
 * `needsGuidance: true` with a question for the human manager.
 * The n8n workflow should then create a review request and retry
 * with the guidance in `guidanceContext`.
 *
 * Security:
 * - PII is filtered from input before sending to Gemini
 * - Blueprint constraints prevent unauthorized actions
 *
 * @param request - Next.js request with JSON body
 * @returns JSON response with action result or guidance request
 *
 * @example Success Response (200)
 * ```json
 * {
 *   "success": true,
 *   "result": { "category": "Internal", "priority": "High" },
 *   "actions": ["analyzed content", "applied category label"],
 *   "message": "Email categorized as Internal/High priority"
 * }
 * ```
 *
 * @example Guidance Needed Response (200)
 * ```json
 * {
 *   "success": false,
 *   "needsGuidance": true,
 *   "guidanceQuestion": "The email contains both sales and support topics. Which department should handle it?",
 *   "partialResult": { "detectedTopics": ["sales", "support"] },
 *   "message": "AI agent requires guidance to proceed"
 * }
 * ```
 *
 * @example Error Response (503 - Configuration)
 * ```json
 * {
 *   "error": "AI service not properly configured",
 *   "errorType": "configuration",
 *   "retryable": false
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  const supabase = await createClient()

  try {
    // -------------------------------------------------------------------------
    // Parse and Validate Request
    // -------------------------------------------------------------------------

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
    } = body as AIActionRequest

    if (!workflowId || !stepId) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId and stepId' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // Parse Blueprint
    // -------------------------------------------------------------------------

    // Blueprint defines what the AI agent can and cannot do
    let blueprintData = { greenList: [] as string[], redList: [] as string[] }
    try {
      blueprintData = typeof blueprint === 'string' ? JSON.parse(blueprint) : blueprint || blueprintData
    } catch {
      logger.warn('Failed to parse blueprint, using defaults')
    }

    // -------------------------------------------------------------------------
    // Parse Input Data
    // -------------------------------------------------------------------------

    let inputData: Record<string, unknown> = {}
    try {
      inputData = typeof input === 'string' ? JSON.parse(input) : input || {}
    } catch {
      logger.warn('Failed to parse input, using empty object')
    }

    // -------------------------------------------------------------------------
    // Log Step Start
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Build Prompts and Call Gemini
    // -------------------------------------------------------------------------

    const systemPrompt = buildSystemPrompt(stepLabel as string, blueprintData, guidanceContext as string | undefined)
    const userPrompt = buildUserPrompt(inputData)

    const geminiResponse = await callGemini(systemPrompt, userPrompt)

    // -------------------------------------------------------------------------
    // Handle Guidance Request
    // -------------------------------------------------------------------------

    if (geminiResponse.needsGuidance) {
      // AI is uncertain and needs human input
      return NextResponse.json({
        success: false,
        needsGuidance: true,
        guidanceQuestion: geminiResponse.guidanceQuestion,
        partialResult: geminiResponse.partialResult,
        message: 'AI agent requires guidance to proceed',
      } as AIActionResponse)
    }

    // -------------------------------------------------------------------------
    // Log Successful Execution
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Success Response
    // -------------------------------------------------------------------------

    return NextResponse.json({
      success: true,
      result: geminiResponse.result,
      actions: geminiResponse.actions,
      message: geminiResponse.message,
    } as AIActionResponse)
  } catch (error) {
    logger.error('Error in ai-action:', error)

    // -------------------------------------------------------------------------
    // Error Classification and Response
    // -------------------------------------------------------------------------

    const classified = classifyError(error, `Step: ${body?.stepLabel || 'unknown'}`)

    // Log detailed error for debugging (fire and forget)
    void supabase.from('activity_logs').insert({
      type: 'workflow_step_error',
      worker_name: body?.workerName as string | undefined,
      workflow_id: body?.workflowId as string | undefined,
      data: {
        stepId: body?.stepId,
        stepLabel: body?.stepLabel,
        errorType: classified.type,
        errorMessage: classified.message,
        retryable: classified.retryable,
      },
    })

    return NextResponse.json(
      {
        error: classified.message,
        errorType: classified.type,
        retryable: classified.retryable,
        details: classified.details,
      } as AIActionResponse,
      { status: classified.statusCode }
    )
  }
}

// -----------------------------------------------------------------------------
// Prompt Building
// -----------------------------------------------------------------------------

/**
 * Builds the system prompt that defines the AI agent's role and constraints.
 *
 * The prompt includes:
 * - Role definition (executing specific workflow step)
 * - Allowed actions from greenList
 * - Prohibited actions from redList
 * - Response format specification
 * - Previous guidance if retrying
 *
 * @param stepLabel - Human-readable step name
 * @param blueprint - Permission configuration
 * @param guidanceContext - Previous human guidance (if any)
 * @returns Formatted system prompt for Gemini
 */
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

/**
 * Builds the user prompt containing the input data for processing.
 *
 * Security: Filters PII from input before sending to Gemini.
 * This prevents sensitive data (SSN, credit cards, etc.) from
 * being sent to the external AI service.
 *
 * @param inputData - Raw input data for the step
 * @returns Formatted user prompt with filtered data
 */
function buildUserPrompt(inputData: Record<string, unknown>): string {
  // Filter PII before sending to AI (3.6 security fix)
  warnIfSensitiveData(inputData, 'ai-action input', logger)
  const filteredInput = filterPII(inputData)

  return `Execute the task with the following input data:

${JSON.stringify(filteredInput, null, 2)}

Perform the required action and return the result in the specified JSON format.`
}

// -----------------------------------------------------------------------------
// Gemini API Call
// -----------------------------------------------------------------------------

/**
 * Response structure from Gemini API call.
 */
interface GeminiResponse {
  result?: unknown
  actions?: string[]
  message?: string
  needsGuidance?: boolean
  guidanceQuestion?: string
  partialResult?: unknown
}

/**
 * Calls the Google Gemini API with retry logic.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Retries on 5xx errors and rate limits
 * - Classifies errors for appropriate handling
 * - Parses JSON response or wraps text response
 *
 * @param systemPrompt - Role and constraints for the AI
 * @param userPrompt - Input data and instructions
 * @returns Parsed response from Gemini
 * @throws Error if all retries fail or non-retryable error occurs
 */
async function callGemini(systemPrompt: string, userPrompt: string): Promise<GeminiResponse> {
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

        // Check if error is retryable (5xx or rate limit)
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

      // Parse successful response
      const data = await response.json()
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!content) {
        throw new Error('No content in Gemini response')
      }

      // Parse JSON response
      try {
        return JSON.parse(content)
      } catch {
        // If response isn't valid JSON, wrap it in standard format
        return {
          result: content,
          actions: ['processed'],
          message: 'Action completed',
          needsGuidance: false,
        }
      }
    } catch (error) {
      // Handle network errors (TypeError for fetch failures)
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

  // Should never reach here, but handle edge case
  throw lastError || new Error('Gemini request failed after all retries')
}
