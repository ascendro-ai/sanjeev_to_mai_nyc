'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import type {
  WorkerAnalytics,
  WorkerTrendData,
  AnalyticsFilters,
  AnalyticsExportRequest,
  AnalyticsExportResponse,
  DateRangePreset,
} from '@/types/analytics'

interface UseWorkerAnalyticsOptions {
  dateRange?: DateRangePreset
  workerType?: 'ai' | 'human' | 'all'
  status?: string[]
  enabled?: boolean
}

interface WorkerAnalyticsResponse {
  data: WorkerAnalytics[]
  summary: {
    totalWorkers: number
    activeWorkers: number
    totalExecutions: number
    avgSuccessRate: number
    avgExecutionTime: number
  }
  dateRange: {
    start: string
    end: string
    days: number
  }
}

/**
 * Hook for fetching worker analytics
 */
export function useWorkerAnalytics(options: UseWorkerAnalyticsOptions = {}) {
  const { dateRange = '30d', workerType, status, enabled = true } = options

  // Build query params
  const buildQueryParams = () => {
    const params = new URLSearchParams()
    params.set('dateRange', dateRange)
    if (workerType && workerType !== 'all') params.set('workerType', workerType)
    if (status?.length) params.set('status', status.join(','))
    return params.toString()
  }

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['worker-analytics', dateRange, workerType, status],
    queryFn: async (): Promise<WorkerAnalyticsResponse> => {
      const response = await fetch(`/api/analytics/workers?${buildQueryParams()}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch worker analytics')
      }
      return response.json()
    },
    enabled,
    staleTime: 60000, // 1 minute
  })

  return {
    workers: data?.data || [],
    summary: data?.summary,
    dateRange: data?.dateRange,
    isLoading,
    error,
    refetch,
  }
}

interface WorkerDetailResponse {
  data: {
    worker: {
      id: string
      name: string
      type: string
      status: string
      description?: string
      createdAt: string
    }
    analytics: WorkerAnalytics
    recentExecutions: Array<{
      id: string
      workflowId: string
      status: string
      durationMs: number
      createdAt: string
      completedAt?: string
    }>
    workflowStats: Array<{
      workflowId: string
      workflowName: string
      count: number
      successful: number
      failed: number
      successRate: number
    }>
    reviewStats: {
      total: number
      approved: number
      rejected: number
      approvalRate: number
    }
    topErrors: Array<{
      message: string
      count: number
    }>
    assignedWorkflows: Array<{
      workflowId: string
      workflowName: string
      isActive: boolean
      assignedAt: string
    }>
  }
  dateRange: {
    start: string
    end: string
    days: number
  }
}

/**
 * Hook for fetching detailed analytics for a single worker
 */
export function useWorkerDetail(workerId: string | null, dateRange: DateRangePreset = '30d') {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['worker-detail', workerId, dateRange],
    queryFn: async (): Promise<WorkerDetailResponse> => {
      const response = await fetch(`/api/analytics/workers/${workerId}?dateRange=${dateRange}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch worker details')
      }
      return response.json()
    },
    enabled: !!workerId,
    staleTime: 60000,
  })

  return {
    worker: data?.data?.worker,
    analytics: data?.data?.analytics,
    recentExecutions: data?.data?.recentExecutions || [],
    workflowStats: data?.data?.workflowStats || [],
    reviewStats: data?.data?.reviewStats,
    topErrors: data?.data?.topErrors || [],
    assignedWorkflows: data?.data?.assignedWorkflows || [],
    dateRange: data?.dateRange,
    isLoading,
    error,
    refetch,
  }
}

interface WorkerTrendsResponse {
  data: WorkerTrendData & {
    movingAverages: {
      executions: Array<{ date: string; value: number }>
      successRate: Array<{ date: string; value: number }>
      avgDuration: Array<{ date: string; value: number }>
    }
  }
}

/**
 * Hook for fetching worker trend data
 */
export function useWorkerTrends(workerId: string | null, dateRange: DateRangePreset = '30d') {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['worker-trends', workerId, dateRange],
    queryFn: async (): Promise<WorkerTrendsResponse> => {
      const response = await fetch(`/api/analytics/workers/${workerId}/trends?dateRange=${dateRange}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch worker trends')
      }
      return response.json()
    },
    enabled: !!workerId,
    staleTime: 60000,
  })

  return {
    trends: data?.data,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for exporting analytics data
 */
export function useAnalyticsExport() {
  const exportMutation = useMutation({
    mutationFn: async (request: AnalyticsExportRequest): Promise<AnalyticsExportResponse> => {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to export analytics')
      }
      const result = await response.json()
      return result.data
    },
  })

  // Helper to download the exported file
  const downloadExport = async (request: AnalyticsExportRequest) => {
    const result = await exportMutation.mutateAsync(request)

    // Create a blob and trigger download
    const blob = new Blob([result.data], { type: result.mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return result
  }

  return {
    exportAnalytics: exportMutation.mutateAsync,
    downloadExport,
    isExporting: exportMutation.isPending,
    exportError: exportMutation.error,
  }
}
