import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateWebhookRequest } from '@/lib/n8n/webhook-auth'

/**
 * POST /api/n8n/execution-complete
 *
 * Called by n8n when a workflow execution completes.
 * Updates the execution record and worker status.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (S1 security fix)
    const validation = await validateWebhookRequest(request)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
      )
    }

    const body = JSON.parse(validation.body)
    const {
      executionId,
      workflowId,
      workerId,
      status = 'completed',
      result,
      error,
      workerName,
    } = body

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Missing required field: workflowId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Use atomic RPC function for execution completion (Phase 7.1 fix)
    if (executionId) {
      const { error: rpcError } = await supabase.rpc('complete_execution', {
        p_execution_id: executionId,
        p_status: status === 'completed' ? 'completed' : 'failed',
        p_output_data: result || null,
        p_error: error || null,
        p_worker_id: workerId || null,
      })

      if (rpcError) {
        logger.warn('RPC complete_execution failed, falling back to individual updates:', rpcError)

        // Fallback to individual updates if RPC not available
        await supabase
          .from('executions')
          .update({
            status: status === 'completed' ? 'completed' : 'failed',
            output_data: result,
            error: error,
            completed_at: new Date().toISOString(),
          })
          .eq('id', executionId)

        if (workerId) {
          await supabase
            .from('digital_workers')
            .update({
              status: status === 'completed' ? 'active' : 'error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', workerId)
        }

        await supabase.from('activity_logs').insert({
          type: status === 'completed' ? 'workflow_complete' : 'error',
          worker_name: workerName,
          workflow_id: workflowId,
          data: {
            executionId,
            status,
            result,
            error,
            message: status === 'completed'
              ? `Workflow completed successfully`
              : `Workflow failed: ${error}`,
          },
        })
      }
    } else {
      // No executionId - just log activity
      await supabase.from('activity_logs').insert({
        type: status === 'completed' ? 'workflow_complete' : 'error',
        worker_name: workerName,
        workflow_id: workflowId,
        data: {
          status,
          result,
          error,
          message: status === 'completed'
            ? `Workflow completed successfully`
            : `Workflow failed: ${error}`,
        },
      })
    }

    // Create notification for the manager
    // (Would need to look up the worker's manager)
    // This is a placeholder for notification logic

    return NextResponse.json({
      success: true,
      message: `Workflow execution ${status}`,
      status,
    })
  } catch (error) {
    logger.error('Error in execution-complete:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
