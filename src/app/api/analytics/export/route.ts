import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AnalyticsExportRequest, ExportFormat } from '@/types/analytics'

/**
 * POST /api/analytics/export
 * Export analytics data in various formats
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // A4 fix: Get user's organization for permission filtering
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 })
    }

    const organizationId = membership.organization_id

    const body: AnalyticsExportRequest = await request.json()
    const { type, filters, format, workerIds } = body

    // Calculate date range
    const days = parseInt(filters.dateRange.replace('d', '')) || 30
    const startDate = filters.startDate
      ? new Date(filters.startDate)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date()

    let data: Record<string, unknown>[] = []
    let filename = ''

    switch (type) {
      case 'worker_metrics': {
        // Get worker metrics (A4 fix: filter by organization)
        let query = supabase
          .from('digital_workers')
          .select('*')
          .eq('organization_id', organizationId) // A4 fix: org filter

        if (workerIds && workerIds.length > 0) {
          query = query.in('id', workerIds)
        }

        if (filters.workerType && filters.workerType !== 'all') {
          query = query.eq('type', filters.workerType)
        }

        const { data: workers, error: workersError } = await query

        // A6 fix: Handle query errors
        if (workersError) {
          console.error('Failed to fetch workers for export:', workersError)
          return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
        }

        // A5 fix: Batch fetch all executions for workers to avoid N+1
        const workerIdList = (workers || []).map(w => w.id)
        const { data: allExecutions, error: execError } = await supabase
          .from('executions')
          .select('worker_id, status, duration_ms')
          .in('worker_id', workerIdList)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .eq('is_test_run', false)

        // A6 fix: Handle query errors
        if (execError) {
          console.error('Failed to fetch executions for export:', execError)
          return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 })
        }

        // Group executions by worker_id
        const execsByWorker = (allExecutions || []).reduce((acc, exec) => {
          if (!acc[exec.worker_id]) acc[exec.worker_id] = []
          acc[exec.worker_id].push(exec)
          return acc
        }, {} as Record<string, typeof allExecutions>)

        // Process each worker
        for (const worker of workers || []) {
          const executions = execsByWorker[worker.id] || []
          const total = executions.length
          const successful = executions.filter(e => e.status === 'completed').length
          const failed = executions.filter(e => e.status === 'failed').length
          const avgDuration = total > 0
            ? Math.round(executions.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / total)
            : 0

          data.push({
            worker_id: worker.id,
            worker_name: worker.name,
            worker_type: worker.type,
            status: worker.status,
            total_executions: total,
            successful_executions: successful,
            failed_executions: failed,
            success_rate: total > 0 ? Math.round((successful / total) * 100 * 100) / 100 : 0,
            avg_duration_ms: avgDuration,
            period_start: startDate.toISOString(),
            period_end: endDate.toISOString(),
          })
        }

        filename = `worker_metrics_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
        break
      }

      case 'trend_data': {
        // Get daily metrics
        const { data: metrics } = await supabase
          .from('worker_daily_metrics')
          .select('*, digital_workers(name)')
          .gte('metric_date', startDate.toISOString().split('T')[0])
          .lte('metric_date', endDate.toISOString().split('T')[0])
          .order('metric_date', { ascending: true })

        data = (metrics || []).map(m => ({
          date: m.metric_date,
          worker_id: m.worker_id,
          worker_name: (m.digital_workers as { name: string })?.name || 'Unknown',
          total_executions: m.total_executions,
          successful_executions: m.successful_executions,
          failed_executions: m.failed_executions,
          avg_execution_time_ms: m.avg_execution_time_ms,
          total_steps_executed: m.total_steps_executed,
          reviews_requested: m.total_reviews_requested,
          reviews_approved: m.reviews_approved,
          reviews_rejected: m.reviews_rejected,
        }))

        filename = `trend_data_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
        break
      }

      case 'team_analytics': {
        // A4/A5/A6 fix: Get aggregated team metrics with org filter and batch query
        const { data: workers, error: workersError } = await supabase
          .from('digital_workers')
          .select('id, name, type, status')
          .eq('organization_id', organizationId) // A4 fix: org filter

        if (workersError) {
          console.error('Failed to fetch workers for team analytics:', workersError)
          return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
        }

        const workerIdList = (workers || []).map(w => w.id)

        // A5 fix: Single batch query instead of N+1
        const { data: allExecutions, error: execError } = await supabase
          .from('executions')
          .select('status, duration_ms')
          .in('worker_id', workerIdList)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .eq('is_test_run', false)

        if (execError) {
          console.error('Failed to fetch executions for team analytics:', execError)
          return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 })
        }

        const execList = allExecutions || []
        const totalExecutions = execList.length
        const totalSuccessful = execList.filter(e => e.status === 'completed').length
        const totalFailed = execList.filter(e => e.status === 'failed').length
        const totalDuration = execList.reduce((sum, e) => sum + (e.duration_ms || 0), 0)

        data = [{
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          total_workers: workers?.length || 0,
          active_workers: workers?.filter(w => w.status === 'active').length || 0,
          total_executions: totalExecutions,
          successful_executions: totalSuccessful,
          failed_executions: totalFailed,
          success_rate: totalExecutions > 0 ? Math.round((totalSuccessful / totalExecutions) * 100 * 100) / 100 : 0,
          avg_execution_time_ms: totalExecutions > 0 ? Math.round(totalDuration / totalExecutions) : 0,
        }]

        filename = `team_analytics_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }

    // Format output
    let output: string
    let mimeType: string

    switch (format) {
      case 'csv':
        output = convertToCSV(data)
        mimeType = 'text/csv'
        filename += '.csv'
        break

      case 'json':
        output = JSON.stringify(data, null, 2)
        mimeType = 'application/json'
        filename += '.json'
        break

      default:
        return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })
    }

    return NextResponse.json({
      data: {
        filename,
        mimeType,
        data: output,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Analytics export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return String(value)
    }).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}
