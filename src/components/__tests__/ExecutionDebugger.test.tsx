/**
 * ExecutionDebugger Component Tests
 * Tests for the execution debugger component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock dependencies
vi.mock('@/hooks/useExecutions', () => ({
  useExecutions: vi.fn(() => ({
    execution: {
      id: 'exec-123',
      workflowId: 'workflow-123',
      status: 'completed',
      startedAt: '2024-01-01T10:00:00Z',
      finishedAt: '2024-01-01T10:01:00Z',
      data: {
        input: { email: 'test@example.com' },
        output: { status: 'sent' },
      },
      steps: [
        {
          id: 'step-1',
          name: 'Email Trigger',
          status: 'completed',
          duration: 100,
          input: { trigger: 'email' },
          output: { email: 'test@example.com' },
        },
        {
          id: 'step-2',
          name: 'Process',
          status: 'completed',
          duration: 500,
          input: { email: 'test@example.com' },
          output: { processed: true },
        },
        {
          id: 'step-3',
          name: 'Send',
          status: 'completed',
          duration: 400,
          input: { processed: true },
          output: { status: 'sent' },
        },
      ],
    },
    isLoading: false,
    error: null,
  })),
}))

describe('ExecutionDebugger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render debugger component', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      expect(screen.getByTestId('execution-debugger')).toBeInTheDocument()
    })

    it('should display execution status', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })

    it('should display execution duration', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      // Should show total duration
      expect(screen.getByText(/60s|1m/i)).toBeInTheDocument()
    })

    it('should render step list', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      expect(screen.getByText('Email Trigger')).toBeInTheDocument()
      expect(screen.getByText('Process')).toBeInTheDocument()
      expect(screen.getByText('Send')).toBeInTheDocument()
    })
  })

  describe('step details', () => {
    it('should expand step details on click', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      const step = screen.getByText('Email Trigger')
      fireEvent.click(step)

      // Should show input/output
      expect(screen.getByText(/input/i)).toBeInTheDocument()
      expect(screen.getByText(/output/i)).toBeInTheDocument()
    })

    it('should display step input data', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      const step = screen.getByText('Email Trigger')
      fireEvent.click(step)

      expect(screen.getByText(/trigger/)).toBeInTheDocument()
    })

    it('should display step output data', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      const step = screen.getByText('Process')
      fireEvent.click(step)

      expect(screen.getByText(/processed/)).toBeInTheDocument()
    })

    it('should show step duration', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      expect(screen.getByText(/100ms/)).toBeInTheDocument()
    })
  })

  describe('status indicators', () => {
    it('should show success indicator for completed steps', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      const successIndicators = screen.getAllByTestId('status-success')
      expect(successIndicators.length).toBe(3)
    })

    it('should show error indicator for failed steps', async () => {
      const { useExecutions } = await import('@/hooks/useExecutions')
      vi.mocked(useExecutions).mockReturnValue({
        execution: {
          id: 'exec-123',
          status: 'failed',
          steps: [
            { id: 'step-1', name: 'Step 1', status: 'completed' },
            { id: 'step-2', name: 'Step 2', status: 'failed', error: 'Test error' },
          ],
        },
        isLoading: false,
        error: null,
      })

      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      expect(screen.getByTestId('status-error')).toBeInTheDocument()
    })
  })

  describe('error display', () => {
    it('should display step errors', async () => {
      const { useExecutions } = await import('@/hooks/useExecutions')
      vi.mocked(useExecutions).mockReturnValue({
        execution: {
          id: 'exec-123',
          status: 'failed',
          steps: [
            {
              id: 'step-1',
              name: 'Failed Step',
              status: 'failed',
              error: 'Connection timeout',
            },
          ],
        },
        isLoading: false,
        error: null,
      })

      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      expect(screen.getByText(/Connection timeout/)).toBeInTheDocument()
    })

    it('should highlight error step', async () => {
      const { useExecutions } = await import('@/hooks/useExecutions')
      vi.mocked(useExecutions).mockReturnValue({
        execution: {
          id: 'exec-123',
          status: 'failed',
          steps: [
            { id: 'step-1', name: 'Step 1', status: 'completed' },
            { id: 'step-2', name: 'Step 2', status: 'failed' },
          ],
        },
        isLoading: false,
        error: null,
      })

      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      const failedStep = screen.getByText('Step 2').closest('[data-status]')
      expect(failedStep).toHaveAttribute('data-status', 'failed')
    })
  })

  describe('loading state', () => {
    it('should show loading state', async () => {
      const { useExecutions } = await import('@/hooks/useExecutions')
      vi.mocked(useExecutions).mockReturnValue({
        execution: null,
        isLoading: true,
        error: null,
      })

      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
    })
  })

  describe('data formatting', () => {
    it('should format JSON data', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      const step = screen.getByText('Email Trigger')
      fireEvent.click(step)

      // Should show formatted JSON
      expect(screen.getByTestId('json-viewer')).toBeInTheDocument()
    })

    it('should copy data to clipboard', async () => {
      const writeText = vi.fn()
      Object.assign(navigator, {
        clipboard: { writeText },
      })

      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" />)

      const step = screen.getByText('Email Trigger')
      fireEvent.click(step)

      const copyButton = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(copyButton)

      expect(writeText).toHaveBeenCalled()
    })
  })

  describe('timeline view', () => {
    it('should show timeline visualization', async () => {
      const { ExecutionDebugger } = await import('../ExecutionDebugger')
      render(<ExecutionDebugger executionId="exec-123" showTimeline />)

      expect(screen.getByTestId('execution-timeline')).toBeInTheDocument()
    })
  })
})
