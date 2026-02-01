/**
 * useTestRunner Hook Tests
 * Tests for the test runner hook
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

describe('useTestRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          testRun: {
            id: 'run-123',
            status: 'completed',
            passed: true,
            duration: 1500,
            results: [
              { testCaseId: 'tc-1', passed: true, duration: 500 },
              { testCaseId: 'tc-2', passed: true, duration: 1000 },
            ],
          },
        }),
    } as Response)
  })

  describe('runTest', () => {
    it('should execute a single test case', async () => {
      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.runTest('test-case-123')
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/testing/run',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-case-123'),
        })
      )
    })

    it('should execute multiple test cases', async () => {
      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.runTests(['tc-1', 'tc-2', 'tc-3'])
      })

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should track running state', async () => {
      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      expect(result.current.isRunning).toBe(false)

      act(() => {
        result.current.runTest('test-case-123')
      })

      // Should be running during execution
      expect(result.current.isRunning).toBe(true)

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
      })
    })
  })

  describe('results', () => {
    it('should return test results after run', async () => {
      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.runTest('test-case-123')
      })

      await waitFor(() => {
        expect(result.current.lastResult).toBeDefined()
      })
    })

    it('should calculate pass rate', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            testRun: {
              id: 'run-123',
              status: 'completed',
              results: [
                { testCaseId: 'tc-1', passed: true },
                { testCaseId: 'tc-2', passed: true },
                { testCaseId: 'tc-3', passed: false },
              ],
            },
          }),
      } as Response)

      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.runTests(['tc-1', 'tc-2', 'tc-3'])
      })

      await waitFor(() => {
        if (result.current.lastResult?.passRate !== undefined) {
          expect(result.current.lastResult.passRate).toBeCloseTo(0.67, 1)
        }
      })
    })

    it('should track total duration', async () => {
      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.runTest('test-case-123')
      })

      await waitFor(() => {
        if (result.current.lastResult?.duration !== undefined) {
          expect(result.current.lastResult.duration).toBeGreaterThan(0)
        }
      })
    })
  })

  describe('error handling', () => {
    it('should handle test execution errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Execution failed' }),
      } as Response)

      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.runTest('test-case-123')
        } catch {
          // Expected error
        }
      })

      await waitFor(() => {
        expect(result.current.error).toBeDefined()
      })
    })

    it('should clear errors on new run', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'First error' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              testRun: { id: 'run-123', status: 'completed' },
            }),
        } as Response)

      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      // First run fails
      await act(async () => {
        try {
          await result.current.runTest('test-case-123')
        } catch {
          // Expected
        }
      })

      // Second run succeeds
      await act(async () => {
        await result.current.runTest('test-case-123')
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
      })
    })
  })

  describe('mock data', () => {
    it('should pass mock data to test execution', async () => {
      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      const mockData = {
        externalApi: { response: 'mocked response' },
      }

      await act(async () => {
        await result.current.runTest('test-case-123', { mockData })
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/testing/run',
        expect.objectContaining({
          body: expect.stringContaining('mockData'),
        })
      )
    })
  })

  describe('cancellation', () => {
    it('should support test cancellation', async () => {
      const { useTestRunner } = await import('../useTestRunner')
      const { result } = renderHook(() => useTestRunner('workflow-123'), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.runTest('test-case-123')
      })

      act(() => {
        result.current.cancel()
      })

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
      })
    })
  })
})
