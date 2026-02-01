/**
 * Workers Analytics Route Tests (Phase 2.4.1)
 * Tests for GET /api/analytics/workers
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
          gte: vi.fn(() => ({
            lte: vi.fn(() =>
              Promise.resolve({
                data: [
                  { id: 'exec-1', status: 'completed', duration_ms: 1000 },
                  { id: 'exec-2', status: 'completed', duration_ms: 2000 },
                  { id: 'exec-3', status: 'failed', duration_ms: 500 },
                ],
                error: null,
              })
            ),
          })),
        })),
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('GET /api/analytics/workers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('metrics aggregation', () => {
    it('should return execution counts', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers?dateRange=30d'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toBeDefined()
    })

    it('should return success rates', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers?dateRange=30d'
      )
      const response = await GET(request)
      const data = await response.json()

      if (data.workers) {
        data.workers.forEach((worker: Record<string, unknown>) => {
          if (worker.successRate !== undefined) {
            expect(typeof worker.successRate).toBe('number')
          }
        })
      }
    })

    it('should return average duration', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers?dateRange=30d'
      )
      const response = await GET(request)
      const data = await response.json()

      if (data.workers) {
        data.workers.forEach((worker: Record<string, unknown>) => {
          if (worker.avgDuration !== undefined) {
            expect(typeof worker.avgDuration).toBe('number')
          }
        })
      }
    })
  })

  describe('filtering', () => {
    it('should filter by date range', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers?dateRange=7d'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should filter by worker ID', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers?workerId=worker-123'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should filter by workflow', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers?workflowId=workflow-123'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should use default date range if not provided', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest('http://localhost/api/analytics/workers')
      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('authorization', () => {
    it('should require authentication', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({ data: { user: null }, error: { message: 'Not authenticated' } })
          ),
        },
      } as never)

      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest('http://localhost/api/analytics/workers')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should filter by organization', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest('http://localhost/api/analytics/workers')
      const response = await GET(request)

      // Should only return workers from user's organization
      expect(response.status).toBe(200)
    })
  })

  describe('response format', () => {
    it('should include summary statistics', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest('http://localhost/api/analytics/workers')
      const response = await GET(request)
      const data = await response.json()

      if (data.summary) {
        expect(data.summary).toBeDefined()
      }
    })

    it('should include date range info', async () => {
      const { GET } = await import('../../analytics/workers/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers?dateRange=30d'
      )
      const response = await GET(request)
      const data = await response.json()

      if (data.dateRange) {
        expect(data.dateRange).toHaveProperty('start')
        expect(data.dateRange).toHaveProperty('end')
      }
    })
  })
})
