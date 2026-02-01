/*
 * Gemini Extract API Route Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../extract/route'
import { mockGeminiModel, mockGeminiExtract, mockGeminiResponse } from '@/__mocks__/gemini'
import { mockSupabaseClient } from '@/__mocks__/supabase'

// Mock dependencies
vi.mock('@/lib/gemini/server', () => ({
  getModel: () => mockGeminiModel
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockSupabaseClient
}))

describe('POST /api/gemini/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should extract workflow from conversation messages', async () => {
    mockGeminiExtract(mockGeminiResponse)

    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { sender: 'user', text: 'I need an email automation workflow' },
          { sender: 'assistant', text: 'What should happen with the emails?' },
          { sender: 'user', text: 'Read them, analyze, and respond' },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.workflow).toBeDefined()
    expect(data.workflow.steps).toBeInstanceOf(Array)
  })

  it('should generate step IDs if not provided', async () => {
    mockGeminiExtract({
      workflowName: 'Test Workflow',
      description: 'Test',
      steps: [
        { label: 'Step 1', type: 'trigger', order: 0 },
        { label: 'Step 2', type: 'action', order: 1 },
      ]
    })

    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ sender: 'user', text: 'Create workflow' }] }),
    })

    const response = await POST(request)
    const data = await response.json()

    data.workflow.steps.forEach((step: any) => {
      expect(step.id).toBeDefined()
      expect(typeof step.id).toBe('string')
    })
  })

  it('should correctly classify step types: trigger, action, decision, end', async () => {
    mockGeminiExtract({
      workflowName: 'Multi-step Workflow',
      description: 'Complex workflow',
      steps: [
        { id: '1', label: 'Start', type: 'trigger', order: 0 },
        { id: '2', label: 'Process', type: 'action', order: 1 },
        { id: '3', label: 'Decide', type: 'decision', order: 2 },
        { id: '4', label: 'Finish', type: 'end', order: 3 },
      ]
    })

    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ sender: 'user', text: 'Complex workflow' }] }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.workflow.steps[0].type).toBe('trigger')
    expect(data.workflow.steps[1].type).toBe('action')
    expect(data.workflow.steps[2].type).toBe('decision')
    expect(data.workflow.steps[3].type).toBe('end')
  })

  it('should auto-assign human/ai based on conversation context', async () => {
    mockGeminiExtract({
      workflowName: 'Review Workflow',
      description: 'Workflow with human review',
      steps: [
        { id: '1', label: 'Receive', type: 'trigger', order: 0, assignedTo: { type: 'ai', agentName: 'Bot' } },
        { id: '2', label: 'Review', type: 'action', order: 1, assignedTo: { type: 'human', agentName: 'Manager' } },
      ]
    })

    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { sender: 'user', text: 'The bot receives the request' },
          { sender: 'user', text: 'Then a human manager reviews it' },
        ],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.workflow.steps[0].assignedTo.type).toBe('ai')
    expect(data.workflow.steps[1].assignedTo.type).toBe('human')
  })

  it('should handle malformed JSON from Gemini gracefully', async () => {
    mockGeminiModel.generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'Invalid JSON response { broken'
      }
    })

    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ sender: 'user', text: 'Create workflow' }] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })

  it('should return workflow with name and description', async () => {
    mockGeminiExtract({
      workflowName: 'Email Automation',
      description: 'Automates customer email responses',
      steps: [{ id: '1', label: 'Start', type: 'trigger', order: 0 }]
    })

    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ sender: 'user', text: 'Email automation' }] }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.workflow.name).toBe('Email Automation')
    expect(data.workflow.description).toBe('Automates customer email responses')
  })

  it('should handle empty conversation', async () => {
    const request = new Request('http://localhost/api/gemini/extract', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
