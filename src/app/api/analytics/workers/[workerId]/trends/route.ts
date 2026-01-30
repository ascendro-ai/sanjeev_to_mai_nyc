import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { WorkerTrendData, MetricDataPoint } from '@/types/analytics'

interface RouteParams {
  params: Promise<{ workerId: string }>
}

/**
 * GET /api/analytics/workers/[workerId]/trends
 * Get time-series trend data for a worker
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
      .select('id, name')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    // First, try to get from pre-aggregated daily metrics
    const { data: dailyMetrics } = await supabase
      .from('worker_daily_metrics')
      .select('*')
      .eq('worker_id', workerId)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    let trendData: WorkerTrendData

    if (dailyMetrics && dailyMetrics.length > 0) {
      // Use pre-aggregated data
      trendData = {
        workerId,
        workerName: worker.name,
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        executions: dailyMetrics.map(m => ({
          date: m.metric_date,
          value: m.total_executions,
        })),
        successRate: dailyMetrics.map(m => ({
          date: m.metric_date,
          value: m.total_executions > 0
            ? Math.round((m.successful_executions / m.total_executions) * 100 * 100) / 100
            : 0,
        })),
        avgDuration: dailyMetrics.map(m => ({
          date: m.metric_date,
          value: m.avg_execution_time_ms || 0,
        })),
        stepsExecuted: dailyMetrics.map(m => ({
          date: m.metric_date,
          value: m.total_steps_executed || 0,
        })),
        reviewsRequested: dailyMetrics.map(m => ({
          date: m.metric_date,
          value: m.total_reviews_requested || 0,
        })),
      }
    } else {
      // Calculate from raw execution data
      const { data: executions } = await supabase
        .from('executions')
        .select('*')
        .eq('worker_id', workerId)
        .gte('created_at', startDate.toISOString())
        .eq('is_test_run', false)
        .order('created_at', { ascending: true })

      // Group by day
      const dailyStats: Record<string, {
        executions: number
        successful: number
        totalDuration: number
        stepsExecuted: number
      }> = {}

      // Initialize all days in range
      for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0]
        dailyStats[dateKey] = {
          executions: 0,
          successful: 0,
          totalDuration: 0,
          stepsExecuted: 0,
        }
      }

      // Aggregate execution data
      for (const exec of executions || []) {
        const dateKey = new Date(exec.created_at).toISOString().split('T')[0]
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].executions++
          if (exec.status === 'completed') {
            dailyStats[dateKey].successful++
          }
          dailyStats[dateKey].totalDuration += exec.duration_ms || 0
          dailyStats[dateKey].stepsExecuted += exec.steps_completed || 0
        }
      }

      // Get review data
      const executionIds = (executions || []).map(e => e.id)
      const { data: reviews } = await supabase
        .from('review_requests')
        .select('id, created_at')
        .in('execution_id', executionIds)

      const reviewsByDay: Record<string, number> = {}
      for (const review of reviews || []) {
        const dateKey = new Date(review.created_at).toISOString().split('T')[0]
        reviewsByDay[dateKey] = (reviewsByDay[dateKey] || 0) + 1
      }

      // Build trend data arrays
      const dates = Object.keys(dailyStats).sort()

      trendData = {
        workerId,
        workerName: worker.name,
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        executions: dates.map(date => ({
          date,
          value: dailyStats[date].executions,
        })),
        successRate: dates.map(date => ({
          date,
          value: dailyStats[date].executions > 0
            ? Math.round((dailyStats[date].successful / dailyStats[date].executions) * 100 * 100) / 100
            : 0,
        })),
        avgDuration: dates.map(date => ({
          date,
          value: dailyStats[date].executions > 0
            ? Math.round(dailyStats[date].totalDuration / dailyStats[date].executions)
            : 0,
        })),
        stepsExecuted: dates.map(date => ({
          date,
          value: dailyStats[date].stepsExecuted,
        })),
        reviewsRequested: dates.map(date => ({
          date,
          value: reviewsByDay[date] || 0,
        })),
      }
    }

    // Calculate moving averages (7-day)
    const calculateMovingAverage = (data: MetricDataPoint[], window: number = 7): MetricDataPoint[] => {
      return data.map((point, index) => {
        const start = Math.max(0, index - window + 1)
        const slice = data.slice(start, index + 1)
        const avg = slice.reduce((sum, p) => sum + p.value, 0) / slice.length
        return { date: point.date, value: Math.round(avg * 100) / 100 }
      })
    }

    return NextResponse.json({
      data: {
        ...trendData,
        movingAverages: {
          executions: calculateMovingAverage(trendData.executions),
          successRate: calculateMovingAverage(trendData.successRate),
          avgDuration: calculateMovingAverage(trendData.avgDuration),
        },
      },
    })
  } catch (error) {
    console.error('Worker trends error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
