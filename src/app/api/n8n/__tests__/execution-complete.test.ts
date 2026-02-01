import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

// Set environment variables before imports
const mockWebhookSecret = 'test-webhook-secret'
process.env.WEBHOOK_SECRET = mockWebhookSecret

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Import after mocks
import { POST } from '../execution-complete/route'

// Helper to create signed requests
function createSignedRequest(body: object): NextRequest {
  const bodyString = JSON.stringify(body)
  const signature = createHmac('sha256', mockWebhookSecret)
    .update(bodyString)
    .digest('hex')

  return new NextRequest('http://localhost/api/n8n/execution-complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': `sha256=${signature}`,
    },
    body: bodyString,
  })
}

// Helper to create unsigned requests
function createUnsignedRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/n8n/execution-complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/n8n/execution-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
  })

  describe('request validation', () => {
    it('should reject unsigned requests', async () => {
      const request = createUnsignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('signature')
    })

    it('should reject missing workflowId', async () => {
      const request = createSignedRequest({
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('workflowId')
    })

    it('should accept valid signed request with workflowId', async () => {
      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('successful completion', () => {
    it('should mark execution as completed', async () => {
      const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'executions') {
          return {
            update: updateMock,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        executionId: 'exec-123',
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
        result: { output: 'success' },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          output_data: { output: 'success' },
        })
      )
    })

    it('should update worker status to active on completion', async () => {
      const workerUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
      const workerUpdateMock = vi.fn().mockReturnValue({ eq: workerUpdateEq })
      const executionUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
      const activityInsert = vi.fn().mockResolvedValue({ data: null, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'digital_workers') {
          return {
            update: workerUpdateMock,
          }
        }
        if (table === 'executions') {
          return {
            update: vi.fn().mockReturnValue({ eq: executionUpdateEq }),
          }
        }
        if (table === 'activity_logs') {
          return {
            insert: activityInsert,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        workerId: 'worker-123',
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(workerUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      )
    })

    it('should log completion activity', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'activity_logs') {
          return {
            insert: insertMock,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        workerName: 'Test Worker',
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workflow_complete',
          worker_name: 'Test Worker',
        })
      )
    })

    it('should return success message with status', async () => {
      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.status).toBe('completed')
      expect(data.message).toContain('completed')
    })
  })

  describe('failed completion', () => {
    it('should mark execution as failed', async () => {
      const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'executions') {
          return {
            update: updateMock,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        executionId: 'exec-123',
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'failed',
        error: 'Connection timeout',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: 'Connection timeout',
        })
      )
    })

    it('should update worker status to error on failure', async () => {
      const workerUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
      const workerUpdateMock = vi.fn().mockReturnValue({ eq: workerUpdateEq })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'digital_workers') {
          return {
            update: workerUpdateMock,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        workerId: 'worker-123',
        status: 'failed',
        error: 'Process crashed',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(workerUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      )
    })

    it('should log error activity', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'activity_logs') {
          return {
            insert: insertMock,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'failed',
        error: 'API error',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        })
      )
    })
  })

  describe('default behavior', () => {
    it('should default to completed status when not provided', async () => {
      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('completed')
    })

    it('should handle request without executionId', async () => {
      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle request without workerId', async () => {
      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        executionId: 'exec-123',
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const request = createSignedRequest({
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Internal server error')
    })

    it('should handle invalid JSON body', async () => {
      const bodyString = 'invalid json'
      const signature = createHmac('sha256', mockWebhookSecret)
        .update(bodyString)
        .digest('hex')

      const request = new NextRequest('http://localhost/api/n8n/execution-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': `sha256=${signature}`,
        },
        body: bodyString,
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })

  describe('result data handling', () => {
    it('should store result data in execution record', async () => {
      const resultData = {
        processedItems: 50,
        skippedItems: 5,
        summary: 'Processing complete',
      }

      const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'executions') {
          return {
            update: updateMock,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        executionId: 'exec-123',
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
        result: resultData,
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          output_data: resultData,
        })
      )
    })

    it('should store error message in execution record', async () => {
      const errorMessage = 'Rate limit exceeded: 429 Too Many Requests'

      const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'executions') {
          return {
            update: updateMock,
          }
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      })

      const request = createSignedRequest({
        executionId: 'exec-123',
        workflowId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'failed',
        error: errorMessage,
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: errorMessage,
        })
      )
    })
  })
})
