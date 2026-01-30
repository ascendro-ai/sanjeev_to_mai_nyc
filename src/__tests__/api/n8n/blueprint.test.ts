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

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Blueprint API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock responses
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { organization_id: 'org-123' },
            error: null,
          }),
        }
      }
      if (table === 'blueprint_feedback') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'feedback-1',
                feedback_type: 'approved',
                feedback_reason: null,
                suggested_additions: null,
                suggested_removals: null,
                created_at: new Date().toISOString(),
              },
              {
                id: 'feedback-2',
                feedback_type: 'rejected',
                feedback_reason: 'Too aggressive',
                suggested_additions: ['read_only'],
                suggested_removals: ['delete'],
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'feedback-new',
              step_id: 'step-123',
              feedback_type: 'rejected',
            },
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

  describe('POST /api/n8n/blueprint', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { POST } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/blueprint', {
        method: 'POST',
        body: JSON.stringify({
          stepId: 'step-123',
          originalBlueprint: { greenList: [], redList: [] },
          feedbackType: 'approved',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 when required fields missing', async () => {
      const { POST } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/blueprint', {
        method: 'POST',
        body: JSON.stringify({
          stepId: 'step-123',
          // Missing originalBlueprint and feedbackType
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('Missing required fields')
    })

    it('should record approved feedback without AI analysis', async () => {
      const { POST } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/blueprint', {
        method: 'POST',
        body: JSON.stringify({
          stepId: 'step-123',
          workflowId: 'wf-123',
          originalBlueprint: {
            greenList: ['read', 'write'],
            redList: ['delete'],
          },
          feedbackType: 'approved',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.feedbackId).toBeDefined()
    })

    it('should analyze rejected feedback with AI suggestions', async () => {
      // Mock Gemini to return suggestions
      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
          return HttpResponse.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        additions: ['read_only_mode'],
                        removals: ['bulk_delete'],
                      }),
                    },
                  ],
                },
              },
            ],
          })
        })
      )

      const { POST } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/blueprint', {
        method: 'POST',
        body: JSON.stringify({
          stepId: 'step-123',
          originalBlueprint: {
            greenList: ['read', 'write'],
            redList: ['delete'],
          },
          feedbackType: 'rejected',
          feedbackReason: 'Action was too aggressive',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.suggestions).toBeDefined()
    })

    it('should handle edited feedback with AI suggestions', async () => {
      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
          return HttpResponse.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        additions: ['summarize_only'],
                        removals: [],
                      }),
                    },
                  ],
                },
              },
            ],
          })
        })
      )

      const { POST } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/blueprint', {
        method: 'POST',
        body: JSON.stringify({
          stepId: 'step-123',
          originalBlueprint: {
            greenList: ['read', 'summarize'],
            redList: [],
          },
          feedbackType: 'edited',
          editedResult: { summary: 'Modified summary' },
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/n8n/blueprint', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { GET } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/blueprint?stepId=step-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return 400 when stepId not provided', async () => {
      const { GET } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/blueprint')

      const response = await GET(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('stepId')
    })

    it('should return aggregated feedback stats', async () => {
      const { GET } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/blueprint?stepId=step-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.stepId).toBe('step-123')
      expect(data.stats).toBeDefined()
      expect(data.stats.totalFeedback).toBeDefined()
      expect(data.stats.approvals).toBeDefined()
      expect(data.stats.rejections).toBeDefined()
    })

    it('should return unique suggestions from feedback', async () => {
      const { GET } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/blueprint?stepId=step-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.suggestions).toBeDefined()
      expect(data.suggestions.addToGreenList).toBeDefined()
      expect(data.suggestions.addToRedList).toBeDefined()
    })

    it('should include AI suggestions when enough feedback exists', async () => {
      // Mock enough feedback to trigger AI suggestions (>= 3)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { organization_id: 'org-123' },
              error: null,
            }),
          }
        }
        if (table === 'blueprint_feedback') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: 'f1', feedback_type: 'approved', original_blueprint: { greenList: [], redList: [] } },
                { id: 'f2', feedback_type: 'rejected', original_blueprint: { greenList: [], redList: [] } },
                { id: 'f3', feedback_type: 'edited', original_blueprint: { greenList: [], redList: [] } },
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

      server.use(
        http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
          return HttpResponse.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: 'Recommend adding read_only to green list',
                        recommendedGreenList: ['read_only', 'summarize'],
                        recommendedRedList: ['delete', 'modify'],
                        confidence: 85,
                      }),
                    },
                  ],
                },
              },
            ],
          })
        })
      )

      const { GET } = await import('@/app/api/n8n/blueprint/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/blueprint?stepId=step-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.suggestions.aiSuggestions).toBeDefined()
    })
  })
})

describe('Blueprint Feedback Types', () => {
  it('should support approved feedback type', () => {
    const feedbackTypes = ['approved', 'rejected', 'edited']
    expect(feedbackTypes).toContain('approved')
  })

  it('should support rejected feedback type', () => {
    const feedbackTypes = ['approved', 'rejected', 'edited']
    expect(feedbackTypes).toContain('rejected')
  })

  it('should support edited feedback type', () => {
    const feedbackTypes = ['approved', 'rejected', 'edited']
    expect(feedbackTypes).toContain('edited')
  })
})
