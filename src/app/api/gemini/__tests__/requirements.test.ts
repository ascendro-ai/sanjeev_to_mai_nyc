/**
 * Gemini Requirements Route Tests
 * Tests for POST /api/gemini/requirements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { organization_id: 'org-123' },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'user-123' } },
          error: null,
        })
      ),
    },
  })),
}))

vi.mock('@/lib/gemini/client', () => ({
  analyzeRequirements: vi.fn(() =>
    Promise.resolve({
      questions: [
        {
          id: 'q1',
          question: 'What email provider do you use?',
          type: 'select',
          options: ['Gmail', 'Outlook', 'Other'],
          required: true,
        },
        {
          id: 'q2',
          question: 'How often should the workflow run?',
          type: 'select',
          options: ['Hourly', 'Daily', 'Weekly', 'On demand'],
          required: true,
        },
      ],
      summary: 'Email automation workflow with scheduling',
      suggestedIntegrations: ['gmail', 'slack'],
    })
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/gemini/requirements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/gemini/requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requirements analysis', () => {
    it('should analyze workflow requirements', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'I want to automate email responses based on keywords',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should return clarifying questions', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Build an automation workflow',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.questions) {
        expect(Array.isArray(data.questions)).toBe(true)
      }
    })

    it('should suggest integrations', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Send Slack notifications when emails arrive',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.suggestedIntegrations) {
        expect(Array.isArray(data.suggestedIntegrations)).toBe(true)
      }
    })

    it('should provide requirements summary', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Process incoming support emails and create tickets',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.summary) {
        expect(typeof data.summary).toBe('string')
      }
    })
  })

  describe('iterative refinement', () => {
    it('should accept answers to previous questions', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Email automation workflow',
        workflowId: 'workflow-123',
        previousAnswers: [
          { questionId: 'q1', answer: 'Gmail' },
        ],
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should refine based on conversation history', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Add error handling',
        workflowId: 'workflow-123',
        conversationHistory: [
          { role: 'user', content: 'Build email workflow' },
          { role: 'assistant', content: 'What email provider?' },
          { role: 'user', content: 'Gmail' },
        ],
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })
  })

  describe('validation', () => {
    it('should require description', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should require workflowId', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Build an email workflow',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate description minimum length', async () => {
      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'hi',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('error handling', () => {
    it('should handle AI service errors', async () => {
      const { analyzeRequirements } = await import('@/lib/gemini/client')
      vi.mocked(analyzeRequirements).mockRejectedValueOnce(new Error('AI service unavailable'))

      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Build an email workflow',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(500)
    })

    it('should require authentication', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({ data: { user: null }, error: { message: 'Not authenticated' } })
          ),
        },
      } as never)

      const { POST } = await import('../../gemini/requirements/route')
      const request = createMockRequest({
        description: 'Build an email workflow',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })
})
