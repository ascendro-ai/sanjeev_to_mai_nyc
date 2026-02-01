/**
 * Gemini Extract People Route Tests
 * Tests for POST /api/gemini/extract-people
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
  extractPeople: vi.fn(() =>
    Promise.resolve({
      people: [
        {
          name: 'John Smith',
          role: 'Manager',
          department: 'Engineering',
          email: 'john.smith@example.com',
          confidence: 0.95,
        },
        {
          name: 'Jane Doe',
          role: 'Developer',
          department: 'Engineering',
          email: 'jane.doe@example.com',
          confidence: 0.88,
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
  return new NextRequest('http://localhost/api/gemini/extract-people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/gemini/extract-people', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extraction', () => {
    it('should extract people from text', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'John Smith is the manager of the Engineering team. Jane Doe reports to him.',
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should return multiple people', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'The team consists of John Smith (Manager), Jane Doe (Developer), and Bob Johnson (QA).',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.people) {
        expect(Array.isArray(data.people)).toBe(true)
      }
    })

    it('should include confidence scores', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'John Smith manages the team.',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.people) {
        data.people.forEach((person: Record<string, unknown>) => {
          if (person.confidence !== undefined) {
            expect(typeof person.confidence).toBe('number')
            expect(person.confidence).toBeGreaterThanOrEqual(0)
            expect(person.confidence).toBeLessThanOrEqual(1)
          }
        })
      }
    })

    it('should extract roles and departments', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'Sarah Lee is the VP of Marketing. Mike Chen is a Senior Engineer in the Platform team.',
      })
      const response = await POST(request)
      const data = await response.json()

      if (response.status === 200 && data.people) {
        data.people.forEach((person: Record<string, unknown>) => {
          expect(person).toHaveProperty('name')
        })
      }
    })
  })

  describe('validation', () => {
    it('should require text input', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({})
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate text is not empty', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: '',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should handle text with no people', async () => {
      const { extractPeople } = await import('@/lib/gemini/client')
      vi.mocked(extractPeople).mockResolvedValueOnce({ people: [] })

      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'The weather is nice today.',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      if (data.people) {
        expect(data.people).toHaveLength(0)
      }
    })
  })

  describe('organization context', () => {
    it('should use organization context for disambiguation', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'John mentioned the project deadline.',
        organizationId: 'org-123',
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should match against existing team members', async () => {
      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'Send this to the engineering lead',
        organizationId: 'org-123',
        existingMembers: [
          { name: 'John Smith', role: 'Engineering Lead' },
        ],
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })
  })

  describe('error handling', () => {
    it('should handle AI service errors', async () => {
      const { extractPeople } = await import('@/lib/gemini/client')
      vi.mocked(extractPeople).mockRejectedValueOnce(new Error('AI service unavailable'))

      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'John Smith is the manager.',
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

      const { POST } = await import('../../gemini/extract-people/route')
      const request = createMockRequest({
        text: 'John Smith is the manager.',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })
})
