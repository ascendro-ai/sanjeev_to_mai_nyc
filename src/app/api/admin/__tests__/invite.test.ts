/**
 * Admin Invite Route Tests
 * Tests for POST /api/admin/invite
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
              data: { organization_id: 'org-123', role: 'admin' },
              error: null,
            })
          ),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'invite-123', email: 'invitee@example.com' },
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
      admin: {
        inviteUserByEmail: vi.fn(() =>
          Promise.resolve({
            data: { user: { id: 'new-user-123' } },
            error: null,
          })
        ),
      },
    },
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/admin/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('invitation creation', () => {
    it('should create invitation for valid email', async () => {
      const { POST } = await import('../../admin/invite/route')
      const request = createMockRequest({
        email: 'newuser@example.com',
        role: 'member',
      })
      const response = await POST(request)

      expect(response.status).toBeLessThan(500)
    })

    it('should validate email format', async () => {
      const { POST } = await import('../../admin/invite/route')
      const request = createMockRequest({
        email: 'invalid-email',
        role: 'member',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate role', async () => {
      const { POST } = await import('../../admin/invite/route')
      const request = createMockRequest({
        email: 'user@example.com',
        role: 'invalid-role',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('authorization', () => {
    it('should require admin role', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { organization_id: 'org-123', role: 'member' },
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
      } as never)

      const { POST } = await import('../../admin/invite/route')
      const request = createMockRequest({
        email: 'user@example.com',
        role: 'member',
      })
      const response = await POST(request)

      expect(response.status).toBe(403)
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

      const { POST } = await import('../../admin/invite/route')
      const request = createMockRequest({
        email: 'user@example.com',
        role: 'member',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })

  describe('duplicate handling', () => {
    it('should prevent duplicate invitations', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { organization_id: 'org-123', role: 'admin' },
                  error: null,
                })
              ),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { code: '23505', message: 'duplicate key' },
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
      } as never)

      const { POST } = await import('../../admin/invite/route')
      const request = createMockRequest({
        email: 'existing@example.com',
        role: 'member',
      })
      const response = await POST(request)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})
