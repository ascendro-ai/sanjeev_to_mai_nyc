import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../ai-action/route'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/pii-filter', () => ({
  filterPII: vi.fn((data) => data),
  warnIfSensitiveData: vi.fn(),
}))

// Mock fetch for Gemini API
const mockFetch = vi.fn()
global.fetch = mockFetch

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/n8n/ai-action', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/n8n/ai-action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key')
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.0-flash')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('request validation', () => {
    it('should reject missing workflowId', async () => {
      const request = createMockRequest({
        stepId: 'step-1',
        stepLabel: 'Process',
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('workflowId')
    })

    it('should reject missing stepId', async () => {
      const request = createMockRequest({
        workflowId: 'wf-123',
        stepLabel: 'Process',
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('stepId')
    })

    it('should accept valid request with minimum fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  result: 'success',
                  actions: ['processed'],
                  message: 'Done',
                  needsGuidance: false,
                }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepLabel: 'Process',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('AI action execution', () => {
    it('should execute with blueprint constraints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  result: { analyzed: true },
                  actions: ['read_email', 'summarize'],
                  message: 'Email analyzed',
                  needsGuidance: false,
                }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepLabel: 'Analyze Email',
        blueprint: {
          greenList: ['read_email', 'summarize'],
          redList: ['delete_email', 'send_email'],
        },
        input: { subject: 'Test', body: 'Email content' },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.result).toEqual({ analyzed: true })
    })

    it('should pass input data to AI model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  result: 'processed',
                  actions: ['analyzed'],
                  message: 'Data processed',
                }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepLabel: 'Process Data',
        input: { data: 'test-data', count: 42 },
      })

      await POST(request)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-data'),
        })
      )
    })

    it('should filter PII before AI processing', async () => {
      const { filterPII, warnIfSensitiveData } = await import('@/lib/pii-filter')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ result: 'done', actions: [], message: 'ok' }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepLabel: 'Process',
        input: { email: 'user@test.com', name: 'John' },
      })

      await POST(request)

      expect(warnIfSensitiveData).toHaveBeenCalled()
      expect(filterPII).toHaveBeenCalled()
    })

    it('should handle string input data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ result: 'ok', actions: [], message: 'done' }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        input: '{"key": "value"}', // String instead of object
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should handle string blueprint data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ result: 'ok', actions: [], message: 'done' }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        blueprint: '{"greenList": ["read"], "redList": ["delete"]}',
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  describe('guidance handling', () => {
    it('should return needsGuidance when AI is uncertain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  needsGuidance: true,
                  guidanceQuestion: 'Should I proceed with deletion?',
                  partialResult: { analyzed: true, risk: 'high' },
                }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepLabel: 'Risky Action',
      })

      const response = await POST(request)
      const body = await response.json()

      expect(body.success).toBe(false)
      expect(body.needsGuidance).toBe(true)
      expect(body.guidanceQuestion).toBe('Should I proceed with deletion?')
      expect(body.partialResult).toEqual({ analyzed: true, risk: 'high' })
    })

    it('should include previous guidance context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ result: 'done', actions: [], message: 'ok' }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        guidanceContext: 'Proceed with caution, skip large files',
      })

      await POST(request)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Previous Guidance'),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle Gemini API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      const response = await POST(request)
      const body = await response.json()

      expect(body.error).toBeDefined()
      expect(body.retryable).toBe(true)
    })

    it('should handle rate limiting from Gemini', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body.errorType).toBe('rate_limit')
      expect(body.retryable).toBe(true)
    })

    it('should handle configuration errors', async () => {
      vi.stubEnv('GEMINI_API_KEY', '')

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.errorType).toBe('configuration')
      expect(body.retryable).toBe(false)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      const response = await POST(request)
      const body = await response.json()

      expect(body.error).toBeDefined()
    })

    it('should handle non-JSON AI response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: 'This is plain text, not JSON',
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      const response = await POST(request)
      const body = await response.json()

      // Should wrap non-JSON response
      expect(response.status).toBe(200)
      expect(body.result).toBeDefined()
    })

    it('should handle empty AI response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })

  describe('activity logging', () => {
    it('should log step execution start', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
      vi.mocked(createClient).mockResolvedValue({
        from: vi.fn(() => ({ insert: mockInsert })),
      } as any)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ result: 'ok', actions: [], message: 'done' }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepLabel: 'Test Step',
        workerName: 'TestWorker',
      })

      await POST(request)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workflow_step_execution',
          worker_name: 'TestWorker',
          workflow_id: 'wf-123',
        })
      )
    })

    it('should log successful completion', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
      vi.mocked(createClient).mockResolvedValue({
        from: vi.fn(() => ({ insert: mockInsert })),
      } as any)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ result: 'success', actions: ['done'], message: 'Completed' }),
              }],
            },
          }],
        }),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
        stepLabel: 'Test Step',
      })

      await POST(request)

      // Should have logged both start and completion
      expect(mockInsert).toHaveBeenCalledTimes(2)
      expect(mockInsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'workflow_step_complete',
        })
      )
    })
  })

  describe('retry logic', () => {
    it('should retry on transient errors', async () => {
      // First call fails with 503, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve('Service unavailable'),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({ result: 'ok', actions: [], message: 'done' }),
                }],
              },
            }],
          }),
        })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      const response = await POST(request)

      // Should have retried and succeeded
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(response.status).toBe(200)
    })

    it('should not retry on 400 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      })

      const request = createMockRequest({
        workflowId: 'wf-123',
        stepId: 'step-1',
      })

      await POST(request)

      // Should not retry client errors
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
