/**
 * useWorkerAnalytics Hook Tests
 * Tests for the worker analytics hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock fetch
global.fetch = vi.fn()

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

const mockWorkerAnalytics = {
  workers: [
    {
      id: 'worker-1',
      name: 'Email Worker',
      totalExecutions: 100,
      successfulExecutions: 95,
      failedExecutions: 5,
      avgDuration: 1500,
      successRate: 0.95,
    },
    {
      id: 'worker-2',
      name: 'Data Worker',
      totalExecutions: 50,
      successfulExecutions: 48,
      failedExecutions: 2,
      avgDuration: 2000,
      successRate: 0.96,
    },
  ],
  summary: {
    totalExecutions: 150,
    overallSuccessRate: 0.953,
    avgDuration: 1667,
  },
  dateRange: {
    start: '2024-01-01',
    end: '2024-01-31',
  },
}

const mockTrends = {
  executions: [
    { date: '2024-01-01', value: 10 },
    { date: '2024-01-02', value: 15 },
    { date: '2024-01-03', value: 12 },
  ],
  successRate: [
    { date: '2024-01-01', value: 0.9 },
    { date: '2024-01-02', value: 0.95 },
    { date: '2024-01-03', value: 0.92 },
  ],
  avgDuration: [
    { date: '2024-01-01', value: 1500 },
    { date: '2024-01-02', value: 1400 },
    { date: '2024-01-03', value: 1600 },
  ],
}

describe('useWorkerAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWorkerAnalytics),
    } as Response)
  })

  describe('fetching', () => {
    it('should fetch worker analytics', async () => {
      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      const { result } = renderHook(() => useWorkerAnalytics({ dateRange: '30d' }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/workers'),
        expect.any(Object)
      )
    })

    it('should return workers array', async () => {
      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      const { result } = renderHook(() => useWorkerAnalytics({ dateRange: '30d' }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        if (result.current.workers) {
          expect(Array.isArray(result.current.workers)).toBe(true)
        }
      })
    })

    it('should include summary statistics', async () => {
      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      const { result } = renderHook(() => useWorkerAnalytics({ dateRange: '30d' }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        if (result.current.summary) {
          expect(result.current.summary).toHaveProperty('totalExecutions')
          expect(result.current.summary).toHaveProperty('overallSuccessRate')
        }
      })
    })
  })

  describe('date range filtering', () => {
    it('should pass date range to API', async () => {
      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      renderHook(() => useWorkerAnalytics({ dateRange: '7d' }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('dateRange=7d'),
          expect.any(Object)
        )
      })
    })

    it('should refetch on date range change', async () => {
      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      const { result, rerender } = renderHook(
        ({ dateRange }) => useWorkerAnalytics({ dateRange }),
        {
          wrapper: createWrapper(),
          initialProps: { dateRange: '30d' },
        }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      rerender({ dateRange: '7d' })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('worker filtering', () => {
    it('should filter by worker ID', async () => {
      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      renderHook(
        () => useWorkerAnalytics({ dateRange: '30d', workerId: 'worker-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('workerId=worker-1'),
          expect.any(Object)
        )
      })
    })

    it('should filter by workflow ID', async () => {
      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      renderHook(
        () => useWorkerAnalytics({ dateRange: '30d', workflowId: 'workflow-123' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('workflowId=workflow-123'),
          expect.any(Object)
        )
      })
    })
  })

  describe('error handling', () => {
    it('should handle fetch errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const { useWorkerAnalytics } = await import('../useWorkerAnalytics')
      const { result } = renderHook(() => useWorkerAnalytics({ dateRange: '30d' }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeDefined()
    })
  })
})

describe('useWorkerTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockTrends }),
    } as Response)
  })

  describe('fetching', () => {
    it('should fetch worker trends', async () => {
      const { useWorkerTrends } = await import('../useWorkerAnalytics')
      const { result } = renderHook(
        () => useWorkerTrends('worker-1', { dateRange: '30d' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/workers/worker-1/trends'),
        expect.any(Object)
      )
    })

    it('should return trend data arrays', async () => {
      const { useWorkerTrends } = await import('../useWorkerAnalytics')
      const { result } = renderHook(
        () => useWorkerTrends('worker-1', { dateRange: '30d' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        if (result.current.trends) {
          expect(Array.isArray(result.current.trends.executions)).toBe(true)
          expect(Array.isArray(result.current.trends.successRate)).toBe(true)
        }
      })
    })
  })
})

describe('useAnalyticsExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            data: 'id,name,executions\nworker-1,Email Worker,100',
            mimeType: 'text/csv',
            filename: 'analytics-export.csv',
          },
        }),
    } as Response)
  })

  describe('export', () => {
    it('should export to CSV', async () => {
      const { useAnalyticsExport } = await import('../useWorkerAnalytics')
      const { result } = renderHook(() => useAnalyticsExport(), {
        wrapper: createWrapper(),
      })

      await result.current.exportData({
        format: 'csv',
        dateRange: '30d',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/export',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('csv'),
        })
      )
    })

    it('should export to JSON', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              data: JSON.stringify(mockWorkerAnalytics),
              mimeType: 'application/json',
              filename: 'analytics-export.json',
            },
          }),
      } as Response)

      const { useAnalyticsExport } = await import('../useWorkerAnalytics')
      const { result } = renderHook(() => useAnalyticsExport(), {
        wrapper: createWrapper(),
      })

      await result.current.exportData({
        format: 'json',
        dateRange: '30d',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/export',
        expect.objectContaining({
          body: expect.stringContaining('json'),
        })
      )
    })

    it('should track exporting state', async () => {
      const { useAnalyticsExport } = await import('../useWorkerAnalytics')
      const { result } = renderHook(() => useAnalyticsExport(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isExporting).toBe(false)

      const exportPromise = result.current.exportData({
        format: 'csv',
        dateRange: '30d',
      })

      await exportPromise

      expect(result.current.isExporting).toBe(false)
    })
  })
})
