/**
 * @fileoverview API endpoint for processing human review responses.
 *
 * This endpoint is called when a user approves, rejects, or edits a review request
 * in the Control Room. It handles the complete review workflow:
 *
 * 1. Authenticates the user and verifies organization membership
 * 2. Validates the review request exists and user has access
 * 3. Updates the review status in the database
 * 4. Resumes the paused n8n workflow with the review decision
 * 5. Updates execution status based on approval/rejection
 *
 * Security features:
 * - Rate limiting to prevent abuse
 * - User authentication required
 * - Organization-level authorization
 * - SSRF protection for callback URLs
 *
 * @module api/n8n/review-response
 *
 * @example
 * ```typescript
 * // From Control Room component:
 * const response = await fetch('/api/n8n/review-response', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     reviewId: 'uuid-of-review-request',
 *     status: 'approved', // or 'rejected', 'edited'
 *     feedback: 'Looks good, approved for processing',
 *     editedData: { /* modified data if status is 'edited' *\/ },
 *     reviewerId: 'uuid-of-reviewer'
 *   })
 * });
 *
 * const result = await response.json();
 * // { success: true, reviewId: '...', status: 'approved', workflowResumed: true }
 * ```
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { standardRateLimiter, applyRateLimit } from '@/lib/rate-limit'

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * n8n API base URL for workflow operations.
 * @default 'http://localhost:5678/api/v1'
 */
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'

/**
 * n8n API key for authenticating workflow resume requests.
 * Required for resuming paused workflows.
 */
const N8N_API_KEY = process.env.N8N_API_KEY || ''

// -----------------------------------------------------------------------------
// SSRF Protection
// -----------------------------------------------------------------------------

/**
 * List of allowed hosts for callback URLs.
 *
 * This is a critical security measure to prevent Server-Side Request Forgery (SSRF).
 * Only n8n server hosts are allowed - prevents attackers from using this endpoint
 * to make requests to internal services.
 *
 * Built dynamically from N8N_API_URL at module load time.
 * Also includes localhost variants when n8n is running locally.
 *
 * @example
 * // If N8N_API_URL is 'http://n8n.internal:5678/api/v1'
 * // ALLOWED_CALLBACK_HOSTS = ['n8n.internal:5678']
 *
 * // If N8N_API_URL is 'http://localhost:5678/api/v1'
 * // ALLOWED_CALLBACK_HOSTS = ['localhost:5678', '127.0.0.1:5678']
 */
const ALLOWED_CALLBACK_HOSTS: string[] = (() => {
  const hosts: string[] = []
  try {
    const n8nUrl = new URL(N8N_API_URL.replace('/api/v1', ''))
    hosts.push(n8nUrl.host)
    // Also allow localhost variants
    if (n8nUrl.hostname === 'localhost' || n8nUrl.hostname === '127.0.0.1') {
      hosts.push('localhost:5678', '127.0.0.1:5678')
    }
  } catch {
    hosts.push('localhost:5678')
  }
  return hosts
})()

/**
 * Validates that a URL is allowed for callback/webhook requests.
 *
 * This is a critical security function that prevents SSRF attacks.
 * It ensures that:
 * - Only http/https protocols are allowed (blocks file://, ftp://, etc.)
 * - Only known n8n hosts can be called
 * - Malformed URLs are rejected
 *
 * @param url - The URL to validate
 * @returns true if the URL is safe to call, false otherwise
 *
 * @example
 * ```typescript
 * isAllowedCallbackUrl('http://localhost:5678/webhook/abc')  // true
 * isAllowedCallbackUrl('http://internal-service/admin')      // false (not allowed host)
 * isAllowedCallbackUrl('file:///etc/passwd')                 // false (wrong protocol)
 * isAllowedCallbackUrl('not-a-url')                          // false (invalid)
 * ```
 *
 * @security CRITICAL - Do not modify without security review
 */
function isAllowedCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    // Check if host is in allowed list
    return ALLOWED_CALLBACK_HOSTS.includes(parsed.host)
  } catch {
    return false
  }
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Request body for the review response endpoint.
 */
interface ReviewResponseBody {
  /** UUID of the review request being responded to */
  reviewId: string
  /** Decision: approved, rejected, or edited */
  status: 'approved' | 'rejected' | 'edited'
  /** Optional text feedback explaining the decision */
  feedback?: string
  /** Modified data when status is 'edited' */
  editedData?: Record<string, unknown>
  /** UUID of the user who reviewed (for audit trail) */
  reviewerId?: string
}

/**
 * Successful response from the review response endpoint.
 */
interface ReviewResponseSuccess {
  success: true
  /** UUID of the processed review */
  reviewId: string
  /** Final status of the review */
  status: string
  /** Whether the n8n workflow was successfully resumed */
  workflowResumed: boolean
  /** Human-readable message */
  message: string
}

// -----------------------------------------------------------------------------
// POST Handler
// -----------------------------------------------------------------------------

/**
 * Processes a human review response from the Control Room.
 *
 * This endpoint completes the human-in-the-loop workflow by:
 * 1. Validating the review response
 * 2. Updating the review request status in the database
 * 3. Resuming the paused n8n workflow with the decision
 * 4. Updating the execution status
 *
 * Security measures:
 * - Rate limited to 100 requests/minute per IP (standard limiter)
 * - Requires authenticated user session
 * - Verifies user belongs to the same organization as the workflow
 * - Validates callback URLs to prevent SSRF
 *
 * @param request - Next.js request object with JSON body
 * @returns JSON response with success status or error
 *
 * @example Success Response (200)
 * ```json
 * {
 *   "success": true,
 *   "reviewId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "approved",
 *   "workflowResumed": true,
 *   "message": "Review approved. Workflow resumed."
 * }
 * ```
 *
 * @example Error Response (401 - Unauthorized)
 * ```json
 * { "error": "Unauthorized" }
 * ```
 *
 * @example Error Response (404 - Not Found)
 * ```json
 * { "error": "Review request not found" }
 * ```
 *
 * @example Error Response (429 - Rate Limited)
 * ```json
 * { "error": "Too many requests. Please try again later." }
 * ```
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting (5.3 fix)
  const rateLimitResult = applyRateLimit(request, standardRateLimiter)
  if (rateLimitResult) return rateLimitResult

  try {
    const supabase = await createClient()

    // -------------------------------------------------------------------------
    // Authentication (3.3 fix)
    // -------------------------------------------------------------------------

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // -------------------------------------------------------------------------
    // Organization Authorization (3.3 fix)
    // -------------------------------------------------------------------------

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!membership?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 })
    }

    // -------------------------------------------------------------------------
    // Request Validation
    // -------------------------------------------------------------------------

    const body: ReviewResponseBody = await request.json()
    const {
      reviewId,
      status, // 'approved' | 'rejected' | 'edited'
      feedback,
      editedData,
      reviewerId,
    } = body

    if (!reviewId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: reviewId, status' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // Fetch Review Request with Organization Verification (3.3 fix)
    // -------------------------------------------------------------------------

    // Join through executions -> workflows to verify organization access
    // This ensures users can only respond to reviews in their organization
    const { data: reviewRequest, error: fetchError } = await supabase
      .from('review_requests')
      .select(`
        *,
        executions!inner(
          workflow_id,
          workflows!inner(organization_id)
        )
      `)
      .eq('id', reviewId)
      .single()

    if (fetchError || !reviewRequest) {
      return NextResponse.json(
        { error: 'Review request not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this review through organization (3.3 fix)
    // Note: Returns 404 instead of 403 to avoid leaking review existence
    const reviewOrgId = reviewRequest.executions?.workflows?.organization_id
    if (reviewOrgId && reviewOrgId !== membership.organization_id) {
      return NextResponse.json(
        { error: 'Review request not found' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // Update Review Status (Phase 7.1 - Atomic RPC)
    // -------------------------------------------------------------------------

    // Use atomic RPC function for review response processing
    // This ensures consistency even under concurrent updates
    const { data: rpcResult, error: rpcError } = await supabase.rpc('process_review_response', {
      p_review_id: reviewId,
      p_status: status,
      p_feedback: feedback || null,
      p_edited_data: editedData || null,
      p_reviewer_id: reviewerId || null,
    })

    if (rpcError) {
      logger.warn('RPC process_review_response failed, falling back to individual updates:', rpcError)

      // Fallback to individual updates if RPC not available (N2 fix - use direct columns)
      const { error: updateError } = await supabase
        .from('review_requests')
        .update({
          status,
          feedback,
          edited_data: editedData,
          reviewer_id: reviewerId,
          reviewed_at: new Date().toISOString(),
          action_payload: reviewRequest.action_payload,
        })
        .eq('id', reviewId)

      if (updateError) {
        logger.error('Error updating review request:', updateError)
        return NextResponse.json(
          { error: 'Failed to update review request' },
          { status: 500 }
        )
      }

      // Log activity for audit trail
      await supabase.from('activity_logs').insert({
        type: 'review_completed',
        worker_name: reviewRequest.worker_name,
        data: {
          reviewId,
          status,
          feedback,
        },
      })
    }

    // -------------------------------------------------------------------------
    // Resume n8n Workflow
    // -------------------------------------------------------------------------

    // The n8n Wait node stores a webhook URL to call when resuming
    const resumeWebhookUrl = reviewRequest.action_payload?.resumeWebhookUrl
    const n8nExecutionId = reviewRequest.action_payload?.n8nExecutionId
    let workflowResumed = false

    if (resumeWebhookUrl) {
      // CRITICAL: Validate URL to prevent SSRF (S3 security fix)
      if (!isAllowedCallbackUrl(resumeWebhookUrl)) {
        logger.warn('Invalid resume webhook URL blocked', {
          url: resumeWebhookUrl,
          allowedHosts: ALLOWED_CALLBACK_HOSTS,
        })
        return NextResponse.json(
          { error: 'Invalid callback URL - SSRF protection triggered' },
          { status: 400 }
        )
      }

      try {
        // Build payload for n8n workflow resume
        const resumePayload = {
          approved: status === 'approved' || status === 'edited',
          reviewId,
          status,
          feedback,
          editedData,
          reviewerId,
          responseData: editedData || reviewRequest.action_payload?.data,
          reviewedAt: new Date().toISOString(),
        }

        const resumeResponse = await fetch(resumeWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': N8N_API_KEY,
          },
          body: JSON.stringify(resumePayload),
        })

        if (resumeResponse.ok) {
          workflowResumed = true
          logger.info('Successfully resumed n8n workflow', {
            executionId: n8nExecutionId,
            reviewId,
            status,
          })
        } else {
          const errorText = await resumeResponse.text()
          logger.warn('Failed to resume n8n workflow (may have timed out)', {
            status: resumeResponse.status,
            error: errorText,
            resumeWebhookUrl,
          })
        }
      } catch (resumeError) {
        logger.error('Error resuming n8n workflow:', resumeError)
        // Don't fail the request - the review is still processed
        // User can manually retry or the workflow may have timed out
      }
    }

    // -------------------------------------------------------------------------
    // Update Execution Status
    // -------------------------------------------------------------------------

    // Update execution status based on review result
    // - approved/edited: workflow continues (running)
    // - rejected: workflow stops (failed)
    if (n8nExecutionId) {
      const executionStatus = status === 'approved' || status === 'edited'
        ? 'running'
        : 'failed'

      await supabase
        .from('executions')
        .update({ status: executionStatus })
        .eq('n8n_execution_id', n8nExecutionId)
    }

    // -------------------------------------------------------------------------
    // Legacy Callback Support
    // -------------------------------------------------------------------------

    // Also call legacy callback URL if provided (backward compatibility)
    // Some older workflows may use a separate callback URL
    const callbackUrl = reviewRequest.action_payload?.callbackUrl
    if (callbackUrl && callbackUrl !== resumeWebhookUrl) {
      // CRITICAL: Validate URL to prevent SSRF (S3 security fix)
      if (!isAllowedCallbackUrl(callbackUrl)) {
        logger.warn('Invalid legacy callback URL blocked', {
          url: callbackUrl,
          allowedHosts: ALLOWED_CALLBACK_HOSTS,
        })
        // Don't fail the request, just skip the callback
      } else {
        try {
          await fetch(callbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reviewId,
              approved: status === 'approved' || status === 'edited',
              status,
              feedback,
              editedData,
              reviewerId,
              reviewedAt: new Date().toISOString(),
            }),
          })
        } catch (callbackError) {
          logger.error('Error calling legacy callback:', callbackError)
        }
      }
    }

    // -------------------------------------------------------------------------
    // Success Response
    // -------------------------------------------------------------------------

    return NextResponse.json({
      success: true,
      reviewId,
      status,
      workflowResumed,
      message: workflowResumed
        ? `Review ${status}. Workflow resumed.`
        : `Review ${status} successfully`,
    } as ReviewResponseSuccess)
  } catch (error) {
    logger.error('Error in review-response POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
