/*
 * n8n Execution Update API Route Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../execution-update/route'
import { mockSupabaseClient } from '@/__mocks__/supabase'
import { createExecution } from '@/__tests__/factories'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabaseClient
}))

describe('POST /api/n8n/execution-update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 when missing executionId', async () => {
    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({ stepIndex: 0, status: 'completed' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should update execution step status', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 1,
        status: 'completed',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('execution_steps')
  })

  it('should store step output data', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((data) => {
        expect(data.output).toEqual({ result: 'success', message: 'Email sent' })
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 1,
        status: 'completed',
        output: { result: 'success', message: 'Email sent' },
      }),
    })

    await POST(request)
  })

  it('should create activity log entry', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 1,
        status: 'completed',
      }),
    })

    await POST(request)

    const calls = mockSupabaseClient.from.mock.calls
    const activityLogCall = calls.find(call => call[0] === 'activity_logs')
    expect(activityLogCall).toBeDefined()
  })

  it('should update current_step_index on execution', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 2,
        status: 'running',
      }),
    })

    await POST(request)

    const calls = mockSupabaseClient.from.mock.calls
    const executionsCall = calls.find(call => call[0] === 'executions')
    expect(executionsCall).toBeDefined()
  })

  it('should handle step failure status', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((data) => {
        expect(data.status).toBe('failed')
        expect(data.error).toBe('Connection timeout')
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 1,
        status: 'failed',
        error: 'Connection timeout',
      }),
    })

    await POST(request)
  })

  it('should handle step waiting_for_review status', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((data) => {
        expect(data.status).toBe('waiting_for_review')
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 2,
        status: 'waiting_for_review',
      }),
    })

    await POST(request)
  })

  it('should set started_at for first step update', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((data) => {
        expect(data.started_at).toBeDefined()
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 0,
        status: 'running',
      }),
    })

    await POST(request)
  })

  it('should set completed_at when step is completed', async () => {
    mockSupabaseClient.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((data) => {
        if (data.status === 'completed') {
          expect(data.completed_at).toBeDefined()
        }
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }),
    })

    const request = new Request('http://localhost/api/n8n/execution-update', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepIndex: 1,
        status: 'completed',
      }),
    })

    await POST(request)
  })
})
