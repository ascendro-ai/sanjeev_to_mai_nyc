import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Review Response endpoint
 * Called when a user approves/rejects a review in the Control Room
 * This updates the review status and optionally calls back to n8n
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

    // Get the review request to find callback URL
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

    // Call back to n8n if callback URL is provided
    const callbackUrl = reviewRequest.action_payload?.callbackUrl
    if (callbackUrl) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reviewId,
            approved: status === 'approved',
            status,
            feedback,
            editedData,
            reviewerId,
            reviewedAt: new Date().toISOString(),
          }),
        })
      } catch (callbackError) {
        logger.error('Error calling n8n callback:', callbackError)
        // Don't fail the request if callback fails
      }
    }

    return NextResponse.json({
      success: true,
      reviewId,
      status,
      message: `Review ${status} successfully`,
    })
  } catch (error) {
    logger.error('Error in review-response POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
