'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  TestRun,
  TestStepResult,
  CreateTestRunOptions,
  TestRunFilters,
} from '@/types/testing'

interface UseTestRunnerOptions {
  workflowId?: string
  testCaseId?: string
  filters?: TestRunFilters
  limit?: number
  pollInterval?: number
  enabled?: boolean
}

interface TestRunResponse {
  data: TestRun
  testCase?: { id: string; name: string; description?: string }
  workflow?: { id: string; name: string; description?: string }
  stepResults: TestStepResult[]
}

interface TestRunsResponse {
  data: TestRun[]
  total: number
  limit: number
  offset: number
}

/**
 * Hook for running tests and managing test runs
 */
export function useTestRunner(options: UseTestRunnerOptions = {}) {
  const queryClient = useQueryClient()
  const { workflowId, testCaseId, filters, limit = 20, pollInterval = 2000, enabled = true } = options

  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Build query params
  const buildQueryParams = () => {
    const params = new URLSearchParams()
    if (workflowId) params.set('workflowId', workflowId)
    if (testCaseId) params.set('testCaseId', testCaseId)
    if (filters?.status) params.set('status', filters.status)
    params.set('limit', String(limit))
    return params.toString()
  }

  // Fetch test runs
  const {
    data: testRunsData,
    isLoading: isLoadingRuns,
    error: runsError,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ['test-runs', workflowId, testCaseId, filters, limit],
    queryFn: async (): Promise<TestRunsResponse> => {
      const response = await fetch(`/api/testing/run?${buildQueryParams()}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch test runs')
      }
      return response.json()
    },
    enabled,
    staleTime: 10000,
  })

  // Fetch active test run details with polling
  // H4 fix: Return full TestRunResponse, don't extract .data twice
  const {
    data: activeRunData,
    isLoading: isLoadingActiveRun,
    refetch: refetchActiveRun,
  } = useQuery({
    queryKey: ['test-run', activeRunId],
    queryFn: async (): Promise<TestRunResponse> => {
      const response = await fetch(`/api/testing/run/${activeRunId}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch test run')
      }
      // H4 fix: API returns { data: TestRunResponse }, so extract it properly
      const json = await response.json()
      return json.data as TestRunResponse
    },
    enabled: !!activeRunId,
    staleTime: 5000,
  })

  // Poll for updates when test is running
  useEffect(() => {
    if (activeRunId && activeRunData?.data?.status === 'running') {
      pollIntervalRef.current = setInterval(() => {
        refetchActiveRun()
      }, pollInterval)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [activeRunId, activeRunData?.data?.status, pollInterval, refetchActiveRun])

  // Stop polling when test completes
  useEffect(() => {
    if (
      activeRunData?.data?.status &&
      !['running', 'pending'].includes(activeRunData.data.status)
    ) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      // Refresh the runs list
      refetchRuns()
    }
  }, [activeRunData?.data?.status, refetchRuns])

  // Start test run mutation
  const startTestRun = useMutation({
    mutationFn: async (input: CreateTestRunOptions): Promise<TestRun> => {
      const response = await fetch('/api/testing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start test run')
      }
      const result = await response.json()
      return result.data
    },
    onSuccess: (testRun) => {
      setActiveRunId(testRun.id)
      queryClient.invalidateQueries({ queryKey: ['test-runs'] })
    },
  })

  // Cancel test run mutation
  const cancelTestRun = useMutation({
    mutationFn: async (runId: string): Promise<void> => {
      const response = await fetch(`/api/testing/run/${runId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel test run')
      }
    },
    onSuccess: () => {
      setActiveRunId(null)
      queryClient.invalidateQueries({ queryKey: ['test-runs'] })
    },
  })

  // Helper to run a test case
  const runTestCase = useCallback(
    async (testCaseId: string, workflowId: string) => {
      return startTestRun.mutateAsync({
        workflowId,
        testCaseId,
        runType: 'full_workflow',
      })
    },
    [startTestRun]
  )

  // Helper to run with custom mock data
  const runWithMockData = useCallback(
    async (
      workflowId: string,
      mockTriggerData: Record<string, unknown>,
      mockStepInputs?: Record<string, Record<string, unknown>>
    ) => {
      return startTestRun.mutateAsync({
        workflowId,
        runType: 'full_workflow',
        mockTriggerData,
        mockStepInputs,
      })
    },
    [startTestRun]
  )

  // Helper to run a single step
  const runSingleStep = useCallback(
    async (
      workflowId: string,
      stepId: string,
      mockInput: Record<string, unknown>
    ) => {
      return startTestRun.mutateAsync({
        workflowId,
        runType: 'single_step',
        targetStepIds: [stepId],
        mockStepInputs: { [stepId]: mockInput },
      })
    },
    [startTestRun]
  )

  return {
    // Test runs list
    testRuns: testRunsData?.data || [],
    totalRuns: testRunsData?.total || 0,
    isLoadingRuns,
    runsError,
    refetchRuns,

    // Active test run
    activeRun: activeRunData?.data || null,
    activeRunStepResults: activeRunData?.stepResults || [],
    isLoadingActiveRun,
    activeRunId,
    setActiveRunId,

    // Mutations
    startTestRun,
    cancelTestRun,

    // Helpers
    runTestCase,
    runWithMockData,
    runSingleStep,

    // Status helpers
    isRunning: activeRunData?.data?.status === 'running' || activeRunData?.data?.status === 'pending',
    isPassed: activeRunData?.data?.status === 'passed',
    isFailed: activeRunData?.data?.status === 'failed',
  }
}

/**
 * Hook for fetching test run history
 */
export function useTestHistory(workflowId?: string, testCaseId?: string) {
  return useQuery({
    queryKey: ['test-history', workflowId, testCaseId],
    queryFn: async (): Promise<TestRunsResponse> => {
      const params = new URLSearchParams()
      if (workflowId) params.set('workflowId', workflowId)
      if (testCaseId) params.set('testCaseId', testCaseId)
      params.set('limit', '100')

      const response = await fetch(`/api/testing/run?${params.toString()}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch test history')
      }
      return response.json()
    },
    enabled: !!(workflowId || testCaseId),
    staleTime: 30000,
  })
}
