import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'

/**
 * Human Review Node callback endpoint
 * Called by n8n when a workflow hits a Human Review node
 *
 * POST: Create a new review request (stores execution ID for Wait node resume)
 * GET: Poll review request status
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const body = await request.json()
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

    // Generate the n8n webhook URL for resuming the Wait node
    // Format: {n8n_base_url}/webhook-waiting/{execution_id}/review-{step_id}
    const n8nBaseUrl = N8N_API_URL.replace('/api/v1', '')
    const resumeWebhookUrl = `${n8nBaseUrl}/webhook-waiting/${executionId}/review-${stepId}`

    // Create review request in database with resume URL
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

    // Update execution status to waiting_review
    await supabase
      .from('executions')
      .update({ status: 'waiting_review', current_step_index: stepId })
      .eq('n8n_execution_id', executionId)

    // Log activity
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

    return NextResponse.json({
      reviewId: reviewRequest.id,
      status: 'pending',
      message: 'Review request created successfully. Workflow paused until review is complete.',
      resumeWebhookUrl, // Return for debugging purposes
    })
  } catch (error) {
    logger.error('Error in review-request POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const reviewId = searchParams.get('id')

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Missing review ID' },
        { status: 400 }
      )
    }

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
