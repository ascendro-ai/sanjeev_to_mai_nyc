import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Human Review Node callback endpoint
 * Called by n8n when a workflow hits a Human Review node
 *
 * POST: Create a new review request
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

    // Create review request in database
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
        },
        status: 'pending',
        chat_history: [],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating review request:', error)
      return NextResponse.json(
        { error: 'Failed to create review request' },
        { status: 500 }
      )
    }

    // Also log activity
    await supabase.from('activity_logs').insert({
      type: 'review_requested',
      worker_name: workerName || 'n8n Workflow',
      data: {
        reviewType,
        stepLabel,
        executionId,
      },
    })

    return NextResponse.json({
      reviewId: reviewRequest.id,
      status: 'pending',
      message: 'Review request created successfully',
    })
  } catch (error) {
    console.error('Error in review-request POST:', error)
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
      console.error('Error fetching review request:', error)
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
    console.error('Error in review-request GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
