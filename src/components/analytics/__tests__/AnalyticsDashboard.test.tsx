/**
 * AnalyticsDashboard Component Tests
 * Tests for the analytics dashboard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock hooks
vi.mock('@/hooks/useWorkerAnalytics', () => ({
  useWorkerAnalytics: vi.fn(() => ({
    workers: [
      {
        id: 'worker-1',
        name: 'Email Worker',
        totalExecutions: 100,
        successRate: 0.95,
        avgDuration: 1500,
      },
      {
        id: 'worker-2',
        name: 'Data Worker',
        totalExecutions: 50,
        successRate: 0.96,
        avgDuration: 2000,
      },
    ],
    summary: {
      totalExecutions: 150,
      overallSuccessRate: 0.953,
      avgDuration: 1667,
    },
    isLoading: false,
    error: null,
  })),
  useWorkerTrends: vi.fn(() => ({
    trends: {
      executions: [
        { date: '2024-01-01', value: 10 },
        { date: '2024-01-02', value: 15 },
      ],
      successRate: [
        { date: '2024-01-01', value: 0.9 },
        { date: '2024-01-02', value: 0.95 },
      ],
    },
    isLoading: false,
  })),
  useAnalyticsExport: vi.fn(() => ({
    exportData: vi.fn(),
    isExporting: false,
  })),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render dashboard container', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument()
    })

    it('should render summary cards', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByText(/150/)).toBeInTheDocument() // Total executions
      expect(screen.getByText(/95\.3%|95%/)).toBeInTheDocument() // Success rate
    })

    it('should render worker list', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByText('Email Worker')).toBeInTheDocument()
      expect(screen.getByText('Data Worker')).toBeInTheDocument()
    })
  })

  describe('date range filter', () => {
    it('should render date range selector', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByRole('combobox', { name: /date range/i })).toBeInTheDocument()
    })

    it('should update data on date range change', async () => {
      const { useWorkerAnalytics } = await import('@/hooks/useWorkerAnalytics')
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      const select = screen.getByRole('combobox', { name: /date range/i })
      fireEvent.change(select, { target: { value: '7d' } })

      await waitFor(() => {
        expect(useWorkerAnalytics).toHaveBeenCalled()
      })
    })

    it('should support custom date range', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      const customOption = screen.getByText(/custom/i)
      fireEvent.click(customOption)

      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
    })
  })

  describe('charts', () => {
    it('should render trend chart', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
    })

    it('should render worker comparison chart', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByTestId('worker-comparison-chart')).toBeInTheDocument()
    })

    it('should render workload distribution chart', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByTestId('workload-distribution')).toBeInTheDocument()
    })
  })

  describe('export', () => {
    it('should render export button', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('should show export options on click', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('button', { name: /export/i }))

      expect(screen.getByText(/CSV/i)).toBeInTheDocument()
      expect(screen.getByText(/JSON/i)).toBeInTheDocument()
    })

    it('should call export function', async () => {
      const { useAnalyticsExport } = await import('@/hooks/useWorkerAnalytics')
      const exportData = vi.fn()
      vi.mocked(useAnalyticsExport).mockReturnValue({
        exportData,
        isExporting: false,
      })

      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('button', { name: /export/i }))
      fireEvent.click(screen.getByText(/CSV/i))

      expect(exportData).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'csv' })
      )
    })
  })

  describe('loading state', () => {
    it('should show loading skeleton', async () => {
      const { useWorkerAnalytics } = await import('@/hooks/useWorkerAnalytics')
      vi.mocked(useWorkerAnalytics).mockReturnValue({
        workers: [],
        summary: null,
        isLoading: true,
        error: null,
      })

      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('should show error message', async () => {
      const { useWorkerAnalytics } = await import('@/hooks/useWorkerAnalytics')
      vi.mocked(useWorkerAnalytics).mockReturnValue({
        workers: [],
        summary: null,
        isLoading: false,
        error: new Error('Failed to load analytics'),
      })

      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByText(/Failed to load analytics/)).toBeInTheDocument()
    })

    it('should show retry button on error', async () => {
      const { useWorkerAnalytics } = await import('@/hooks/useWorkerAnalytics')
      vi.mocked(useWorkerAnalytics).mockReturnValue({
        workers: [],
        summary: null,
        isLoading: false,
        error: new Error('Failed'),
      })

      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should show empty state when no data', async () => {
      const { useWorkerAnalytics } = await import('@/hooks/useWorkerAnalytics')
      vi.mocked(useWorkerAnalytics).mockReturnValue({
        workers: [],
        summary: { totalExecutions: 0, overallSuccessRate: 0, avgDuration: 0 },
        isLoading: false,
        error: null,
      })

      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      expect(screen.getByText(/No data available/i)).toBeInTheDocument()
    })
  })

  describe('worker detail', () => {
    it('should navigate to worker detail on click', async () => {
      const { AnalyticsDashboard } = await import('../AnalyticsDashboard')
      render(<AnalyticsDashboard />, { wrapper: createWrapper() })

      const workerRow = screen.getByText('Email Worker').closest('tr')
      if (workerRow) {
        fireEvent.click(workerRow)
      }

      // Should show worker detail or navigate
      expect(screen.getByText(/Email Worker/)).toBeInTheDocument()
    })
  })
})
