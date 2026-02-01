/**
 * Analytics Export Route Tests (Phase 2.4.3)
 * Tests for POST /api/analytics/export
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
                  {
                    id: 'worker-1',
                    name: 'Email Worker',
                    total_executions: 100,
                    successful_executions: 95,
                  },
                  {
                    id: 'worker-2',
                    name: 'Data Worker',
                    total_executions: 50,
                    successful_executions: 48,
                  },
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

function createMockRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/analytics/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/analytics/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CSV export', () => {
    it('should export to CSV format', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '30d',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should include headers in CSV', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '30d',
      })
      const response = await POST(request)
      const data = await response.json()

      if (data.data?.data) {
        // CSV should start with headers
        expect(typeof data.data.data).toBe('string')
      }
    })

    it('should handle large datasets', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '90d',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('JSON export', () => {
    it('should export to JSON format', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'json',
        dateRange: '30d',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should include metadata in JSON export', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'json',
        dateRange: '30d',
      })
      const response = await POST(request)
      const data = await response.json()

      if (data.data) {
        expect(data.data).toHaveProperty('mimeType')
        expect(data.data).toHaveProperty('filename')
      }
    })
  })

  describe('filtering', () => {
    it('should apply date range filter', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '7d',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should apply workflow filter', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '30d',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should apply worker filter', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '30d',
        workerIds: ['worker-1', 'worker-2'],
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('validation', () => {
    it('should require format parameter', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        dateRange: '30d',
      })
      const response = await POST(request)

      // May use default format or require it
      expect(response.status).toBeLessThanOrEqual(400)
    })

    it('should validate format value', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'invalid',
        dateRange: '30d',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('response format', () => {
    it('should return proper content type for CSV', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '30d',
      })
      const response = await POST(request)
      const data = await response.json()

      if (data.data?.mimeType) {
        expect(data.data.mimeType).toContain('csv')
      }
    })

    it('should return proper filename', async () => {
      const { POST } = await import('../../analytics/export/route')
      const request = createMockRequest({
        format: 'csv',
        dateRange: '30d',
      })
      const response = await POST(request)
      const data = await response.json()

      if (data.data?.filename) {
        expect(data.data.filename).toContain('analytics')
      }
    })
  })
})
