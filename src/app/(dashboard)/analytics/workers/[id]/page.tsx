'use client'

import { use, useState } from 'react'
import { ArrowLeft, Bot, User, Calendar, Download, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useWorkerDetail, useWorkerTrends, useAnalyticsExport } from '@/hooks/useWorkerAnalytics'
import MetricCard from '@/components/analytics/MetricCard'
import TrendLineChart from '@/components/analytics/TrendLineChart'
import type { DateRangePreset, KPIMetric } from '@/types/analytics'

interface WorkerAnalyticsPageProps {
  params: Promise<{ id: string }>
}

export default function WorkerAnalyticsPage({ params }: WorkerAnalyticsPageProps) {
  const { id } = use(params)
  const [dateRange, setDateRange] = useState<DateRangePreset>('30d')

  const {
    worker,
    analytics,
    recentExecutions,
    workflowStats,
    reviewStats,
    topErrors,
    assignedWorkflows,
    isLoading,
    error,
    refetch,
  } = useWorkerDetail(id, dateRange)

  const { trends } = useWorkerTrends(id, dateRange)

  const { downloadExport, isExporting } = useAnalyticsExport()

  const handleExport = async () => {
    await downloadExport({
      type: 'worker_metrics',
      filters: { dateRange },
      format: 'csv',
      workerIds: [id],
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (error || !worker) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {error instanceof Error ? error.message : 'Worker not found'}
        </h2>
        <Link href="/analytics">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Analytics
          </Button>
        </Link>
      </div>
    )
  }

  // Build KPI metrics
  const kpiMetrics: KPIMetric[] = analytics
    ? [
        {
          label: 'Total Executions',
          value: analytics.totalExecutions30d,
          format: 'number',
        },
        {
          label: 'Success Rate',
          value: analytics.successRate30d,
          format: 'percentage',
          status:
            analytics.successRate30d >= 90
              ? 'good'
              : analytics.successRate30d >= 70
                ? 'warning'
                : 'critical',
        },
        {
          label: 'Avg Execution Time',
          value: analytics.avgExecutionTimeMs,
          format: 'duration',
        },
        {
          label: 'Review Approval Rate',
          value: analytics.reviewApprovalRate,
          format: 'percentage',
          status:
            analytics.reviewApprovalRate >= 80
              ? 'good'
              : analytics.reviewApprovalRate >= 60
                ? 'warning'
                : 'critical',
        },
      ]
    : []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/analytics">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  worker.type === 'ai' ? 'bg-blue-100' : 'bg-purple-100'
                )}
              >
                {worker.type === 'ai' ? (
                  <Bot className="h-6 w-6 text-blue-600" />
                ) : (
                  <User className="h-6 w-6 text-purple-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {worker.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full capitalize',
                      worker.type === 'ai'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    )}
                  >
                    {worker.type}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full capitalize',
                      worker.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : worker.status === 'error'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {worker.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="14d">Last 14 days</option>
                <option value="30d">Last 30 days</option>
                <option value="60d">Last 60 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiMetrics.map((metric, i) => (
            <MetricCard key={i} metric={metric} />
          ))}
        </div>

        {/* Trend Charts */}
        {trends && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendLineChart
              data={trends.executions}
              title="Executions Over Time"
              color="#3b82f6"
              showMovingAverage
              movingAverageData={trends.movingAverages?.executions}
            />
            <TrendLineChart
              data={trends.successRate}
              title="Success Rate Over Time"
              color="#22c55e"
              formatValue={(v) => `${v.toFixed(1)}%`}
              showMovingAverage
              movingAverageData={trends.movingAverages?.successRate}
            />
          </div>
        )}

        {/* Workflow Performance */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">
              Performance by Workflow
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Workflow
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Executions
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Successful
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Failed
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Success Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workflowStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No workflow data available
                    </td>
                  </tr>
                ) : (
                  workflowStats.map((stat) => (
                    <tr key={stat.workflowId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {stat.workflowName}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {stat.count}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {stat.successful}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {stat.failed}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'font-medium',
                            stat.successRate >= 90
                              ? 'text-green-600'
                              : stat.successRate >= 70
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          )}
                        >
                          {stat.successRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Errors */}
        {topErrors.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">
                Top Errors
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {topErrors.map((error, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                >
                  <span className="text-sm text-red-700 truncate flex-1">
                    {error.message}
                  </span>
                  <span className="text-sm font-medium text-red-600 ml-4">
                    {error.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Executions */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">
              Recent Executions
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentExecutions.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No recent executions
              </div>
            ) : (
              recentExecutions.map((exec) => (
                <div
                  key={exec.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        exec.status === 'completed'
                          ? 'bg-green-500'
                          : exec.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                      )}
                    />
                    <span className="text-sm text-gray-900">
                      {exec.workflowId.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {exec.durationMs && (
                      <span>
                        {exec.durationMs >= 1000
                          ? `${(exec.durationMs / 1000).toFixed(1)}s`
                          : `${exec.durationMs}ms`}
                      </span>
                    )}
                    <span>{new Date(exec.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
