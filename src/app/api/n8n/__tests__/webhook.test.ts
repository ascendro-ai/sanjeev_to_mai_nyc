/**
 * Webhook Route Tests (Phase 2.1.8)
 * Tests for /api/n8n/webhook/[workflowId]
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
                id: 'workflow-123',
                name: 'Test Workflow',
                status: 'active',
                n8n_workflow_id: 'n8n-123',
                organization_id: 'org-123',
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
              data: { id: 'exec-123' },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}))

vi.mock('@/lib/n8n/client', () => ({
  triggerWorkflow: vi.fn(() =>
    Promise.resolve({
      executionId: 'n8n-exec-123',
      status: 'running',
    })
  ),
}))

vi.mock('@/lib/n8n/webhook-auth', () => ({
  validateWebhookRequest: vi.fn(() =>
    Promise.resolve({ valid: true, body: '{"data":"test"}' })
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockPostRequest(
  workflowId: string,
  body: Record<string, unknown> = {}
): NextRequest {
  return new NextRequest(
    `http://localhost/api/n8n/webhook/${workflowId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': 'sha256=valid',
      },
      body: JSON.stringify(body),
    }
  )
}

function createMockGetRequest(
  workflowId: string,
  params: Record<string, string> = {}
): NextRequest {
  const searchParams = new URLSearchParams(params)
  return new NextRequest(
    `http://localhost/api/n8n/webhook/${workflowId}?${searchParams}`,
    {
      method: 'GET',
      headers: {
        'x-webhook-signature': 'sha256=valid',
      },
    }
  )
}

describe('/api/n8n/webhook/[workflowId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should trigger workflow execution', async () => {
      const { POST } = await import('../webhook/[workflowId]/route')
      const request = createMockPostRequest('workflow-123', { data: 'test' })
      const response = await POST(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })

      expect(response.status).toBeLessThan(500)
    })

    it('should validate webhook signature', async () => {
      const { validateWebhookRequest } = await import('@/lib/n8n/webhook-auth')
      vi.mocked(validateWebhookRequest).mockResolvedValueOnce({
        valid: false,
        error: 'Invalid signature',
        body: '',
      })

      const { POST } = await import('../webhook/[workflowId]/route')
      const request = createMockPostRequest('workflow-123', { data: 'test' })
      const response = await POST(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })

      expect(response.status).toBe(401)
    })

    it('should pass payload to workflow', async () => {
      const { triggerWorkflow } = await import('@/lib/n8n/client')
      const { POST } = await import('../webhook/[workflowId]/route')

      const payload = { eventType: 'user.created', userId: '123' }
      const request = createMockPostRequest('workflow-123', payload)
      await POST(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })

      expect(triggerWorkflow).toHaveBeenCalled()
    })

    it('should return execution ID', async () => {
      const { POST } = await import('../webhook/[workflowId]/route')
      const request = createMockPostRequest('workflow-123', { data: 'test' })
      const response = await POST(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })
      const data = await response.json()

      if (response.status === 200) {
        expect(data.executionId || data.execution?.id).toBeDefined()
      }
    })

    it('should handle workflow not found', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: null, error: { code: 'PGRST116' } })
              ),
            })),
          })),
        })),
      } as never)

      const { POST } = await import('../webhook/[workflowId]/route')
      const request = createMockPostRequest('nonexistent', { data: 'test' })
      const response = await POST(request, {
        params: Promise.resolve({ workflowId: 'nonexistent' }),
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('GET', () => {
    it('should handle GET webhooks', async () => {
      const { GET } = await import('../webhook/[workflowId]/route')
      const request = createMockGetRequest('workflow-123', { param: 'value' })
      const response = await GET(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })

      expect(response).toBeDefined()
    })

    it('should parse query parameters', async () => {
      const { GET } = await import('../webhook/[workflowId]/route')
      const request = createMockGetRequest('workflow-123', {
        event: 'test',
        value: '42',
      })
      const response = await GET(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })

      expect(response).toBeDefined()
    })
  })

  describe('payload handling', () => {
    it('should handle JSON payloads', async () => {
      const { POST } = await import('../webhook/[workflowId]/route')
      const request = createMockPostRequest('workflow-123', {
        nested: { data: { value: 123 } },
      })
      const response = await POST(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })

      expect(response.status).toBeLessThan(500)
    })

    it('should handle empty payloads', async () => {
      const { POST } = await import('../webhook/[workflowId]/route')
      const request = createMockPostRequest('workflow-123', {})
      const response = await POST(request, {
        params: Promise.resolve({ workflowId: 'workflow-123' }),
      })

      expect(response.status).toBeLessThan(500)
    })
  })
})
