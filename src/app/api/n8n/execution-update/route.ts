/**
 * @fileoverview API endpoint for receiving workflow execution progress updates from n8n.
 *
 * This endpoint is called by n8n HTTP Request nodes during workflow execution
 * to report progress. It enables real-time tracking of workflow status in the
 * Control Room through Supabase Realtime subscriptions.
 *
 * Execution lifecycle tracked:
 * 1. Workflow starts → status: 'running', currentStepIndex: 0
 * 2. Each step completes → status: 'running', currentStepIndex increments
 * 3. Review needed → status: 'waiting_review'
 * 4. Workflow completes → status: 'completed'
 * 5. Workflow fails → status: 'failed'
 *
 * Integration with Control Room:
 * - Updates to `executions` table trigger Supabase Realtime events
 * - useRealtime hook in Control Room receives updates instantly
 * - React Query cache invalidates, UI refreshes automatically
 *
 * Security features:
 * - Webhook signature validation (HMAC)
 * - Automatic record creation for new executions
 *
 * @module api/n8n/execution-update
 *
 * @example
 * ```typescript
 * // From n8n HTTP Request node at start of workflow:
 * // POST https://yourapp.com/api/n8n/execution-update
 * {
 *   "executionId": "{{ $execution.id }}",
 *   "workflowId": "workflow-uuid",
 *   "status": "running",
 *   "currentStepIndex": 0,
 *   "currentStepName": "Fetch emails"
 * }
 *
 * // From n8n HTTP Request node after step completes:
 * {
 *   "executionId": "{{ $execution.id }}",
 *   "status": "running",
 *   "currentStepIndex": 1,
 *   "currentStepName": "Process emails",
 *   "outputData": { "emailCount": 5 }
 * }
 * ```
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateWebhookRequest } from '@/lib/n8n/webhook-auth'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Valid execution status values.
 * Matches the status enum in the executions table.
 */
type ExecutionStatus = 'pending' | 'running' | 'waiting_review' | 'completed' | 'failed' | 'cancelled'

/**
 * Request body for execution updates from n8n.
 */
interface ExecutionUpdateBody {
  /** n8n execution ID - unique identifier for this workflow run */
  executionId: string
  /** Our workflow UUID (optional, for linking to workflow definition) */
  workflowId?: string
  /** Digital worker UUID executing this workflow */
  workerId?: string
  /** Current execution status */
  status: ExecutionStatus
  /** Zero-based index of the current step */
  currentStepIndex?: number
  /** Human-readable name of the current step */
  currentStepName?: string
  /** Output data from the last completed step */
  outputData?: Record<string, unknown>
  /** Error message if status is 'failed' */
  error?: string
}

/**
 * Activity log types for execution events.
 */
type ExecutionActivityType = 'execution_completed' | 'execution_failed' | 'execution_progress'

// -----------------------------------------------------------------------------
// POST Handler - Update Execution Status
// -----------------------------------------------------------------------------

/**
 * Receives execution progress updates from n8n workflows.
 *
 * Called by n8n HTTP Request nodes throughout workflow execution.
 * Creates new execution records for first-time updates, or updates
 * existing records for subsequent progress reports.
 *
 * Data Flow:
 * 1. n8n sends POST with execution status
 * 2. This endpoint updates/creates `executions` record
 * 3. Supabase Realtime broadcasts change
 * 4. Control Room useRealtime hook receives update
 * 5. React Query invalidates, UI refreshes
 *
 * Security:
 * - Validates n8n webhook signature (HMAC-SHA256)
 * - Non-authenticated (webhook auth only)
 *
 * @param request - Next.js request with JSON body and webhook signature header
 * @returns JSON response with update confirmation
 *
 * @example Success Response (200)
 * ```json
 * {
 *   "success": true,
 *   "executionId": "n8n-exec-123",
 *   "status": "running",
 *   "message": "Execution updated successfully"
 * }
 * ```
 *
 * @example Error Response (401 - Invalid Signature)
 * ```json
 * { "error": "Invalid webhook signature" }
 * ```
 *
 * @example Error Response (400 - Missing Fields)
 * ```json
 * { "error": "Missing required fields: executionId, status" }
 * ```
 */
export async function POST(request: NextRequest) {
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

    const body: ExecutionUpdateBody = JSON.parse(validation.body)
    const {
      executionId,
      workflowId,
      workerId,
      status,
      currentStepIndex,
      currentStepName,
      outputData,
      error: executionError,
    } = body

    if (!executionId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: executionId, status' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // Upsert Execution Record (N1/N5 fix)
    // -------------------------------------------------------------------------

    // Check if execution exists by n8n execution ID
    const { data: existingExecution } = await supabase
      .from('executions')
      .select('id')
      .eq('n8n_execution_id', executionId)
      .single()

    if (!existingExecution) {
      // Create new execution record (first update for this execution)
      const { error: insertError } = await supabase
        .from('executions')
        .insert({
          id: executionId,
          workflow_id: workflowId,
          worker_id: workerId,
          status,
          current_step_index: currentStepIndex || 0,
          started_at: new Date().toISOString(),
        })

      if (insertError) {
        logger.error('Error creating execution:', insertError)
        return NextResponse.json(
          { error: 'Failed to create execution record' },
          { status: 500 }
        )
      }
    } else {
      // Update existing execution record
      const updateData: Record<string, unknown> = {
        status,
        current_step_index: currentStepIndex,
      }

      // Set completion timestamp for terminal states
      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('executions')
        .update(updateData)
        .eq('n8n_execution_id', executionId)

      if (updateError) {
        logger.error('Error updating execution:', updateError)
        return NextResponse.json(
          { error: 'Failed to update execution record' },
          { status: 500 }
        )
      }
    }

    // -------------------------------------------------------------------------
    // Log Activity
    // -------------------------------------------------------------------------

    // Determine activity type based on status
    const activityType: ExecutionActivityType = status === 'completed'
      ? 'execution_completed'
      : status === 'failed'
        ? 'execution_failed'
        : 'execution_progress'

    await supabase.from('activity_logs').insert({
      type: activityType,
      workflow_id: workflowId,
      data: {
        executionId,
        status,
        currentStepIndex,
        currentStepName,
        outputData,
        error: executionError,
      },
    })

    // -------------------------------------------------------------------------
    // Success Response
    // -------------------------------------------------------------------------

    return NextResponse.json({
      success: true,
      executionId,
      status,
      message: 'Execution updated successfully',
    })
  } catch (error) {
    logger.error('Error in execution-update POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// -----------------------------------------------------------------------------
// GET Handler - Check Execution Status
// -----------------------------------------------------------------------------

/**
 * Retrieves the current status of a workflow execution.
 *
 * Used by:
 * - n8n to poll execution status
 * - Control Room to fetch execution details
 * - Testing/debugging tools
 *
 * Note: For real-time updates, prefer Supabase Realtime subscriptions
 * via the useRealtime hook instead of polling this endpoint.
 *
 * @param request - Next.js request with 'id' query parameter
 * @returns JSON response with full execution record including workflow name
 *
 * @example Request
 * ```
 * GET /api/n8n/execution-update?id=550e8400-e29b-41d4-a716-446655440000
 * ```
 *
 * @example Success Response (200)
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "workflow_id": "wf-uuid",
 *   "status": "running",
 *   "current_step_index": 2,
 *   "started_at": "2024-01-15T10:30:00Z",
 *   "workflows": { "name": "Email Processing Workflow" }
 * }
 * ```
 *
 * @example Error Response (404)
 * ```json
 * { "error": "Execution not found" }
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // -------------------------------------------------------------------------
    // Parse Query Parameters
    // -------------------------------------------------------------------------

    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('id')

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing execution ID' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // Fetch Execution with Workflow Details
    // -------------------------------------------------------------------------

    const { data: execution, error } = await supabase
      .from('executions')
      .select('*, workflows(name)')
      .eq('id', executionId)
      .single()

    if (error || !execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // Success Response
    // -------------------------------------------------------------------------

    return NextResponse.json(execution)
  } catch (error) {
    logger.error('Error in execution-update GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
