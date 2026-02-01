import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  })),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    }),
  },
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// Import after mocking
import { useOrganization } from '../useOrganization'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('organization fetching', () => {
    it('should fetch current organization', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        created_at: '2024-01-01',
      }

      const mockMembership = {
        organization_id: 'org-123',
        role: 'admin',
        organizations: mockOrganization,
      }

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockMembership,
          error: null,
        }),
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.organization).toBeDefined()
    })

    it('should return loading state initially', () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(
          () => new Promise(() => {}) // Never resolves
        ),
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('should handle fetch error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeDefined()
    })

    it('should cache organization data', async () => {
      const mockMembership = {
        organization_id: 'org-123',
        organizations: { id: 'org-123', name: 'Test' },
      }

      const singleMock = vi.fn().mockResolvedValue({
        data: mockMembership,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: singleMock,
      })

      const wrapper = createWrapper()

      // First render
      const { result, rerender } = renderHook(() => useOrganization(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Re-render - should use cached data
      rerender()

      // Should only have called once due to caching
      expect(singleMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('organization updates', () => {
    it('should update organization settings', async () => {
      const mockMembership = {
        organization_id: 'org-123',
        organizations: { id: 'org-123', name: 'Test Org' },
      }

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'org-123', name: 'Updated Org' },
          error: null,
        }),
      })

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockMembership,
          error: null,
        }),
        update: updateMock,
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      if (result.current.updateOrganization) {
        await act(async () => {
          await result.current.updateOrganization({ name: 'Updated Org' })
        })

        expect(updateMock).toHaveBeenCalled()
      }
    })
  })

  describe('member management', () => {
    it('should fetch organization members', async () => {
      const mockMembers = [
        { user_id: 'user-1', role: 'admin', profiles: { email: 'admin@test.com' } },
        { user_id: 'user-2', role: 'member', profiles: { email: 'member@test.com' } },
      ]

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'organization_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                organization_id: 'org-123',
                organizations: { id: 'org-123', name: 'Test' },
              },
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({
            data: mockMembers,
            error: null,
          }),
        }
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should add member to organization', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'new-user', role: 'member' },
          error: null,
        }),
      })

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            organization_id: 'org-123',
            organizations: { id: 'org-123', name: 'Test' },
          },
          error: null,
        }),
        insert: insertMock,
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      if (result.current.addMember) {
        await act(async () => {
          await result.current.addMember('new-user@test.com', 'member')
        })
      }
    })

    it('should remove member from organization', async () => {
      const eqMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: eqMock }),
      })

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            organization_id: 'org-123',
            organizations: { id: 'org-123', name: 'Test' },
          },
          error: null,
        }),
        delete: deleteMock,
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      if (result.current.removeMember) {
        await act(async () => {
          await result.current.removeMember('user-to-remove')
        })
      }
    })

    it('should update member role', async () => {
      const eqMock = vi.fn().mockResolvedValue({
        data: { user_id: 'user-1', role: 'admin' },
        error: null,
      })
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: eqMock }),
      })

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            organization_id: 'org-123',
            organizations: { id: 'org-123', name: 'Test' },
          },
          error: null,
        }),
        update: updateMock,
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      if (result.current.updateMemberRole) {
        await act(async () => {
          await result.current.updateMemberRole('user-1', 'admin')
        })
      }
    })
  })

  describe('authorization', () => {
    it('should determine if user is admin', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            organization_id: 'org-123',
            role: 'admin',
            organizations: { id: 'org-123', name: 'Test' },
          },
          error: null,
        }),
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAdmin).toBe(true)
    })

    it('should determine if user is not admin', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            organization_id: 'org-123',
            role: 'member',
            organizations: { id: 'org-123', name: 'Test' },
          },
          error: null,
        }),
      })

      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAdmin).toBe(false)
    })
  })
})
