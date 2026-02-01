/*
 * n8n Review Response API Route Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../review-response/route'
import { mockSupabaseClient } from '@/__mocks__/supabase'
import { mockN8nClient } from '@/__mocks__/n8n'
import { createReviewRequest } from '@/__tests__/factories'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabaseClient
}))

vi.mock('@/lib/n8n/client', () => ({
  n8nClient: mockN8nClient
}))

global.fetch = vi.fn()

describe('POST /api/n8n/review-response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 when missing reviewId', async () => {
    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when missing action', async () => {
    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({ reviewId: 'review-123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should update review status to approved', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: createReviewRequest({ status: 'approved' }),
        error: null
      }),
    })

    ;(global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) })

    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({
        reviewId: 'review-123',
        action: 'approve',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it('should update review status to rejected', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: createReviewRequest({ status: 'rejected' }),
        error: null
      }),
    })

    ;(global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) })

    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({
        reviewId: 'review-123',
        action: 'reject',
        feedback: 'Please revise',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it('should call n8n callback URL with response', async () => {
    const callbackUrl = 'http://n8n.local/callback/123'
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: createReviewRequest({ callbackUrl }),
        error: null
      }),
    })
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })

    ;(global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) })

    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({
        reviewId: 'review-123',
        action: 'approve',
      }),
    })

    await POST(request)

    expect(global.fetch).toHaveBeenCalledWith(
      callbackUrl,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('approve'),
      })
    )
  })

  it('should handle approval with optional feedback', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation((data) => {
        expect(data.feedback).toBe('Looks good!')
        return {
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createReviewRequest(), error: null }),
    })

    ;(global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) })

    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({
        reviewId: 'review-123',
        action: 'approve',
        feedback: 'Looks good!',
      }),
    })

    await POST(request)
  })

  it('should handle rejection with required feedback', async () => {
    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({
        reviewId: 'review-123',
        action: 'reject',
        // Missing feedback
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('feedback')
  })

  it('should update reviewed_at and reviewer_id', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation((data) => {
        expect(data.reviewed_at).toBeDefined()
        expect(data.reviewer_id).toBe('user-123')
        return {
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createReviewRequest(), error: null }),
    })

    ;(global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) })

    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({
        reviewId: 'review-123',
        action: 'approve',
        reviewerId: 'user-123',
      }),
    })

    await POST(request)
  })

  it('should handle n8n callback failure gracefully', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: createReviewRequest({ callbackUrl: 'http://n8n.local/callback' }),
        error: null
      }),
    })

    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

    const request = new Request('http://localhost/api/n8n/review-response', {
      method: 'POST',
      body: JSON.stringify({
        reviewId: 'review-123',
        action: 'approve',
      }),
    })

    const response = await POST(request)
    // Should still succeed but log the callback failure
    expect(response.status).toBe(200)
  })
})
