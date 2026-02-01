/*
 * n8n Review Request API Route Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../review-request/route'
import { mockSupabaseClient } from '@/__mocks__/supabase'
import { createReviewRequest } from '@/__tests__/factories'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabaseClient
}))

describe('POST /api/n8n/review-request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 when missing executionId', async () => {
    const request = new Request('http://localhost/api/n8n/review-request', {
      method: 'POST',
      body: JSON.stringify({ reviewType: 'approval' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when missing reviewType', async () => {
    const request = new Request('http://localhost/api/n8n/review-request', {
      method: 'POST',
      body: JSON.stringify({ executionId: 'exec-123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should create review_request record in database', async () => {
    const reviewRequest = createReviewRequest({ status: 'pending' })
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: reviewRequest, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/review-request', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepId: 'step-1',
        stepIndex: 0,
        workerName: 'Email Bot',
        reviewType: 'approval',
        reviewData: { action: 'send_email', content: 'Test email' },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('review_requests')
  })

  it('should create activity_log entry', async () => {
    const reviewRequest = createReviewRequest()
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: reviewRequest, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/review-request', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepId: 'step-1',
        reviewType: 'approval',
        reviewData: {},
      }),
    })

    await POST(request)

    // Verify activity log was created
    const calls = mockSupabaseClient.from.mock.calls
    const activityLogCall = calls.find(call => call[0] === 'activity_logs')
    expect(activityLogCall).toBeDefined()
  })

  it('should return reviewId and pending status', async () => {
    const reviewRequest = createReviewRequest({ id: 'review-abc', status: 'pending' })
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: reviewRequest, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/review-request', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepId: 'step-1',
        reviewType: 'approval',
        reviewData: {},
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.reviewId).toBe('review-abc')
    expect(data.status).toBe('pending')
  })

  it('should include callback URL for n8n', async () => {
    const reviewRequest = createReviewRequest()
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: reviewRequest, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/review-request', {
      method: 'POST',
      body: JSON.stringify({
        executionId: 'exec-123',
        stepId: 'step-1',
        reviewType: 'approval',
        reviewData: {},
        callbackUrl: 'http://n8n.local/callback',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.pollUrl).toBeDefined()
  })
})

describe('GET /api/n8n/review-request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 when missing review ID', async () => {
    const request = new Request('http://localhost/api/n8n/review-request', {
      method: 'GET',
    })

    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should return 404 for non-existent review', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/review-request?id=non-existent', {
      method: 'GET',
    })

    const response = await GET(request)
    expect(response.status).toBe(404)
  })

  it('should return review details with chat history', async () => {
    const reviewRequest = createReviewRequest({
      chatHistory: [
        { sender: 'user', text: 'Question?' },
        { sender: 'agent', text: 'Answer!' },
      ]
    })
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: reviewRequest, error: null }),
    })

    const request = new Request('http://localhost/api/n8n/review-request?id=review-123', {
      method: 'GET',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.chatHistory).toHaveLength(2)
  })
})
