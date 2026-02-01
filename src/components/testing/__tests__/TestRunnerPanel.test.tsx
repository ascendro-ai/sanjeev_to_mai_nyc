/**
 * TestRunnerPanel Component Tests
 * Tests for the test runner panel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock hooks
vi.mock('@/hooks/useTestRunner', () => ({
  useTestRunner: vi.fn(() => ({
    runTest: vi.fn(),
    runTests: vi.fn(),
    cancel: vi.fn(),
    isRunning: false,
    lastResult: null,
    error: null,
  })),
}))

vi.mock('@/hooks/useTestCases', () => ({
  useTestCases: vi.fn(() => ({
    testCases: [
      {
        id: 'tc-1',
        name: 'Happy Path Test',
        inputData: { email: 'test@example.com' },
        expectedOutput: { status: 'sent' },
      },
      {
        id: 'tc-2',
        name: 'Error Case Test',
        inputData: { email: 'invalid' },
        expectedOutput: { error: 'Invalid email' },
      },
      {
        id: 'tc-3',
        name: 'Edge Case Test',
        inputData: { email: '' },
        expectedOutput: { error: 'Email required' },
      },
    ],
    isLoading: false,
    error: null,
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

describe('TestRunnerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render panel container', async () => {
      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByTestId('test-runner-panel')).toBeInTheDocument()
    })

    it('should render test case list', async () => {
      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Happy Path Test')).toBeInTheDocument()
      expect(screen.getByText('Error Case Test')).toBeInTheDocument()
      expect(screen.getByText('Edge Case Test')).toBeInTheDocument()
    })

    it('should render run all button', async () => {
      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByRole('button', { name: /run all/i })).toBeInTheDocument()
    })

    it('should render individual run buttons', async () => {
      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      const runButtons = screen.getAllByRole('button', { name: /run$/i })
      expect(runButtons.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('running tests', () => {
    it('should run single test on button click', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      const runTest = vi.fn()
      vi.mocked(useTestRunner).mockReturnValue({
        runTest,
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: false,
        lastResult: null,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      const runButtons = screen.getAllByRole('button', { name: /run$/i })
      fireEvent.click(runButtons[0])

      expect(runTest).toHaveBeenCalledWith('tc-1')
    })

    it('should run all tests on run all click', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      const runTests = vi.fn()
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests,
        cancel: vi.fn(),
        isRunning: false,
        lastResult: null,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      fireEvent.click(screen.getByRole('button', { name: /run all/i }))

      expect(runTests).toHaveBeenCalledWith(['tc-1', 'tc-2', 'tc-3'])
    })

    it('should show cancel button when running', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: true,
        lastResult: null,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should call cancel on cancel button click', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      const cancel = vi.fn()
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel,
        isRunning: true,
        lastResult: null,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(cancel).toHaveBeenCalled()
    })
  })

  describe('results display', () => {
    it('should show pass/fail status for each test', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: false,
        lastResult: {
          results: [
            { testCaseId: 'tc-1', passed: true, duration: 500 },
            { testCaseId: 'tc-2', passed: false, duration: 300, error: 'Assertion failed' },
            { testCaseId: 'tc-3', passed: true, duration: 200 },
          ],
          passRate: 0.67,
          duration: 1000,
        },
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getAllByTestId('status-pass').length).toBe(2)
      expect(screen.getAllByTestId('status-fail').length).toBe(1)
    })

    it('should show pass rate summary', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: false,
        lastResult: {
          results: [
            { testCaseId: 'tc-1', passed: true },
            { testCaseId: 'tc-2', passed: true },
            { testCaseId: 'tc-3', passed: false },
          ],
          passRate: 0.67,
          duration: 1000,
        },
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/67%|2\/3/)).toBeInTheDocument()
    })

    it('should show test duration', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: false,
        lastResult: {
          results: [{ testCaseId: 'tc-1', passed: true, duration: 500 }],
          passRate: 1,
          duration: 500,
        },
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/500ms|0\.5s/)).toBeInTheDocument()
    })

    it('should show error details for failed tests', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: false,
        lastResult: {
          results: [
            { testCaseId: 'tc-1', passed: false, error: 'Expected "sent" but got "pending"' },
          ],
          passRate: 0,
          duration: 500,
        },
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/Expected "sent" but got "pending"/)).toBeInTheDocument()
    })
  })

  describe('selection', () => {
    it('should allow selecting specific tests', async () => {
      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()
    })

    it('should run only selected tests', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      const runTests = vi.fn()
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests,
        cancel: vi.fn(),
        isRunning: false,
        lastResult: null,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0]) // Select tc-1
      fireEvent.click(checkboxes[2]) // Select tc-3

      fireEvent.click(screen.getByRole('button', { name: /run selected/i }))

      expect(runTests).toHaveBeenCalledWith(['tc-1', 'tc-3'])
    })
  })

  describe('loading state', () => {
    it('should show loading skeleton when loading test cases', async () => {
      const { useTestCases } = await import('@/hooks/useTestCases')
      vi.mocked(useTestCases).mockReturnValue({
        testCases: [],
        isLoading: true,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
    })

    it('should show running indicator on test being executed', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: true,
        currentTestId: 'tc-2',
        lastResult: null,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByTestId('running-indicator-tc-2')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('should show error message', async () => {
      const { useTestRunner } = await import('@/hooks/useTestRunner')
      vi.mocked(useTestRunner).mockReturnValue({
        runTest: vi.fn(),
        runTests: vi.fn(),
        cancel: vi.fn(),
        isRunning: false,
        lastResult: null,
        error: new Error('Failed to run tests'),
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/Failed to run tests/)).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should show empty state when no test cases', async () => {
      const { useTestCases } = await import('@/hooks/useTestCases')
      vi.mocked(useTestCases).mockReturnValue({
        testCases: [],
        isLoading: false,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/No test cases/i)).toBeInTheDocument()
    })

    it('should show create test case button in empty state', async () => {
      const { useTestCases } = await import('@/hooks/useTestCases')
      vi.mocked(useTestCases).mockReturnValue({
        testCases: [],
        isLoading: false,
        error: null,
      })

      const { TestRunnerPanel } = await import('../TestRunnerPanel')
      render(<TestRunnerPanel workflowId="workflow-123" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByRole('button', { name: /create test/i })).toBeInTheDocument()
    })
  })
})
