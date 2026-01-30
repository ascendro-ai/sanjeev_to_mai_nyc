'use client'

import { useState } from 'react'
import { Download, RefreshCw, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useWorkerAnalytics, useAnalyticsExport } from '@/hooks/useWorkerAnalytics'
import MetricCard from './MetricCard'
import TrendLineChart from './TrendLineChart'
import WorkerComparisonChart, { StackedComparisonChart } from './WorkerComparisonChart'
import WorkloadDistributionPie, { TypeDistribution } from './WorkloadDistributionPie'
import type { DateRangePreset, KPIMetric } from '@/types/analytics'

interface AnalyticsDashboardProps {
  className?: string
}

export default function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRangePreset>('30d')
  const [workerType, setWorkerType] = useState<'all' | 'ai' | 'human'>('all')

  const { workers, summary, isLoading, error, refetch } = useWorkerAnalytics({
    dateRange,
    workerType,
  })

  const { downloadExport, isExporting } = useAnalyticsExport()

  const handleExport = async () => {
    await downloadExport({
      type: 'worker_metrics',
      filters: {
        dateRange,
        workerType,
      },
      format: 'csv',
    })
  }

  // Build KPI metrics from summary
  const kpiMetrics: KPIMetric[] = summary
    ? [
        {
          label: 'Total Executions',
          value: summary.totalExecutions,
          format: 'number',
          status: summary.totalExecutions > 0 ? 'good' : undefined,
        },
        {
          label: 'Avg Success Rate',
          value: summary.avgSuccessRate,
          format: 'percentage',
          status:
            summary.avgSuccessRate >= 90
              ? 'good'
              : summary.avgSuccessRate >= 70
                ? 'warning'
                : 'critical',
        },
        {
          label: 'Active Workers',
          value: summary.activeWorkers,
          format: 'number',
          target: summary.totalWorkers,
        },
        {
          label: 'Avg Execution Time',
          value: summary.avgExecutionTime,
          format: 'duration',
          status:
            summary.avgExecutionTime < 5000
              ? 'good'
              : summary.avgExecutionTime < 15000
                ? 'warning'
                : 'critical',
        },
      ]
    : []

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8">
        <p className="text-red-600 mb-4">
          {error instanceof Error ? error.message : 'Failed to load analytics'}
        </p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
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

          {/* Worker Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={workerType}
              onChange={(e) => setWorkerType(e.target.value as typeof workerType)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Workers</option>
              <option value="ai">AI Only</option>
              <option value="human">Human Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-100 rounded-lg animate-pulse"
              />
            ))
          : kpiMetrics.map((metric, i) => (
              <MetricCard key={i} metric={metric} />
            ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <div className="h-80 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-80 bg-gray-100 rounded-lg animate-pulse" />
          </>
        ) : (
          <>
            <WorkerComparisonChart
              workers={workers}
              metric="successRate"
              title="Success Rate by Worker"
            />
            <StackedComparisonChart
              workers={workers}
              title="Execution Results by Worker"
            />
          </>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <div className="h-80 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-80 bg-gray-100 rounded-lg animate-pulse lg:col-span-2" />
          </>
        ) : (
          <>
            <WorkloadDistributionPie
              workers={workers}
              title="Workload Distribution"
            />
            <div className="lg:col-span-2">
              <TypeDistribution
                workers={workers}
                title="AI vs Human Workload"
              />
            </div>
          </>
        )}
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Worker Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Worker
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Type
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Executions
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Success Rate
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Avg Duration
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  vs Team Avg
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                : workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {worker.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 text-xs rounded-full',
                            worker.type === 'ai'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          )}
                        >
                          {worker.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {worker.totalExecutions30d.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'font-medium',
                            worker.successRate30d >= 90
                              ? 'text-green-600'
                              : worker.successRate30d >= 70
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          )}
                        >
                          {worker.successRate30d.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {worker.avgExecutionTimeMs >= 1000
                          ? `${(worker.avgExecutionTimeMs / 1000).toFixed(1)}s`
                          : `${worker.avgExecutionTimeMs}ms`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'font-medium',
                            worker.vsTeamAvgSuccessRate > 0
                              ? 'text-green-600'
                              : worker.vsTeamAvgSuccessRate < 0
                                ? 'text-red-600'
                                : 'text-gray-500'
                          )}
                        >
                          {worker.vsTeamAvgSuccessRate > 0 ? '+' : ''}
                          {worker.vsTeamAvgSuccessRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
