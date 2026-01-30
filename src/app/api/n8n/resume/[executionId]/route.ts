import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
const N8N_API_KEY = process.env.N8N_API_KEY || ''

/**
 * Resume a waiting n8n workflow execution
 *
 * POST /api/n8n/resume/[executionId]
 *
 * Called when a human review is approved/rejected to resume the n8n Wait node.
 * This endpoint calls the n8n webhook-waiting endpoint to continue the workflow.
 */

interface ResumeParams {
  params: Promise<{ executionId: string }>
}

export async function POST(request: NextRequest, { params }: ResumeParams) {
  try {
    const { executionId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const {
      reviewId,
      stepId,
      approved,
      responseData,
      reviewerNotes,
    } = body

    // Validate required fields
    if (!reviewId || approved === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: reviewId, approved' },
        { status: 400 }
      )
    }

    // Get the review request to find the resume webhook URL
    const { data: reviewRequest, error: fetchError } = await supabase
      .from('review_requests')
      .select('*')
      .eq('id', reviewId)
      .single()

    if (fetchError || !reviewRequest) {
      logger.error('Review request not found:', fetchError)
      return NextResponse.json(
        { error: 'Review request not found' },
        { status: 404 }
      )
    }

    // Get the resume webhook URL from the stored payload
    const resumeWebhookUrl = reviewRequest.action_payload?.resumeWebhookUrl

    if (!resumeWebhookUrl) {
      // Fallback: construct the URL if not stored
      const n8nBaseUrl = N8N_API_URL.replace('/api/v1', '')
      const webhookSuffix = `review-${stepId || reviewRequest.step_id}`
      const fallbackUrl = `${n8nBaseUrl}/webhook-waiting/${executionId}/${webhookSuffix}`
      logger.warn('Resume webhook URL not found, using fallback:', fallbackUrl)
    }

    const targetUrl = resumeWebhookUrl || `${N8N_API_URL.replace('/api/v1', '')}/webhook-waiting/${executionId}/review-${stepId || reviewRequest.step_id}`

    // Prepare the data to send to the n8n Wait node
    const resumePayload = {
      approved,
      reviewId,
      reviewerNotes,
      responseData: responseData || reviewRequest.action_payload?.data,
      reviewedAt: new Date().toISOString(),
    }

    // Call the n8n webhook-waiting endpoint to resume the workflow
    const n8nResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': N8N_API_KEY,
      },
      body: JSON.stringify(resumePayload),
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      logger.error('Failed to resume n8n workflow:', {
        status: n8nResponse.status,
        error: errorText,
        targetUrl,
      })

      // Don't fail the request - the workflow might have timed out or completed
      // Still update the review status
    }

    // Update the review request status
    const newStatus = approved ? 'approved' : 'rejected'
    const { error: updateError } = await supabase
      .from('review_requests')
      .update({
        status: newStatus,
        action_payload: {
          ...reviewRequest.action_payload,
          reviewerNotes,
          responseData,
          reviewedAt: new Date().toISOString(),
        },
      })
      .eq('id', reviewId)

    if (updateError) {
      logger.error('Error updating review request:', updateError)
    }

    // Update execution status
    await supabase
      .from('executions')
      .update({
        status: approved ? 'running' : 'failed',
      })
      .eq('n8n_execution_id', executionId)

    // Log activity
    await supabase.from('activity_logs').insert({
      type: approved ? 'review_approved' : 'review_rejected',
      worker_name: reviewRequest.worker_name,
      data: {
        reviewId,
        executionId,
        stepId: reviewRequest.step_id,
        approved,
        reviewerNotes,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Review ${approved ? 'approved' : 'rejected'}. Workflow ${approved ? 'resumed' : 'stopped'}.`,
      executionId,
      reviewId,
      status: newStatus,
    })
  } catch (error) {
    logger.error('Error in resume endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET: Check if an execution can be resumed
 */
export async function GET(request: NextRequest, { params }: ResumeParams) {
  try {
    const { executionId } = await params
    const supabase = await createClient()

    // Find pending review requests for this execution
    const { data: reviewRequests, error } = await supabase
      .from('review_requests')
      .select('*')
      .eq('action_payload->>n8nExecutionId', executionId)
      .eq('status', 'pending')

    if (error) {
      logger.error('Error fetching review requests:', error)
      return NextResponse.json(
        { error: 'Failed to fetch review requests' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      executionId,
      pendingReviews: reviewRequests?.length || 0,
      reviews: reviewRequests || [],
    })
  } catch (error) {
    logger.error('Error in resume GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
