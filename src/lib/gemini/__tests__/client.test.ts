/**
 * Gemini Client Tests
 * Tests for the Gemini AI client library
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Helper to create a mock Response with all required methods
function createMockResponse(data: unknown, ok = true): Response {
  const body = JSON.stringify(data)
  return {
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(body),
    clone: function() { return createMockResponse(data, ok) },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response
}

// Store original fetch
const originalFetch = global.fetch

describe('Gemini Client', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    global.fetch = mockFetch
    mockFetch.mockResolvedValue(createMockResponse({ response: 'test response' }))
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('consultWorkflow', () => {
    it('should send messages to consult endpoint', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ response: 'What kind of workflow?', isComplete: false })
      )

      const { consultWorkflow } = await import('../client')
      const result = await consultWorkflow(
        [{ sender: 'user', text: 'I need an email workflow' }],
        0
      )

      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/consult', expect.objectContaining({
        method: 'POST',
      }))
      expect(result.response).toBeDefined()
      expect(result.isComplete).toBe(false)
    })

    it('should indicate completion when questions are answered', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ response: 'Great, I have all the info!', isComplete: true })
      )

      const { consultWorkflow } = await import('../client')
      const result = await consultWorkflow(
        [
          { sender: 'user', text: 'Email workflow' },
          { sender: 'assistant', text: 'What triggers it?' },
          { sender: 'user', text: 'New email received' },
        ],
        2
      )

      expect(result.isComplete).toBe(true)
    })

    it('should throw error on failed response', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'API Error' }, false)
      )

      const { consultWorkflow } = await import('../client')

      await expect(consultWorkflow([], 0)).rejects.toThrow('API Error')
    })
  })

  describe('extractWorkflowFromConversation', () => {
    it('should extract workflow from messages', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          workflow: {
            id: 'wf-1',
            name: 'Email Automation',
            steps: [{ id: 's1', name: 'Trigger' }],
          },
        })
      )

      const { extractWorkflowFromConversation } = await import('../client')
      const result = await extractWorkflowFromConversation([
        { sender: 'user', text: 'Build email automation' },
      ])

      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/extract', expect.any(Object))
      expect(result).toBeDefined()
      expect(result?.name).toBe('Email Automation')
    })

    it('should return null on failed extraction', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Failed' }, false)
      )

      const { extractWorkflowFromConversation } = await import('../client')
      const result = await extractWorkflowFromConversation([])

      expect(result).toBeNull()
    })

    it('should pass existing workflow ID for updates', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ workflow: { id: 'existing-id' } })
      )

      const { extractWorkflowFromConversation } = await import('../client')
      await extractWorkflowFromConversation([], 'existing-id')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gemini/extract',
        expect.objectContaining({
          body: expect.stringContaining('existing-id'),
        })
      )
    })
  })

  describe('getInitialRequirementsMessage', () => {
    it('should get initial message for a step', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ message: 'Let me help you configure this step.' })
      )

      const { getInitialRequirementsMessage } = await import('../client')
      const result = await getInitialRequirementsMessage(
        { id: 's1', name: 'Email Step', type: 'action' },
        'My Workflow'
      )

      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/requirements', expect.objectContaining({
        body: expect.stringContaining('init'),
      }))
      expect(result).toBe('Let me help you configure this step.')
    })

    it('should throw on error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Failed to get message' }, false)
      )

      const { getInitialRequirementsMessage } = await import('../client')

      await expect(
        getInitialRequirementsMessage({ id: 's1', name: 'Step', type: 'action' })
      ).rejects.toThrow('Failed to get message')
    })
  })

  describe('gatherRequirementsConversation', () => {
    it('should continue requirements conversation', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ response: 'What email address should I use?' })
      )

      const { gatherRequirementsConversation } = await import('../client')
      const result = await gatherRequirementsConversation(
        { id: 's1', name: 'Send Email', type: 'action' },
        [{ sender: 'user', text: 'I want to send to the manager' }]
      )

      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/requirements', expect.objectContaining({
        body: expect.stringContaining('chat'),
      }))
      expect(result).toBe('What email address should I use?')
    })
  })

  describe('buildAutomation', () => {
    it('should build automation from conversation', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          requirementsText: 'Send email when triggered',
          blueprint: {
            greenList: ['send_email'],
            redList: ['delete_data'],
          },
          customRequirements: ['Must include signature'],
        })
      )

      const { buildAutomation } = await import('../client')
      const result = await buildAutomation(
        { id: 's1', name: 'Email', type: 'action' },
        [{ sender: 'user', text: 'Send notification email' }]
      )

      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/requirements', expect.objectContaining({
        body: expect.stringContaining('build'),
      }))
      expect(result.requirementsText).toBeDefined()
      expect(result.blueprint.greenList).toContain('send_email')
      expect(result.customRequirements).toHaveLength(1)
    })
  })

  describe('buildAgentsFromWorkflowRequirements', () => {
    it('should build agents from workflow', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          agents: [
            { id: 'a1', name: 'Email Agent', capabilities: ['send_email'] },
            { id: 'a2', name: 'Data Agent', capabilities: ['process_data'] },
          ],
        })
      )

      const { buildAgentsFromWorkflowRequirements } = await import('../client')
      const result = await buildAgentsFromWorkflowRequirements(
        { id: 'wf1', name: 'Test Workflow', steps: [] },
        'My Digital Worker'
      )

      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/build-agents', expect.any(Object))
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Email Agent')
    })

    it('should throw on error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Failed to build agents' }, false)
      )

      const { buildAgentsFromWorkflowRequirements } = await import('../client')

      await expect(
        buildAgentsFromWorkflowRequirements({ id: 'wf1', name: 'Test', steps: [] })
      ).rejects.toThrow('Failed to build agents')
    })
  })

  describe('extractPeopleFromConversation', () => {
    it('should extract people from conversation', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          people: [
            { id: 'p1', name: 'John Smith', role: 'Manager' },
            { id: 'p2', name: 'Jane Doe', role: 'Developer' },
          ],
        })
      )

      const { extractPeopleFromConversation } = await import('../client')
      const result = await extractPeopleFromConversation([
        { sender: 'user', text: 'John Smith is the manager, Jane Doe is a developer' },
      ])

      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/extract-people', expect.any(Object))
      expect(result).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Failed' }, false)
      )

      const { extractPeopleFromConversation } = await import('../client')
      const result = await extractPeopleFromConversation([])

      expect(result).toEqual([])
    })

    it('should handle response without people', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({})
      )

      const { extractPeopleFromConversation } = await import('../client')
      const result = await extractPeopleFromConversation([])

      expect(result).toEqual([])
    })
  })
})
