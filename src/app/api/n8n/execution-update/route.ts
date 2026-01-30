import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Execution Update endpoint
 * Called by n8n to report workflow execution progress
 * This updates the executions table and triggers Realtime updates
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const body = await request.json()
    const {
      executionId,
      workflowId,
      workerId,
      status, // 'running' | 'waiting_review' | 'completed' | 'failed'
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

    // Check if execution exists
    const { data: existingExecution } = await supabase
      .from('executions')
      .select('id')
      .eq('id', executionId)
      .single()

    if (!existingExecution) {
      // Create new execution record
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
      // Update existing execution
      const updateData: Record<string, unknown> = {
        status,
        current_step_index: currentStepIndex,
      }

      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('executions')
        .update(updateData)
        .eq('id', executionId)

      if (updateError) {
        logger.error('Error updating execution:', updateError)
        return NextResponse.json(
          { error: 'Failed to update execution record' },
          { status: 500 }
        )
      }
    }

    // Log activity
    const activityType = status === 'completed'
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

/**
 * GET endpoint to check execution status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('id')

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing execution ID' },
        { status: 400 }
      )
    }

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

    return NextResponse.json(execution)
  } catch (error) {
    logger.error('Error in execution-update GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
