/**
 * Node Types Route Tests (Phase 2.1.6)
 * Tests for GET /api/n8n/node-types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the n8n client
vi.mock('@/lib/n8n/client', () => ({
  getNodeTypes: vi.fn(() =>
    Promise.resolve([
      {
        name: 'n8n-nodes-base.gmail',
        displayName: 'Gmail',
        description: 'Send and receive emails',
        group: ['communication'],
        version: 1,
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        credentials: [{ name: 'gmailOAuth2Api', required: true }],
        properties: [
          { displayName: 'Operation', name: 'operation', type: 'options' },
        ],
      },
      {
        name: 'n8n-nodes-base.slack',
        displayName: 'Slack',
        description: 'Send messages to Slack',
        group: ['communication'],
        version: 1,
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        credentials: [{ name: 'slackApi', required: true }],
        properties: [],
      },
    ])
  ),
  suggestNodeForStep: vi.fn(() => ({
    suggestedNode: 'n8n-nodes-base.gmail',
    displayName: 'Gmail',
    parameters: [],
    availableNodes: [],
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('GET /api/n8n/node-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listing node types', () => {
    it('should return available node types', async () => {
      const { GET } = await import('../node-types/route')
      const request = new NextRequest('http://localhost/api/n8n/node-types')
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should include node metadata', async () => {
      const { GET } = await import('../node-types/route')
      const request = new NextRequest('http://localhost/api/n8n/node-types?stepType=action&stepLabel=Send%20Email')
      const response = await GET(request)
      const data = await response.json()

      expect(data).toHaveProperty('suggestedNode')
      expect(data).toHaveProperty('displayName')
    })
  })

  describe('step type suggestion', () => {
    it('should suggest node based on step type and label', async () => {
      const { GET } = await import('../node-types/route')
      const params = new URLSearchParams({
        stepType: 'action',
        stepLabel: 'Send Email',
      })
      const request = new NextRequest(`http://localhost/api/n8n/node-types?${params}`)
      const response = await GET(request)
      const data = await response.json()

      expect(data.suggestedNode).toBeDefined()
    })

    it('should return available alternative nodes', async () => {
      const { GET } = await import('../node-types/route')
      const params = new URLSearchParams({
        stepType: 'action',
        stepLabel: 'Send Email',
      })
      const request = new NextRequest(`http://localhost/api/n8n/node-types?${params}`)
      const response = await GET(request)
      const data = await response.json()

      expect(data.availableNodes).toBeDefined()
      expect(Array.isArray(data.availableNodes)).toBe(true)
    })
  })

  describe('node schema', () => {
    it('should return node parameters schema', async () => {
      const { GET } = await import('../node-types/route')
      const params = new URLSearchParams({
        nodeType: 'n8n-nodes-base.gmail',
      })
      const request = new NextRequest(`http://localhost/api/n8n/node-types?${params}`)
      const response = await GET(request)
      const data = await response.json()

      expect(data.parameters).toBeDefined()
    })
  })
})
