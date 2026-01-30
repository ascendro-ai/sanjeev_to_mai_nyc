import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * POST /api/n8n/execution-complete
 *
 * Called by n8n when a workflow execution completes.
 * Updates the execution record and worker status.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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

    // Update execution record
    if (executionId) {
      await supabase
        .from('executions')
        .update({
          status: status === 'completed' ? 'completed' : 'failed',
          output_data: result,
          error: error,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId)
    }

    // Update worker status back to active (from busy/running)
    if (workerId) {
      await supabase
        .from('digital_workers')
        .update({
          status: status === 'completed' ? 'active' : 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workerId)
    }

    // Log completion activity
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

    // Create notification for the manager
    // (Would need to look up the worker's manager)
    // This is a placeholder for notification logic

    return NextResponse.json({
      success: true,
      message: `Workflow execution ${status}`,
      status,
    })
  } catch (error) {
    console.error('Error in execution-complete:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
