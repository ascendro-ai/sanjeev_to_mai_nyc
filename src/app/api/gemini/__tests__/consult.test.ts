/*
 * Gemini Consult API Route Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../consult/route'
import { mockGeminiModel, mockGeminiConsult } from '@/__mocks__/gemini'
import { mockSupabaseClient } from '@/__mocks__/supabase'

// Mock dependencies
vi.mock('@/lib/gemini/server', () => ({
  getModel: () => mockGeminiModel
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabaseClient
}))

describe('POST /api/gemini/consult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({ messages: [], questionCount: 0 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when messages array is missing', async () => {
    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({ questionCount: 0 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return consultant response with isComplete=false when under MAX_QUESTIONS', async () => {
    mockGeminiConsult({
      response: 'Tell me more about your workflow...',
      isComplete: false,
    })

    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ sender: 'user', text: 'I need to automate emails' }],
        questionCount: 2,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isComplete).toBe(false)
    expect(data.response).toBeDefined()
  })

  it('should return isComplete=true when questionCount >= MAX_QUESTIONS', async () => {
    mockGeminiConsult({
      response: 'Great, I have all the information I need!',
      isComplete: true,
    })

    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ sender: 'user', text: 'Yes, that covers everything' }],
        questionCount: 5,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.isComplete).toBe(true)
  })

  it('should detect final confirmation signals correctly', async () => {
    mockGeminiConsult({
      response: 'Perfect, let me create your workflow.',
      isComplete: true,
    })

    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { sender: 'user', text: 'I need email automation' },
          { sender: 'assistant', text: 'What should happen with the emails?' },
          { sender: 'user', text: "That's perfect, let's build it" },
        ],
        questionCount: 3,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.isComplete).toBe(true)
  })

  it('should acknowledge intermediate responses appropriately', async () => {
    mockGeminiConsult({
      response: 'Got it. What happens after that step?',
      isComplete: false,
    })

    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { sender: 'user', text: 'I need to process customer orders' },
          { sender: 'assistant', text: 'What triggers this workflow?' },
          { sender: 'user', text: 'An email from the customer' },
        ],
        questionCount: 2,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.isComplete).toBe(false)
  })

  it('should handle Gemini API errors gracefully', async () => {
    mockGeminiModel.generateContent.mockRejectedValueOnce(new Error('Gemini API error'))

    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ sender: 'user', text: 'Hello' }],
        questionCount: 0,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })

  it('should include conversation context in prompt', async () => {
    const request = new Request('http://localhost/api/gemini/consult', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { sender: 'user', text: 'I need workflow automation' },
          { sender: 'assistant', text: 'What kind?' },
          { sender: 'user', text: 'For customer support' },
        ],
        questionCount: 2,
      }),
    })

    await POST(request)

    // Verify the prompt includes conversation context
    expect(mockGeminiModel.generateContent).toHaveBeenCalled()
    const callArg = mockGeminiModel.generateContent.mock.calls[0][0]
    expect(callArg).toContain('I need workflow automation')
    expect(callArg).toContain('For customer support')
  })
})
