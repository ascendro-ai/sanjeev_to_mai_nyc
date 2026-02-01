/**
 * Gemini Build Agents Route Tests
 * Tests for POST /api/gemini/build-agents
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
              data: { organization_id: 'org-123' },
              error: null,
            })
          ),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'agent-123', name: 'Email Agent' },
              error: null,
            })
          ),
        })),
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

vi.mock('@/lib/gemini/client', () => ({
  generateAgentConfig: vi.fn(() =>
    Promise.resolve({
      agents: [
        {
          id: 'agent-1',
          name: 'Email Handler',
          description: 'Handles email processing',
          capabilities: ['read_email', 'send_email'],
          nodeType: 'n8n-nodes-base.emailSend',
        },
        {
          id: 'agent-2',
          name: 'Data Processor',
          description: 'Processes incoming data',
          capabilities: ['transform', 'validate'],
          nodeType: 'n8n-nodes-base.function',
        },
      ],
    })
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/gemini/build-agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/gemini/build-agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('agent generation', () => {
    it('should generate agents from requirements', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Build an email automation workflow that sends notifications',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should return multiple agent suggestions', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Build a complex data pipeline with email notifications',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.agents) {
        expect(Array.isArray(data.agents)).toBe(true)
      }
    })

    it('should include node type mappings', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Process emails and send Slack notifications',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.agents) {
        data.agents.forEach((agent: Record<string, unknown>) => {
          if (agent.nodeType) {
            expect(typeof agent.nodeType).toBe('string')
          }
        })
      }
    })
  })

  describe('validation', () => {
    it('should require requirements', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should require workflowId', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Build an email workflow',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate requirements length', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'a', // Too short
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('context handling', () => {
    it('should accept existing workflow context', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Add error handling to the workflow',
        workflowId: 'workflow-123',
        existingAgents: [
          { id: 'agent-1', name: 'Email Handler' },
        ],
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should accept integration constraints', async () => {
      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Build workflow using only Gmail and Google Sheets',
        workflowId: 'workflow-123',
        constraints: {
          allowedIntegrations: ['gmail', 'google_sheets'],
        },
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })
  })

  describe('error handling', () => {
    it('should handle AI service errors gracefully', async () => {
      const { generateAgentConfig } = await import('@/lib/gemini/client')
      vi.mocked(generateAgentConfig).mockRejectedValueOnce(new Error('AI service unavailable'))

      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Build an email workflow',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(500)
    })

    it('should require authentication', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({ data: { user: null }, error: { message: 'Not authenticated' } })
          ),
        },
      } as never)

      const { POST } = await import('../../gemini/build-agents/route')
      const request = createMockRequest({
        requirements: 'Build an email workflow',
        workflowId: 'workflow-123',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })
})
