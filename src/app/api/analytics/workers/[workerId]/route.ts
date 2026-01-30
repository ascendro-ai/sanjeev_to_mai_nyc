import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WorkerAnalytics } from '@/types/analytics'

interface RouteParams {
  params: Promise<{ workerId: string }>
}

/**
 * GET /api/analytics/workers/[workerId]
 * Get detailed analytics for a single worker
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workerId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('dateRange') || '30d'
    const days = parseInt(dateRange.replace('d', '')) || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get worker details
    const { data: worker, error: workerError } = await supabase
      .from('digital_workers')
      .select('*')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    // Get executions for this worker
    const { data: executions } = await supabase
      .from('executions')
      .select('*')
      .eq('worker_id', workerId)
      .gte('created_at', startDate.toISOString())
      .eq('is_test_run', false)
      .order('created_at', { ascending: false })

    const executionList = executions || []
    const totalExecutions = executionList.length
    const successfulExecutions = executionList.filter(e => e.status === 'completed').length
    const failedExecutions = executionList.filter(e => e.status === 'failed').length
    const avgDuration = totalExecutions > 0
      ? Math.round(executionList.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / totalExecutions)
      : 0
    const successRate = totalExecutions > 0
      ? Math.round((successfulExecutions / totalExecutions) * 100 * 100) / 100
      : 0

    // Get review stats
    const { data: reviews } = await supabase
      .from('review_requests')
      .select('*')
      .in('execution_id', executionList.map(e => e.id))

    const reviewList = reviews || []
    const reviewsRequested = reviewList.length
    const reviewsApproved = reviewList.filter(r => r.status === 'approved').length
    const reviewsRejected = reviewList.filter(r => r.status === 'rejected').length
    const reviewApprovalRate = reviewsRequested > 0
      ? Math.round((reviewsApproved / reviewsRequested) * 100 * 100) / 100
      : 0

    // Get workflow assignments
    const { data: assignments } = await supabase
      .from('worker_workflow_assignments')
      .select('*, workflows(id, name, status)')
      .eq('worker_id', workerId)

    const assignedWorkflows = assignments || []
    const activeWorkflows = assignedWorkflows.filter(a => a.is_active)

    // Get recent activity
    const recentExecutions = executionList.slice(0, 10).map(e => ({
      id: e.id,
      workflowId: e.workflow_id,
      status: e.status,
      durationMs: e.duration_ms,
      createdAt: e.created_at,
      completedAt: e.completed_at,
    }))

    // Get execution breakdown by workflow
    const workflowBreakdown: Record<string, { count: number; successful: number; failed: number }> = {}
    for (const exec of executionList) {
      if (!workflowBreakdown[exec.workflow_id]) {
        workflowBreakdown[exec.workflow_id] = { count: 0, successful: 0, failed: 0 }
      }
      workflowBreakdown[exec.workflow_id].count++
      if (exec.status === 'completed') workflowBreakdown[exec.workflow_id].successful++
      if (exec.status === 'failed') workflowBreakdown[exec.workflow_id].failed++
    }

    // Get workflow names for the breakdown
    const workflowIds = Object.keys(workflowBreakdown)
    const { data: workflows } = await supabase
      .from('workflows')
      .select('id, name')
      .in('id', workflowIds)

    const workflowMap = new Map((workflows || []).map(w => [w.id, w.name]))
    const workflowStats = Object.entries(workflowBreakdown).map(([id, stats]) => ({
      workflowId: id,
      workflowName: workflowMap.get(id) || 'Unknown',
      ...stats,
      successRate: stats.count > 0 ? Math.round((stats.successful / stats.count) * 100) : 0,
    }))

    // Calculate error patterns
    const errors = executionList.filter(e => e.error).map(e => e.error)
    const errorPatterns = errors.reduce((acc: Record<string, number>, error) => {
      const key = error?.substring(0, 50) || 'Unknown error'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const topErrors = Object.entries(errorPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }))

    const analytics: WorkerAnalytics = {
      id: worker.id,
      name: worker.name,
      type: worker.type,
      status: worker.status,
      organizationId: worker.organization_id,
      totalExecutions30d: totalExecutions,
      successful30d: successfulExecutions,
      failed30d: failedExecutions,
      successRate30d: successRate,
      avgExecutionTimeMs: avgDuration,
      lastExecutionAt: executionList[0]?.created_at ? new Date(executionList[0].created_at) : undefined,
      executionTrend: 'stable',
      successRateTrend: 'stable',
      vsTeamAvgSuccessRate: 0,
      vsTeamAvgExecutions: 0,
      reviewsRequested30d: reviewsRequested,
      reviewApprovalRate,
      assignedWorkflowCount: assignedWorkflows.length,
      activeWorkflowCount: activeWorkflows.length,
    }

    return NextResponse.json({
      data: {
        worker: {
          id: worker.id,
          name: worker.name,
          type: worker.type,
          status: worker.status,
          description: worker.description,
          createdAt: worker.created_at,
        },
        analytics,
        recentExecutions,
        workflowStats,
        reviewStats: {
          total: reviewsRequested,
          approved: reviewsApproved,
          rejected: reviewsRejected,
          approvalRate: reviewApprovalRate,
        },
        topErrors,
        assignedWorkflows: assignedWorkflows.map(a => ({
          workflowId: a.workflow_id,
          workflowName: (a.workflows as { name: string })?.name || 'Unknown',
          isActive: a.is_active,
          assignedAt: a.assigned_at,
        })),
      },
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
    })
  } catch (error) {
    console.error('Worker detail analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
