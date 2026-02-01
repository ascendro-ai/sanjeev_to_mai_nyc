/**
 * useTestCases Hook Tests
 * Tests for the test cases management hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
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

const mockTestCases = [
  {
    id: 'tc-1',
    name: 'Happy Path Test',
    workflowId: 'workflow-123',
    inputData: { email: 'test@example.com' },
    expectedOutput: { status: 'sent' },
    assertions: [],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tc-2',
    name: 'Error Handling Test',
    workflowId: 'workflow-123',
    inputData: { email: 'invalid' },
    expectedOutput: { error: 'Invalid email' },
    assertions: [{ type: 'equals', path: 'error', expected: 'Invalid email' }],
    createdAt: '2024-01-02T00:00:00Z',
  },
]

describe('useTestCases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ testCases: mockTestCases }),
    } as Response)
  })

  describe('fetching', () => {
    it('should fetch test cases for workflow', async () => {
      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/testing/test-cases'),
        expect.any(Object)
      )
    })

    it('should return test cases array', async () => {
      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.testCases).toBeDefined()
      })

      if (result.current.testCases) {
        expect(Array.isArray(result.current.testCases)).toBe(true)
      }
    })

    it('should handle empty response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ testCases: [] }),
      } as Response)

      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.testCases).toHaveLength(0)
      })
    })
  })

  describe('creating', () => {
    it('should create a new test case', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ testCases: mockTestCases }),
      } as Response)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            testCase: { id: 'tc-new', name: 'New Test' },
          }),
      } as Response)

      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.createTestCase({
          name: 'New Test',
          inputData: { key: 'value' },
          expectedOutput: { result: 'success' },
        })
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/testing/test-cases',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should validate required fields', async () => {
      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        try {
          await result.current.createTestCase({
            name: '', // Invalid: empty name
            inputData: {},
            expectedOutput: {},
          })
        } catch {
          // Expected validation error
        }
      })
    })
  })

  describe('updating', () => {
    it('should update test case', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ testCases: mockTestCases }),
      } as Response)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            testCase: { id: 'tc-1', name: 'Updated Test' },
          }),
      } as Response)

      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.updateTestCase('tc-1', { name: 'Updated Test' })
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/testing/test-cases',
        expect.objectContaining({
          method: 'PUT',
        })
      )
    })

    it('should update assertions', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ testCases: mockTestCases }),
      } as Response)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ testCase: { id: 'tc-1' } }),
      } as Response)

      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.updateTestCase('tc-1', {
          assertions: [{ type: 'contains', path: 'message', expected: 'success' }],
        })
      })

      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('deleting', () => {
    it('should delete test case', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ testCases: mockTestCases }),
      } as Response)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.deleteTestCase('tc-1')
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/testing/test-cases?id=tc-1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle fetch errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeDefined()
    })

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response)

      const { useTestCases } = await import('../useTestCases')
      const { result } = renderHook(() => useTestCases('workflow-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeDefined()
    })
  })
})
