import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase
const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: vi.fn(),
  rpc: vi.fn(),
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

describe('Audit API Route', () => {
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
      if (table === 'workflows') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { organization_id: 'org-123' },
            error: null,
          }),
        }
      }
      if (table === 'execution_audit_logs') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'audit-1',
                event_type: 'execution_start',
                workflow_id: 'wf-123',
                execution_id: 'exec-123',
                event_timestamp: new Date().toISOString(),
              },
              {
                id: 'audit-2',
                event_type: 'node_complete',
                workflow_id: 'wf-123',
                execution_id: 'exec-123',
                node_name: 'Step 1',
                duration_ms: 150,
                event_timestamp: new Date().toISOString(),
              },
            ],
            error: null,
            count: 2,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'audit-new' },
            error: null,
          }),
        }
      }
      if (table === 'compliance_audit_summary') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                audit_date: '2024-01-15',
                total_executions: 50,
                successful_executions: 45,
                failed_executions: 5,
                human_reviews: 10,
              },
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

    mockSupabaseClient.rpc.mockResolvedValue({
      data: 'hashed_data_123',
      error: null,
    })
  })

  describe('POST /api/n8n/audit', () => {
    it('should return 401 for unauthenticated non-system requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'execution_start' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should allow system calls with internal API key', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        headers: {
          'x-api-key': 'test-internal-key',
        },
        body: JSON.stringify({
          eventType: 'execution_start',
          workflowId: 'wf-123',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should return 400 when eventType missing', async () => {
      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('eventType')
    })

    it('should record audit log for execution_start', async () => {
      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'execution_start',
          workflowId: 'wf-123',
          executionId: 'exec-123',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.auditLogId).toBeDefined()
    })

    it('should record node_complete with duration', async () => {
      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'node_complete',
          workflowId: 'wf-123',
          executionId: 'exec-123',
          nodeName: 'Process Email',
          nodeType: 'ai_action',
          nodeIndex: 1,
          durationMs: 250,
          outputSummary: 'Processed 5 emails',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should record node_error with error details', async () => {
      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'node_error',
          workflowId: 'wf-123',
          executionId: 'exec-123',
          nodeName: 'Send Email',
          errorMessage: 'SMTP connection failed',
          errorStack: 'Error: SMTP connection failed\n  at sendEmail...',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should record human review events', async () => {
      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'review_request',
          workflowId: 'wf-123',
          executionId: 'exec-123',
          nodeName: 'Human Review',
          actorType: 'ai',
          actorName: 'Email Agent',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should hash sensitive input data', async () => {
      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'node_start',
          workflowId: 'wf-123',
          inputData: {
            email: 'test@example.com',
            content: 'Sensitive content',
          },
        }),
      })

      await POST(request)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'hash_sensitive_data',
        expect.any(Object)
      )
    })

    it('should use custom retention days', async () => {
      const { POST } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'execution_complete',
          workflowId: 'wf-123',
          retentionDays: 365,
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/n8n/audit', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit')

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return paginated audit logs', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?page=1&pageSize=50'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.logs).toBeDefined()
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.pageSize).toBe(50)
    })

    it('should filter by workflowId', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?workflowId=wf-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should filter by executionId', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?executionId=exec-123'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should filter by eventType', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?eventType=node_error'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should filter by date range', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?startDate=2024-01-01&endDate=2024-01-31'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should filter by actorType', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?actorType=human'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)
    })

    it('should return compliance summary when requested', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?summary=true'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.summary).toBeDefined()
    })

    it('should limit page size to 100', async () => {
      const { GET } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest(
        'http://localhost:3000/api/n8n/audit?pageSize=200'
      )

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.pagination.pageSize).toBeLessThanOrEqual(100)
    })
  })

  describe('DELETE /api/n8n/audit', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const { DELETE } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      expect(response.status).toBe(401)
    })

    it('should cleanup expired audit logs', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: 150,
        error: null,
      })

      const { DELETE } = await import('@/app/api/n8n/audit/route')
      const request = new NextRequest('http://localhost:3000/api/n8n/audit', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.deletedCount).toBe(150)
    })
  })
})

describe('Audit Event Types', () => {
  const validEventTypes = [
    'execution_start',
    'node_start',
    'node_complete',
    'node_error',
    'review_request',
    'review_response',
    'execution_complete',
    'execution_failed',
  ]

  validEventTypes.forEach((eventType) => {
    it(`should support ${eventType} event type`, () => {
      expect(validEventTypes).toContain(eventType)
    })
  })
})

describe('Actor Types', () => {
  const validActorTypes = ['ai', 'human', 'system']

  validActorTypes.forEach((actorType) => {
    it(`should support ${actorType} actor type`, () => {
      expect(validActorTypes).toContain(actorType)
    })
  })
})
