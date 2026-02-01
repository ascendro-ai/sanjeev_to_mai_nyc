/**
 * Stale Review Cleanup Endpoint (4.4 / N8 fix)
 *
 * This endpoint should be called periodically (via cron job or n8n scheduled workflow)
 * to expire stale review requests and mark related executions as failed.
 */

import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateWebhookRequest } from '@/lib/n8n/webhook-auth'

/**
 * POST /api/n8n/cleanup
 *
 * Expire stale reviews and update related executions.
 * Should be called periodically (e.g., every hour).
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature for security
    const validation = await validateWebhookRequest(request)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    const now = new Date().toISOString()

    // Find and expire stale pending reviews
    const { data: expiredReviews, error: updateError } = await supabase
      .from('review_requests')
      .update({
        status: 'expired',
        reviewed_at: now,
        feedback: 'Automatically expired due to timeout',
      })
      .eq('status', 'pending')
      .lt('timeout_at', now)
      .select('id, execution_id')

    if (updateError) {
      logger.error('Error expiring reviews:', updateError)
      throw updateError
    }

    // Update related executions to failed status
    const executionUpdates = []
    for (const review of expiredReviews || []) {
      executionUpdates.push(
        supabase
          .from('executions')
          .update({
            status: 'failed',
            error: 'Review request timed out',
            completed_at: now,
          })
          .eq('id', review.execution_id)
          .eq('status', 'waiting_review')
      )
    }

    await Promise.all(executionUpdates)

    // Also clean up any stuck executions that have been waiting too long
    // (e.g., executions waiting for reviews that were never created)
    const staleThreshold = new Date()
    staleThreshold.setHours(staleThreshold.getHours() - 168) // 7 days

    const { data: staleExecutions, error: staleError } = await supabase
      .from('executions')
      .update({
        status: 'failed',
        error: 'Execution timed out - stuck in waiting state',
        completed_at: now,
      })
      .eq('status', 'waiting_review')
      .lt('created_at', staleThreshold.toISOString())
      .select('id')

    if (staleError) {
      logger.warn('Error cleaning up stale executions:', staleError)
    }

    // Log cleanup activity
    await supabase.from('activity_logs').insert({
      type: 'debug_analysis',
      worker_name: 'System Cleanup',
      data: {
        expiredReviewCount: expiredReviews?.length || 0,
        staleExecutionCount: staleExecutions?.length || 0,
        cleanupTime: now,
      },
    })

    logger.info('Cleanup completed', {
      expiredReviews: expiredReviews?.length || 0,
      staleExecutions: staleExecutions?.length || 0,
    })

    return NextResponse.json({
      success: true,
      expiredReviewCount: expiredReviews?.length || 0,
      staleExecutionCount: staleExecutions?.length || 0,
      message: `Cleaned up ${expiredReviews?.length || 0} expired reviews and ${staleExecutions?.length || 0} stale executions`,
    })
  } catch (error) {
    logger.error('Error in cleanup:', error)
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/n8n/cleanup
 *
 * Get cleanup status and statistics.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get counts of reviews by status
    const { data: reviewStats } = await supabase
      .from('review_requests')
      .select('status')

    const statusCounts = (reviewStats || []).reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Get count of pending reviews that will expire soon (within 24 hours)
    const soonThreshold = new Date()
    soonThreshold.setHours(soonThreshold.getHours() + 24)

    const { count: expiringSoon } = await supabase
      .from('review_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('timeout_at', soonThreshold.toISOString())

    return NextResponse.json({
      reviewStatusCounts: statusCounts,
      expiringSoon24h: expiringSoon || 0,
      lastChecked: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error getting cleanup status:', error)
    return NextResponse.json(
      { error: 'Failed to get cleanup status' },
      { status: 500 }
    )
  }
}
