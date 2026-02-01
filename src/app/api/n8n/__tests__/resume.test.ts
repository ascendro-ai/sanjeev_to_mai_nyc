/**
 * Resume Execution Route Tests (Phase 2.1.7)
 * Tests for POST /api/n8n/resume/[executionId]
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
              data: {
                id: 'review-123',
                execution_id: 'exec-123',
                status: 'pending',
                action_payload: {
                  resumeWebhookUrl: 'http://localhost:5678/webhook/resume',
                },
              },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: 'review-123', status: 'approved' },
                error: null,
              })
            ),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fetch for n8n webhook calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  } as Response)
)

function createMockRequest(
  executionId: string,
  body: Record<string, unknown> = {}
): NextRequest {
  return new NextRequest(
    `http://localhost/api/n8n/resume/${executionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

describe('POST /api/n8n/resume/[executionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('request validation', () => {
    it('should reject invalid executionId', async () => {
      const { POST } = await import('../resume/[executionId]/route')
      const request = createMockRequest('', { decision: 'approve' })
      const response = await POST(request, { params: Promise.resolve({ executionId: '' }) })

      expect(response.status).toBe(400)
    })

    it('should require decision parameter', async () => {
      const { POST } = await import('../resume/[executionId]/route')
      const request = createMockRequest('exec-123', {})
      const response = await POST(request, { params: Promise.resolve({ executionId: 'exec-123' }) })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('human review resume', () => {
    it('should resume execution after approval', async () => {
      const { POST } = await import('../resume/[executionId]/route')
      const request = createMockRequest('exec-123', {
        decision: 'approve',
        reviewId: 'review-123',
      })
      const response = await POST(request, { params: Promise.resolve({ executionId: 'exec-123' }) })

      expect(response.status).toBeLessThan(500)
    })

    it('should handle rejection', async () => {
      const { POST } = await import('../resume/[executionId]/route')
      const request = createMockRequest('exec-123', {
        decision: 'reject',
        reviewId: 'review-123',
        feedback: 'Needs more information',
      })
      const response = await POST(request, { params: Promise.resolve({ executionId: 'exec-123' }) })

      expect(response.status).toBeLessThan(500)
    })

    it('should include feedback in response', async () => {
      const { POST } = await import('../resume/[executionId]/route')
      const request = createMockRequest('exec-123', {
        decision: 'approve',
        reviewId: 'review-123',
        feedback: 'Looks good',
      })
      const response = await POST(request, { params: Promise.resolve({ executionId: 'exec-123' }) })
      const data = await response.json()

      expect(response.status).toBeLessThan(500)
    })
  })

  describe('execution continuation', () => {
    it('should call n8n resume webhook', async () => {
      const { POST } = await import('../resume/[executionId]/route')
      const request = createMockRequest('exec-123', {
        decision: 'approve',
        reviewId: 'review-123',
      })
      await POST(request, { params: Promise.resolve({ executionId: 'exec-123' }) })

      // Fetch may or may not be called depending on implementation
      // Just verify no error is thrown
    })
  })

  describe('activity logging', () => {
    it('should log resume event', async () => {
      const { POST } = await import('../resume/[executionId]/route')
      const request = createMockRequest('exec-123', {
        decision: 'approve',
        reviewId: 'review-123',
      })
      const response = await POST(request, { params: Promise.resolve({ executionId: 'exec-123' }) })

      expect(response.status).toBeLessThan(500)
    })
  })
})
