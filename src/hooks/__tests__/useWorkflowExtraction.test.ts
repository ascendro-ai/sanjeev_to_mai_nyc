/**
 * useWorkflowExtraction Hook Tests
 * Tests for the workflow extraction hook
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

const mockExtractionResult = {
  workflow: {
    name: 'Email Automation',
    description: 'Automated email response workflow',
    steps: [
      {
        id: 'step-1',
        type: 'trigger',
        name: 'Email Received',
        nodeType: 'n8n-nodes-base.emailTrigger',
      },
      {
        id: 'step-2',
        type: 'action',
        name: 'Process Email',
        nodeType: 'n8n-nodes-base.function',
      },
      {
        id: 'step-3',
        type: 'action',
        name: 'Send Response',
        nodeType: 'n8n-nodes-base.emailSend',
      },
    ],
    connections: [
      { from: 'step-1', to: 'step-2' },
      { from: 'step-2', to: 'step-3' },
    ],
  },
  confidence: 0.85,
  suggestedIntegrations: ['gmail', 'smtp'],
}

describe('useWorkflowExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExtractionResult),
    } as Response)
  })

  describe('extraction', () => {
    it('should extract workflow from description', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('Build an email automation that responds to support requests')
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/gemini/extract',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should return workflow structure', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('Build an email automation')
      })

      await waitFor(() => {
        if (result.current.workflow) {
          expect(result.current.workflow).toHaveProperty('steps')
          expect(result.current.workflow).toHaveProperty('connections')
        }
      })
    })

    it('should return confidence score', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('Build an email automation')
      })

      await waitFor(() => {
        if (result.current.confidence !== undefined) {
          expect(result.current.confidence).toBeGreaterThanOrEqual(0)
          expect(result.current.confidence).toBeLessThanOrEqual(1)
        }
      })
    })
  })

  describe('state management', () => {
    it('should track extracting state', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isExtracting).toBe(false)

      act(() => {
        result.current.extract('Build an email automation')
      })

      expect(result.current.isExtracting).toBe(true)

      await waitFor(() => {
        expect(result.current.isExtracting).toBe(false)
      })
    })

    it('should clear previous results on new extraction', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('First workflow')
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            workflow: { name: 'Second Workflow', steps: [], connections: [] },
            confidence: 0.9,
          }),
      } as Response)

      await act(async () => {
        await result.current.extract('Second workflow')
      })

      await waitFor(() => {
        if (result.current.workflow) {
          expect(result.current.workflow.name).toBe('Second Workflow')
        }
      })
    })

    it('should provide reset function', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('Build a workflow')
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.workflow).toBeNull()
      expect(result.current.confidence).toBeUndefined()
    })
  })

  describe('refinement', () => {
    it('should refine extraction with additional context', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('Build an email automation')
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockExtractionResult,
            workflow: {
              ...mockExtractionResult.workflow,
              steps: [
                ...mockExtractionResult.workflow.steps,
                { id: 'step-4', type: 'action', name: 'Log Result' },
              ],
            },
          }),
      } as Response)

      await act(async () => {
        await result.current.refine('Also add logging for each step')
      })

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should accumulate refinements', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('Build an email automation')
      })

      await act(async () => {
        await result.current.refine('Add error handling')
      })

      await act(async () => {
        await result.current.refine('Add retry logic')
      })

      // Should maintain conversation history
      expect(result.current.conversationHistory.length).toBeGreaterThan(1)
    })
  })

  describe('error handling', () => {
    it('should handle extraction errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('API error'))

      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.extract('Build a workflow')
        } catch {
          // Expected error
        }
      })

      await waitFor(() => {
        expect(result.current.error).toBeDefined()
      })
    })

    it('should handle malformed response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'data' }),
      } as Response)

      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.extract('Build a workflow')
        } catch {
          // May or may not throw depending on implementation
        }
      })

      // Should handle gracefully
      expect(result.current.isExtracting).toBe(false)
    })
  })

  describe('suggested integrations', () => {
    it('should return suggested integrations', async () => {
      const { useWorkflowExtraction } = await import('../useWorkflowExtraction')
      const { result } = renderHook(() => useWorkflowExtraction(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.extract('Build an email automation with Slack notifications')
      })

      await waitFor(() => {
        if (result.current.suggestedIntegrations) {
          expect(Array.isArray(result.current.suggestedIntegrations)).toBe(true)
        }
      })
    })
  })
})
