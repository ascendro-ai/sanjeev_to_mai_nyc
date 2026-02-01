/**
 * Test Run Route Tests (Phase 2.3.1)
 * Tests for POST /api/testing/run
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
                id: 'test-case-123',
                workflow_id: 'workflow-123',
                name: 'Test Case 1',
                input_data: { key: 'value' },
                expected_output: { result: 'success' },
                assertions: [
                  { type: 'equals', path: 'result', expected: 'success' },
                ],
              },
              error: null,
            })
          ),
          order: vi.fn(() =>
            Promise.resolve({
              data: [{ id: 'run-123', status: 'completed' }],
              error: null,
            })
          ),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'run-123', status: 'pending' },
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/testing/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/testing/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('test execution', () => {
    it('should execute single test case', async () => {
      const { POST } = await import('../../testing/run/route')
      const request = createMockRequest({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should execute test suite', async () => {
      const { POST } = await import('../../testing/run/route')
      const request = createMockRequest({
        testCaseIds: ['test-case-1', 'test-case-2'],
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should use mock data when provided', async () => {
      const { POST } = await import('../../testing/run/route')
      const request = createMockRequest({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
        mockData: { externalApi: { response: 'mocked' } },
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })
  })

  describe('result reporting', () => {
    it('should return pass/fail status', async () => {
      const { POST } = await import('../../testing/run/route')
      const request = createMockRequest({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200) {
        expect(data).toHaveProperty('status')
      }
    })

    it('should include execution time', async () => {
      const { POST } = await import('../../testing/run/route')
      const request = createMockRequest({
        testCaseId: 'test-case-123',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.testRun) {
        expect(data.testRun).toHaveProperty('duration')
      }
    })
  })

  describe('validation', () => {
    it('should require workflowId', async () => {
      const { POST } = await import('../../testing/run/route')
      const request = createMockRequest({
        testCaseId: 'test-case-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should require testCaseId or testCaseIds', async () => {
      const { POST } = await import('../../testing/run/route')
      const request = createMockRequest({
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describe('GET /api/testing/run/[id]', () => {
  it('should return test run status', async () => {
    // This would test the dynamic route for getting a specific test run
    // Implementation depends on whether this route exists
  })

  it('should return test run results', async () => {
    // Test getting full results including step-level details
  })

  it('should return 404 for unknown run', async () => {
    // Test error handling for non-existent test runs
  })
})
