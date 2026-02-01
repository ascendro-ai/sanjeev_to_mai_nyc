/**
 * Cleanup Route Tests (Phase 2.1.4)
 * Tests for POST /api/n8n/cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET } from '../cleanup/route'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
}))

vi.mock('@/lib/n8n/webhook-auth', () => ({
  validateWebhookRequest: vi.fn(() => Promise.resolve({ valid: true, body: '{}' })),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/n8n/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/n8n/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('execution cleanup', () => {
    it('should expire stale pending reviews', async () => {
      const request = createMockRequest()
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.expiredReviewCount).toBeDefined()
    })

    it('should update related executions to failed status', async () => {
      const request = createMockRequest()
      const response = await POST(request)
      const data = await response.json()

      expect(data.staleExecutionCount).toBeDefined()
    })

    it('should return cleanup statistics', async () => {
      const request = createMockRequest()
      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('expiredReviewCount')
      expect(data).toHaveProperty('staleExecutionCount')
      expect(data).toHaveProperty('message')
    })
  })

  describe('authorization', () => {
    it('should require webhook authentication', async () => {
      const { validateWebhookRequest } = await import('@/lib/n8n/webhook-auth')
      vi.mocked(validateWebhookRequest).mockResolvedValueOnce({
        valid: false,
        error: 'Invalid signature',
        body: '',
      })

      const request = createMockRequest()
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })
})

describe('GET /api/n8n/cleanup', () => {
  it('should return cleanup status', async () => {
    const request = new NextRequest('http://localhost/api/n8n/cleanup')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('reviewStatusCounts')
    expect(data).toHaveProperty('expiringSoon24h')
    expect(data).toHaveProperty('lastChecked')
  })

  it('should return review status counts', async () => {
    const response = await GET()
    const data = await response.json()

    expect(typeof data.reviewStatusCounts).toBe('object')
  })

  it('should return expiring soon count', async () => {
    const response = await GET()
    const data = await response.json()

    expect(typeof data.expiringSoon24h).toBe('number')
  })
})
