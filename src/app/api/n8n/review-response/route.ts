import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
const N8N_API_KEY = process.env.N8N_API_KEY || ''

/**
 * Review Response endpoint
 * Called when a user approves/rejects a review in the Control Room
 * This updates the review status and resumes the n8n Wait node
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const body = await request.json()
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

    // Get the review request to find resume webhook URL
    const { data: reviewRequest, error: fetchError } = await supabase
      .from('review_requests')
      .select('*')
      .eq('id', reviewId)
      .single()

    if (fetchError || !reviewRequest) {
      return NextResponse.json(
        { error: 'Review request not found' },
        { status: 404 }
      )
    }

    // Update review request status
    const { error: updateError } = await supabase
      .from('review_requests')
      .update({
        status,
        action_payload: {
          ...reviewRequest.action_payload,
          feedback,
          editedData,
          reviewerId,
          reviewedAt: new Date().toISOString(),
        },
      })
      .eq('id', reviewId)

    if (updateError) {
      logger.error('Error updating review request:', updateError)
      return NextResponse.json(
        { error: 'Failed to update review request' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      type: 'review_completed',
      worker_name: reviewRequest.worker_name,
      data: {
        reviewId,
        status,
        feedback,
      },
    })

    // Resume the n8n Wait node using the stored webhook URL
    const resumeWebhookUrl = reviewRequest.action_payload?.resumeWebhookUrl
    const n8nExecutionId = reviewRequest.action_payload?.n8nExecutionId
    let workflowResumed = false

    if (resumeWebhookUrl) {
      try {
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
      }
    }

    // Update execution status based on review result
    if (n8nExecutionId) {
      const executionStatus = status === 'approved' || status === 'edited'
        ? 'running'
        : 'failed'

      await supabase
        .from('executions')
        .update({ status: executionStatus })
        .eq('n8n_execution_id', n8nExecutionId)
    }

    // Also call legacy callback URL if provided (backward compatibility)
    const callbackUrl = reviewRequest.action_payload?.callbackUrl
    if (callbackUrl && callbackUrl !== resumeWebhookUrl) {
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

    return NextResponse.json({
      success: true,
      reviewId,
      status,
      workflowResumed,
      message: workflowResumed
        ? `Review ${status}. Workflow resumed.`
        : `Review ${status} successfully`,
    })
  } catch (error) {
    logger.error('Error in review-response POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
