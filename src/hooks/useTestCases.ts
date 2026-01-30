'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  TestCase,
  CreateTestCaseInput,
  UpdateTestCaseInput,
  TestCaseFilters,
} from '@/types/testing'

interface UseTestCasesOptions {
  workflowId?: string
  filters?: TestCaseFilters
  limit?: number
  offset?: number
  enabled?: boolean
}

interface TestCasesResponse {
  data: TestCase[]
  total: number
  limit: number
  offset: number
}

/**
 * Hook for managing test cases
 */
export function useTestCases(options: UseTestCasesOptions = {}) {
  const queryClient = useQueryClient()
  const { workflowId, filters, limit = 50, offset = 0, enabled = true } = options

  // Build query params
  const buildQueryParams = () => {
    const params = new URLSearchParams()
    if (workflowId) params.set('workflowId', workflowId)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive))
    if (filters?.tags?.length) params.set('tags', filters.tags.join(','))
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    return params.toString()
  }

  // Fetch test cases
  const {
    data: testCasesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['test-cases', workflowId, filters, limit, offset],
    queryFn: async (): Promise<TestCasesResponse> => {
      const response = await fetch(`/api/testing/test-cases?${buildQueryParams()}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch test cases')
      }
      return response.json()
    },
    enabled,
    staleTime: 30000, // 30 seconds
  })

  // Create test case mutation
  const createTestCase = useMutation({
    mutationFn: async (input: CreateTestCaseInput): Promise<TestCase> => {
      const response = await fetch('/api/testing/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create test case')
      }
      const result = await response.json()
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] })
    },
  })

  // Update test case mutation
  const updateTestCase = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateTestCaseInput
    }): Promise<TestCase> => {
      const response = await fetch(`/api/testing/test-cases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update test case')
      }
      const result = await response.json()
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] })
    },
  })

  // Delete test case mutation
  const deleteTestCase = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/testing/test-cases/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete test case')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] })
    },
  })

  return {
    testCases: testCasesData?.data || [],
    total: testCasesData?.total || 0,
    isLoading,
    error,
    refetch,
    createTestCase,
    updateTestCase,
    deleteTestCase,
  }
}

/**
 * Hook for fetching a single test case
 */
export function useTestCase(testCaseId: string | null) {
  return useQuery({
    queryKey: ['test-case', testCaseId],
    queryFn: async (): Promise<TestCase> => {
      const response = await fetch(`/api/testing/test-cases/${testCaseId}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch test case')
      }
      const result = await response.json()
      return result.data
    },
    enabled: !!testCaseId,
    staleTime: 30000,
  })
}
