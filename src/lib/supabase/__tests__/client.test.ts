/**
 * Supabase Client Tests
 * Tests for the Supabase client library
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { user: { id: 'user-123' } } }, error: null })
      ),
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'user-123' } }, error: null })
      ),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'user-123' } }, error: null })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: '1' }, error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}))

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
  })

  describe('initialization', () => {
    it('should create client with environment variables', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      expect(client).toBeDefined()
    })

    it('should throw error without URL', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')

      // Need to clear module cache
      vi.resetModules()

      await expect(async () => {
        const { createClient } = await import('../client')
        createClient()
      }).rejects.toThrow(/URL/i)
    })

    it('should throw error without anon key', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

      vi.resetModules()

      await expect(async () => {
        const { createClient } = await import('../client')
        createClient()
      }).rejects.toThrow(/key/i)
    })
  })

  describe('authentication', () => {
    it('should get current session', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { data, error } = await client.auth.getSession()

      expect(error).toBeNull()
      expect(data.session).toBeDefined()
    })

    it('should get current user', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { data, error } = await client.auth.getUser()

      expect(error).toBeNull()
      expect(data.user).toBeDefined()
    })

    it('should sign in with password', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { data, error } = await client.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(error).toBeNull()
      expect(data.user).toBeDefined()
    })

    it('should sign out', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { error } = await client.auth.signOut()

      expect(error).toBeNull()
    })

    it('should subscribe to auth state changes', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const callback = vi.fn()
      const { data } = client.auth.onAuthStateChange(callback)

      expect(data.subscription).toBeDefined()
      expect(typeof data.subscription.unsubscribe).toBe('function')
    })
  })

  describe('database operations', () => {
    it('should select data from table', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { data, error } = await client
        .from('workflows')
        .select('*')
        .eq('organization_id', 'org-123')
        .order('created_at', { ascending: false })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should select single record', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { data, error } = await client
        .from('workflows')
        .select('*')
        .eq('id', 'workflow-123')
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should insert data', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { data, error } = await client
        .from('workflows')
        .insert({ name: 'New Workflow', organization_id: 'org-123' })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toHaveProperty('id')
    })

    it('should update data', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { error } = await client
        .from('workflows')
        .update({ name: 'Updated Workflow' })
        .eq('id', 'workflow-123')

      expect(error).toBeNull()
    })

    it('should delete data', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const { error } = await client.from('workflows').delete().eq('id', 'workflow-123')

      expect(error).toBeNull()
    })
  })

  describe('realtime', () => {
    it('should create a channel', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const channel = client.channel('workflow-updates')

      expect(channel).toBeDefined()
      expect(typeof channel.on).toBe('function')
      expect(typeof channel.subscribe).toBe('function')
    })

    it('should subscribe to changes', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const callback = vi.fn()
      const channel = client
        .channel('workflow-updates')
        .on('postgres_changes', { event: '*', schema: 'public' }, callback)
        .subscribe()

      expect(channel).toBeDefined()
    })

    it('should remove a channel', async () => {
      const { createClient } = await import('../client')
      const client = createClient()

      const channel = client.channel('test-channel')
      await client.removeChannel(channel)

      expect(client.removeChannel).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle database errors', async () => {
      const { createClient: originalCreateClient } = await import('@supabase/supabase-js')
      vi.mocked(originalCreateClient).mockReturnValueOnce({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116', message: 'Not found' },
                }),
            }),
          }),
        }),
      } as never)

      const { createClient } = await import('../client')
      const client = createClient()

      const { data, error } = await client
        .from('workflows')
        .select('*')
        .eq('id', 'non-existent')
        .single()

      expect(data).toBeNull()
      expect(error).toBeDefined()
    })

    it('should handle auth errors', async () => {
      const { createClient: originalCreateClient } = await import('@supabase/supabase-js')
      vi.mocked(originalCreateClient).mockReturnValueOnce({
        auth: {
          signInWithPassword: () =>
            Promise.resolve({
              data: { user: null, session: null },
              error: { message: 'Invalid credentials' },
            }),
        },
      } as never)

      const { createClient } = await import('../client')
      const client = createClient()

      const { error } = await client.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrong-password',
      })

      expect(error).toBeDefined()
      expect(error.message).toContain('Invalid credentials')
    })
  })

  describe('server client', () => {
    it('should create server client with service role key', async () => {
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

      const { createServerClient } = await import('../server')
      const client = await createServerClient()

      expect(client).toBeDefined()
    })
  })
})
