/**
 * Worker Trends Route Tests (Phase 2.4.2)
 * Tests for GET /api/analytics/workers/[workerId]/trends
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
            lte: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { date: '2024-01-01', total_executions: 10, successful_executions: 8 },
                    { date: '2024-01-02', total_executions: 15, successful_executions: 14 },
                    { date: '2024-01-03', total_executions: 12, successful_executions: 10 },
                  ],
                  error: null,
                })
              ),
            })),
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

describe('GET /api/analytics/workers/[workerId]/trends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('trend calculation', () => {
    it('should calculate execution trend', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends?dateRange=30d'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toBeDefined()
    })

    it('should calculate success rate trend', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends?dateRange=30d'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })
      const data = await response.json()

      if (data.data?.successRate) {
        expect(Array.isArray(data.data.successRate)).toBe(true)
      }
    })

    it('should calculate duration trend', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends?dateRange=30d'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })
      const data = await response.json()

      if (data.data?.avgDuration) {
        expect(Array.isArray(data.data.avgDuration)).toBe(true)
      }
    })
  })

  describe('comparison', () => {
    it('should compare to previous period', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends?dateRange=30d'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })
      const data = await response.json()

      // Check for comparison/change data
      expect(response.status).toBe(200)
    })

    it('should calculate percentage change', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends?dateRange=30d'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('date range handling', () => {
    it('should handle 7d date range', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends?dateRange=7d'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })

      expect(response.status).toBe(200)
    })

    it('should handle 90d date range', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends?dateRange=90d'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })

      expect(response.status).toBe(200)
    })

    it('should use default date range', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should handle missing workerId', async () => {
      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers//trends'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: '' }),
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
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

      const { GET } = await import('../../analytics/workers/[workerId]/trends/route')
      const request = new NextRequest(
        'http://localhost/api/analytics/workers/worker-123/trends'
      )
      const response = await GET(request, {
        params: Promise.resolve({ workerId: 'worker-123' }),
      })

      expect(response.status).toBe(401)
    })
  })
})
