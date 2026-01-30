import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WorkerAnalytics, AnalyticsFilters } from '@/types/analytics'

/**
 * GET /api/analytics/workers
 * Get all workers with analytics metrics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params for filters
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('dateRange') || '30d'
    const workerType = searchParams.get('workerType')
    const status = searchParams.get('status')?.split(',').filter(Boolean)

    // Calculate date range
    const days = parseInt(dateRange.replace('d', '')) || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get workers with their performance summary
    const { data: workers, error: workersError } = await supabase
      .from('digital_workers')
      .select(`
        id,
        name,
        type,
        status,
        organization_id,
        description,
        created_at
      `)

    if (workersError) {
      console.error('Failed to fetch workers:', workersError)
      return NextResponse.json({ error: workersError.message }, { status: 500 })
    }

    // Get execution stats for each worker
    const workerAnalytics: WorkerAnalytics[] = await Promise.all(
      (workers || []).map(async (worker) => {
        // Get execution counts
        const { data: executions, error: execError } = await supabase
          .from('executions')
          .select('id, status, duration_ms, created_at')
          .eq('worker_id', worker.id)
          .gte('created_at', startDate.toISOString())
          .eq('is_test_run', false)

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
          .select('id, status')
          .in('execution_id', executionList.map(e => e.id))

        const reviewList = reviews || []
        const reviewsRequested = reviewList.length
        const reviewsApproved = reviewList.filter(r => r.status === 'approved').length
        const reviewApprovalRate = reviewsRequested > 0
          ? Math.round((reviewsApproved / reviewsRequested) * 100 * 100) / 100
          : 0

        // Get workflow assignments
        const { count: assignedWorkflows } = await supabase
          .from('worker_workflow_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('worker_id', worker.id)

        const { count: activeWorkflows } = await supabase
          .from('worker_workflow_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('worker_id', worker.id)
          .eq('is_active', true)

        // Get last execution timestamp
        const lastExecution = executionList.length > 0
          ? new Date(executionList[0].created_at)
          : undefined

        return {
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
          lastExecutionAt: lastExecution,
          executionTrend: 'stable' as const, // Would need historical comparison
          successRateTrend: 'stable' as const,
          vsTeamAvgSuccessRate: 0, // Calculated below
          vsTeamAvgExecutions: 0,
          reviewsRequested30d: reviewsRequested,
          reviewApprovalRate,
          assignedWorkflowCount: assignedWorkflows || 0,
          activeWorkflowCount: activeWorkflows || 0,
        }
      })
    )

    // Calculate team averages
    const teamAvgSuccessRate = workerAnalytics.length > 0
      ? workerAnalytics.reduce((sum, w) => sum + w.successRate30d, 0) / workerAnalytics.length
      : 0
    const teamAvgExecutions = workerAnalytics.length > 0
      ? workerAnalytics.reduce((sum, w) => sum + w.totalExecutions30d, 0) / workerAnalytics.length
      : 0

    // Update relative metrics
    const analyticsWithComparisons = workerAnalytics.map(w => ({
      ...w,
      vsTeamAvgSuccessRate: Math.round((w.successRate30d - teamAvgSuccessRate) * 100) / 100,
      vsTeamAvgExecutions: teamAvgExecutions > 0
        ? Math.round(((w.totalExecutions30d - teamAvgExecutions) / teamAvgExecutions) * 100)
        : 0,
    }))

    // Apply filters
    let filteredAnalytics = analyticsWithComparisons
    if (workerType && workerType !== 'all') {
      filteredAnalytics = filteredAnalytics.filter(w => w.type === workerType)
    }
    if (status && status.length > 0) {
      filteredAnalytics = filteredAnalytics.filter(w => status.includes(w.status))
    }

    // Calculate summary metrics
    const summary = {
      totalWorkers: filteredAnalytics.length,
      activeWorkers: filteredAnalytics.filter(w => w.status === 'active').length,
      totalExecutions: filteredAnalytics.reduce((sum, w) => sum + w.totalExecutions30d, 0),
      avgSuccessRate: teamAvgSuccessRate,
      avgExecutionTime: filteredAnalytics.length > 0
        ? Math.round(filteredAnalytics.reduce((sum, w) => sum + w.avgExecutionTimeMs, 0) / filteredAnalytics.length)
        : 0,
    }

    return NextResponse.json({
      data: filteredAnalytics,
      summary,
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
    })
  } catch (error) {
    console.error('Worker analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
