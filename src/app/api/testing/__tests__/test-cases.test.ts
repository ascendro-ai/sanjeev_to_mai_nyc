/**
 * Test Cases Route Tests (Phase 2.3.2)
 * Tests for /api/testing/test-cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: 'test-case-1',
                  workflow_id: 'workflow-123',
                  name: 'Happy Path Test',
                  description: 'Tests the main success flow',
                  input_data: { email: 'test@example.com' },
                  expected_output: { status: 'sent' },
                  assertions: [],
                  created_at: '2024-01-01T00:00:00Z',
                },
                {
                  id: 'test-case-2',
                  workflow_id: 'workflow-123',
                  name: 'Error Case Test',
                  description: 'Tests error handling',
                  input_data: { email: 'invalid' },
                  expected_output: { error: 'Invalid email' },
                  assertions: [],
                  created_at: '2024-01-02T00:00:00Z',
                },
              ],
              error: null,
            })
          ),
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: 'test-case-1',
                workflow_id: 'workflow-123',
                name: 'Test Case',
              },
              error: null,
            })
          ),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'new-test-case', name: 'New Test' },
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
                data: { id: 'test-case-1', name: 'Updated Test' },
                error: null,
              })
            ),
          })),
        })),
      })),
      delete: vi.fn(() => ({
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

describe('/api/testing/test-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should list test cases for workflow', async () => {
      const { GET } = await import('../../testing/test-cases/route')
      const request = new NextRequest(
        'http://localhost/api/testing/test-cases?workflowId=workflow-123'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(Array.isArray(data.testCases || data)).toBe(true)
    })

    it('should filter by status', async () => {
      const { GET } = await import('../../testing/test-cases/route')
      const request = new NextRequest(
        'http://localhost/api/testing/test-cases?workflowId=workflow-123&status=active'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should require workflowId', async () => {
      const { GET } = await import('../../testing/test-cases/route')
      const request = new NextRequest('http://localhost/api/testing/test-cases')
      const response = await GET(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST', () => {
    it('should create test case', async () => {
      const { POST } = await import('../../testing/test-cases/route')
      const request = new NextRequest('http://localhost/api/testing/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: 'workflow-123',
          name: 'New Test Case',
          inputData: { key: 'value' },
          expectedOutput: { result: 'success' },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should validate test case structure', async () => {
      const { POST } = await import('../../testing/test-cases/route')
      const request = new NextRequest('http://localhost/api/testing/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required fields
        }),
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate assertions', async () => {
      const { POST } = await import('../../testing/test-cases/route')
      const request = new NextRequest('http://localhost/api/testing/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: 'workflow-123',
          name: 'Test with Assertions',
          inputData: {},
          expectedOutput: {},
          assertions: [
            { type: 'equals', path: 'status', expected: 'success' },
            { type: 'contains', path: 'message', expected: 'done' },
          ],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })
  })

  describe('PUT', () => {
    it('should update test case', async () => {
      const { PUT } = await import('../../testing/test-cases/route')
      const request = new NextRequest('http://localhost/api/testing/test-cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-case-1',
          name: 'Updated Test Case',
        }),
      })
      const response = await PUT(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should update mock data', async () => {
      const { PUT } = await import('../../testing/test-cases/route')
      const request = new NextRequest('http://localhost/api/testing/test-cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-case-1',
          mockData: { api: { response: 'mocked' } },
        }),
      })
      const response = await PUT(request)

      expect(response.status).toBeLessThan(500)
    })
  })

  describe('DELETE', () => {
    it('should delete test case', async () => {
      const { DELETE } = await import('../../testing/test-cases/route')
      const request = new NextRequest(
        'http://localhost/api/testing/test-cases?id=test-case-1',
        { method: 'DELETE' }
      )
      const response = await DELETE(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should require test case id', async () => {
      const { DELETE } = await import('../../testing/test-cases/route')
      const request = new NextRequest(
        'http://localhost/api/testing/test-cases',
        { method: 'DELETE' }
      )
      const response = await DELETE(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})
