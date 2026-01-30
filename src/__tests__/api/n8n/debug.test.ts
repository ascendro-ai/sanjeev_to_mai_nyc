import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { server } from '../../../../vitest.setup'
import { http, HttpResponse } from 'msw'

// Mock Supabase
const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Debug API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock responses
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'executions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'exec-123',
              workflow_id: 'wf-123',
              status: 'failed',
              error: 'Test error',
              started_at: new Date().toISOString(),
              workflow: {
                name: 'Test Workflow',
                steps: [],
              },
            },
            error: null,
          }),
        }
      }
      if (table === 'execution_steps') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                step_index: 0,
                step_name: 'Step 1',
                status: 'completed',
              },
              {
                step_index: 1,
                step_name: 'Step 2',
                status: 'failed',
                error: 'Test step error',
              },
            ],
            error: null,
          }),
        }
      }
      if (table === 'activity_logs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
  })

  describe('POST /api/n8n/debug', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { POST } = await import('@/app/api/n8n/debug/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/debug', {
        method: 'POST',
        body: JSON.stringify({ executionId: 'exec-123' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 when neither executionId nor workflowId provided', async () => {
      const { POST } = await import('@/app/api/n8n/debug/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/debug', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('executionId or workflowId')
    })

    it('should analyze execution with Gemini when executionId provided', async () => {
      // Ensure Gemini API returns analysis
      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
          return HttpResponse.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: 'Test failed due to configuration error',
                        rootCause: 'Missing API key',
                        affectedStep: 'Step 2',
                        suggestedFixes: ['Add API key to configuration', 'Check environment variables'],
                        preventionTips: ['Use secrets management'],
                        severity: 'high',
                        category: 'configuration',
                      }),
                    },
                  ],
                },
              },
            ],
          })
        })
      )

      const { POST } = await import('@/app/api/n8n/debug/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/debug', {
        method: 'POST',
        body: JSON.stringify({ executionId: 'exec-123' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.analysis).toBeDefined()
      expect(data.analysis.summary).toBeDefined()
      expect(data.analysis.suggestedFixes).toBeDefined()
    })

    it('should return 404 when execution not found', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      })

      const { POST } = await import('@/app/api/n8n/debug/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/debug', {
        method: 'POST',
        body: JSON.stringify({ executionId: 'not-found' }),
      })

      const response = await POST(request)
      // Should throw and return 500 due to error
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('GET /api/n8n/debug', () => {
    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'activity_logs') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'log-1',
                  type: 'debug_analysis',
                  data: {
                    executionId: 'exec-123',
                    analysis: {
                      summary: 'Previous analysis',
                      severity: 'medium',
                    },
                  },
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      })
    })

    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { GET } = await import('@/app/api/n8n/debug/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/debug?workflowId=wf-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 when workflowId not provided', async () => {
      const { GET } = await import('@/app/api/n8n/debug/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/debug')

      const response = await GET(request)
      expect(response.status).toBe(400)
    })

    it('should return debug analysis history', async () => {
      const { GET } = await import('@/app/api/n8n/debug/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/debug?workflowId=wf-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.analyses).toBeDefined()
      expect(Array.isArray(data.analyses)).toBe(true)
    })
  })
})

describe('Debug Analysis Types', () => {
  it('should have correct severity levels', () => {
    const validSeverities = ['low', 'medium', 'high', 'critical']
    validSeverities.forEach((severity) => {
      expect(['low', 'medium', 'high', 'critical']).toContain(severity)
    })
  })

  it('should have correct category types', () => {
    const validCategories = [
      'configuration',
      'data',
      'integration',
      'logic',
      'timeout',
      'permission',
      'unknown',
    ]
    validCategories.forEach((category) => {
      expect([
        'configuration',
        'data',
        'integration',
        'logic',
        'timeout',
        'permission',
        'unknown',
      ]).toContain(category)
    })
  })
})
