/**
 * @fileoverview API endpoint for creating and managing human review requests.
 *
 * This endpoint is called by n8n workflows when they reach a Human Review node.
 * It creates a review request that pauses the workflow until a human approves,
 * rejects, or edits the pending action.
 *
 * The review request lifecycle:
 * 1. n8n workflow hits Human Review node
 * 2. n8n calls POST /api/n8n/review-request
 * 3. Review request created with status 'pending'
 * 4. n8n workflow pauses (Wait node)
 * 5. Human reviews in Control Room
 * 6. POST /api/n8n/review-response resumes workflow
 *
 * Security features:
 * - Webhook signature validation (HMAC)
 * - Rate limiting to prevent abuse
 * - Duplicate request prevention
 *
 * @module api/n8n/review-request
 *
 * @example
 * ```typescript
 * // From n8n HTTP Request node:
 * // POST https://yourapp.com/api/n8n/review-request
 * // Headers: X-N8N-Webhook-Signature: <hmac_signature>
 * {
 *   "executionId": "n8n-execution-123",
 *   "workflowId": "workflow-uuid",
 *   "stepId": "step-1",
 *   "workerName": "Email Processor",
 *   "reviewType": "approval",
 *   "stepLabel": "Send customer email",
 *   "data": { "to": "customer@example.com", "subject": "Order confirmation" },
 *   "callbackUrl": "http://n8n:5678/webhook-waiting/..."
 * }
 * ```
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateWebhookRequest } from '@/lib/n8n/webhook-auth'
import { webhookRateLimiter, applyRateLimit, standardRateLimiter } from '@/lib/rate-limit'

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * n8n API base URL, used to construct the resume webhook URL.
 * @default 'http://localhost:5678/api/v1'
 */
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Request body for creating a review request.
 * Sent by n8n when a workflow reaches a Human Review node.
 */
interface ReviewRequestBody {
  /** n8n execution ID - used to resume the workflow */
  executionId: string
  /** Optional workflow UUID from our database */
  workflowId?: string
  /** Step identifier within the workflow */
  stepId: string
  /** Name of the digital worker requesting review */
  workerName?: string
  /** Type of review: approval, edit, or decision */
  reviewType: 'approval' | 'edit' | 'decision'
  /** Human-readable step label for display */
  stepLabel?: string
  /** Data being reviewed (email content, decision options, etc.) */
  data?: Record<string, unknown>
  /** Legacy callback URL (newer workflows use resumeWebhookUrl) */
  callbackUrl?: string
}

/**
 * Successful response when creating a review request.
 */
interface ReviewRequestSuccessResponse {
  /** UUID of the created review request */
  reviewId: string
  /** Current status (always 'pending' for new requests) */
  status: 'pending'
  /** Human-readable message */
  message: string
  /** The webhook URL to resume the n8n workflow */
  resumeWebhookUrl: string
  /** True if a pending review already exists (duplicate prevention) */
  alreadyExists?: boolean
}

// -----------------------------------------------------------------------------
// POST Handler - Create Review Request
// -----------------------------------------------------------------------------

/**
 * Creates a new human review request from an n8n workflow.
 *
 * This endpoint is called by n8n HTTP Request nodes when a workflow
 * needs human approval before continuing. The workflow pauses (Wait node)
 * until the review is completed via /api/n8n/review-response.
 *
 * Duplicate Prevention:
 * If a pending review already exists for the same execution + step,
 * returns the existing review instead of creating a duplicate.
 *
 * Security:
 * - Validates n8n webhook signature (HMAC-SHA256)
 * - Rate limited to 1000 requests/minute per IP
 *
 * @param request - Next.js request with JSON body and webhook signature header
 * @returns JSON response with review request details
 *
 * @example Success Response (200)
 * ```json
 * {
 *   "reviewId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "pending",
 *   "message": "Review request created successfully. Workflow paused until review is complete.",
 *   "resumeWebhookUrl": "http://n8n:5678/webhook-waiting/exec-123/review-step-1"
 * }
 * ```
 *
 * @example Duplicate Response (200)
 * ```json
 * {
 *   "reviewId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "pending",
 *   "message": "Review already exists for this step",
 *   "alreadyExists": true
 * }
 * ```
 *
 * @example Error Response (401 - Invalid Signature)
 * ```json
 * { "error": "Invalid webhook signature" }
 * ```
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting for webhooks (5.3 fix)
  const rateLimitResult = applyRateLimit(request, webhookRateLimiter)
  if (rateLimitResult) return rateLimitResult

  try {
    // -------------------------------------------------------------------------
    // Webhook Signature Validation (S1 security fix)
    // -------------------------------------------------------------------------

    const validation = await validateWebhookRequest(request)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // -------------------------------------------------------------------------
    // Parse and Validate Request Body
    // -------------------------------------------------------------------------

    const body: ReviewRequestBody = JSON.parse(validation.body)
    const {
      executionId,
      workflowId,
      stepId,
      workerName,
      reviewType,
      stepLabel,
      data,
      callbackUrl,
    } = body

    // Validate required fields
    if (!executionId || !reviewType) {
      return NextResponse.json(
        { error: 'Missing required fields: executionId, reviewType' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // Duplicate Prevention (4.2 / N7 fix)
    // -------------------------------------------------------------------------

    // Check for existing pending review to prevent duplicates
    // This handles cases where n8n retries the request
    const { data: existingReview } = await supabase
      .from('review_requests')
      .select('id')
      .eq('execution_id', executionId)
      .eq('step_id', stepId)
      .eq('status', 'pending')
      .single()

    if (existingReview) {
      return NextResponse.json({
        reviewId: existingReview.id,
        status: 'pending',
        message: 'Review already exists for this step',
        alreadyExists: true,
      })
    }

    // -------------------------------------------------------------------------
    // Generate Resume Webhook URL
    // -------------------------------------------------------------------------

    // Generate the n8n webhook URL for resuming the Wait node
    // Format: {n8n_base_url}/webhook-waiting/{execution_id}/review-{step_id}
    // This URL is stored with the review and called when the human responds
    const n8nBaseUrl = N8N_API_URL.replace('/api/v1', '')
    const resumeWebhookUrl = `${n8nBaseUrl}/webhook-waiting/${executionId}/review-${stepId}`

    // -------------------------------------------------------------------------
    // Create Review Request in Database
    // -------------------------------------------------------------------------

    const { data: reviewRequest, error } = await supabase
      .from('review_requests')
      .insert({
        execution_id: executionId,
        step_id: stepId,
        worker_name: workerName || 'n8n Workflow',
        action_type: reviewType,
        action_payload: {
          stepLabel,
          data,
          callbackUrl,
          workflowId,
          n8nExecutionId: executionId,
          resumeWebhookUrl,
        },
        status: 'pending',
        chat_history: [],
      })
      .select()
      .single()

    if (error) {
      logger.error('Error creating review request:', error)
      return NextResponse.json(
        { error: 'Failed to create review request' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // Update Execution Status
    // -------------------------------------------------------------------------

    // Mark the execution as waiting for review
    await supabase
      .from('executions')
      .update({ status: 'waiting_review', current_step_index: stepId })
      .eq('n8n_execution_id', executionId)

    // -------------------------------------------------------------------------
    // Log Activity
    // -------------------------------------------------------------------------

    await supabase.from('activity_logs').insert({
      type: 'review_requested',
      worker_name: workerName || 'n8n Workflow',
      data: {
        reviewType,
        stepLabel,
        executionId,
        reviewId: reviewRequest.id,
      },
    })

    // -------------------------------------------------------------------------
    // Success Response
    // -------------------------------------------------------------------------

    return NextResponse.json({
      reviewId: reviewRequest.id,
      status: 'pending',
      message: 'Review request created successfully. Workflow paused until review is complete.',
      resumeWebhookUrl, // Return for debugging purposes
    } as ReviewRequestSuccessResponse)
  } catch (error) {
    logger.error('Error in review-request POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// -----------------------------------------------------------------------------
// GET Handler - Poll Review Status
// -----------------------------------------------------------------------------

/**
 * Retrieves the current status of a review request.
 *
 * Used by n8n to poll for review completion (fallback mechanism)
 * or by the Control Room to refresh review details.
 *
 * Note: In normal operation, the review-response endpoint pushes
 * the decision to n8n via webhook. This polling endpoint is a fallback.
 *
 * @param request - Next.js request with 'id' query parameter
 * @returns JSON response with review request details
 *
 * @example Request
 * ```
 * GET /api/n8n/review-request?id=550e8400-e29b-41d4-a716-446655440000
 * ```
 *
 * @example Success Response (200)
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "pending",
 *   "actionType": "approval",
 *   "actionPayload": { "stepLabel": "Send email", "data": {...} },
 *   "chatHistory": [],
 *   "createdAt": "2024-01-15T10:30:00Z"
 * }
 * ```
 *
 * @example Error Response (404)
 * ```json
 * { "error": "Review request not found" }
 * ```
 */
export async function GET(request: NextRequest) {
  // Apply standard rate limiting (5.3 fix)
  const rateLimitResult = applyRateLimit(request, standardRateLimiter)
  if (rateLimitResult) return rateLimitResult

  try {
    const supabase = await createClient()

    // -------------------------------------------------------------------------
    // Parse Query Parameters
    // -------------------------------------------------------------------------

    const { searchParams } = new URL(request.url)
    const reviewId = searchParams.get('id')

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Missing review ID' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // Fetch Review Request
    // -------------------------------------------------------------------------

    const { data: reviewRequest, error } = await supabase
      .from('review_requests')
      .select('*')
      .eq('id', reviewId)
      .single()

    if (error) {
      logger.error('Error fetching review request:', error)
      return NextResponse.json(
        { error: 'Review request not found' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // Success Response
    // -------------------------------------------------------------------------

    return NextResponse.json({
      id: reviewRequest.id,
      status: reviewRequest.status,
      actionType: reviewRequest.action_type,
      actionPayload: reviewRequest.action_payload,
      chatHistory: reviewRequest.chat_history,
      createdAt: reviewRequest.created_at,
    })
  } catch (error) {
    logger.error('Error in review-request GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
