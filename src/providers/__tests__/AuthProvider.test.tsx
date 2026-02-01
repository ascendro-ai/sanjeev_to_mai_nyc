/**
 * AuthProvider Tests
 * Tests for the authentication provider component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ReactNode } from 'react'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: 'user-123', email: 'test@example.com' } } },
          error: null,
        })
      ),
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        })
      ),
      onAuthStateChange: vi.fn((callback) => {
        // Simulate auth state change
        callback('SIGNED_IN', {
          user: { id: 'user-123', email: 'test@example.com' },
        })
        return {
          data: {
            subscription: { unsubscribe: vi.fn() },
          },
        }
      }),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'user-123' }, session: {} },
          error: null,
        })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      signUp: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'new-user' }, session: null },
          error: null,
        })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'user-123', organization_id: 'org-123', role: 'admin' },
              error: null,
            })
          ),
        })),
      })),
    })),
  })),
}))

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should render children', async () => {
      const { AuthProvider } = await import('../../AuthProvider')
      render(
        <AuthProvider>
          <div data-testid="child">Child Component</div>
        </AuthProvider>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('should check initial session', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const { AuthProvider } = await import('../../AuthProvider')

      render(
        <AuthProvider>
          <div>Test</div>
        </AuthProvider>
      )

      await waitFor(() => {
        expect(createClient().auth.getSession).toHaveBeenCalled()
      })
    })

    it('should subscribe to auth state changes', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const { AuthProvider } = await import('../../AuthProvider')

      render(
        <AuthProvider>
          <div>Test</div>
        </AuthProvider>
      )

      await waitFor(() => {
        expect(createClient().auth.onAuthStateChange).toHaveBeenCalled()
      })
    })
  })

  describe('useAuth hook', () => {
    it('should provide user data', async () => {
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { user } = useAuth()
        return <div data-testid="user">{user?.email || 'no user'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })
    })

    it('should provide loading state', async () => {
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { isLoading } = useAuth()
        return <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading')

      // Eventually ready
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      })
    })

    it('should provide isAuthenticated', async () => {
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { isAuthenticated } = useAuth()
        return <div data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('auth')).toHaveTextContent('yes')
      })
    })
  })

  describe('sign in', () => {
    it('should sign in with password', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { signIn } = useAuth()

        return (
          <button
            onClick={() => signIn({ email: 'test@example.com', password: 'password' })}
          >
            Sign In
          </button>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        screen.getByRole('button').click()
      })

      await waitFor(() => {
        expect(createClient().auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
        })
      })
    })

    it('should handle sign in errors', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      vi.mocked(createClient().auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      } as never)

      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      let signInError: Error | null = null

      function TestComponent() {
        const { signIn, error } = useAuth()
        signInError = error

        return (
          <button
            onClick={() => signIn({ email: 'test@example.com', password: 'wrong' })}
          >
            Sign In
          </button>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        screen.getByRole('button').click()
      })

      await waitFor(() => {
        expect(signInError).toBeDefined()
      })
    })
  })

  describe('sign out', () => {
    it('should sign out user', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { signOut } = useAuth()
        return <button onClick={signOut}>Sign Out</button>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        screen.getByRole('button').click()
      })

      await waitFor(() => {
        expect(createClient().auth.signOut).toHaveBeenCalled()
      })
    })

    it('should clear user after sign out', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      vi.mocked(createClient().auth.onAuthStateChange).mockImplementation((callback) => {
        callback('SIGNED_OUT', null)
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { user, signOut } = useAuth()
        return (
          <div>
            <div data-testid="user">{user ? 'logged in' : 'logged out'}</div>
            <button onClick={signOut}>Sign Out</button>
          </div>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('logged out')
      })
    })
  })

  describe('sign up', () => {
    it('should sign up new user', async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { signUp } = useAuth()
        return (
          <button
            onClick={() =>
              signUp({ email: 'new@example.com', password: 'password123' })
            }
          >
            Sign Up
          </button>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        screen.getByRole('button').click()
      })

      await waitFor(() => {
        expect(createClient().auth.signUp).toHaveBeenCalledWith({
          email: 'new@example.com',
          password: 'password123',
        })
      })
    })
  })

  describe('organization context', () => {
    it('should fetch user organization', async () => {
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { organizationId } = useAuth()
        return <div data-testid="org">{organizationId || 'none'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('org')).toHaveTextContent('org-123')
      })
    })

    it('should fetch user role', async () => {
      const { AuthProvider, useAuth } = await import('../../AuthProvider')

      function TestComponent() {
        const { role } = useAuth()
        return <div data-testid="role">{role || 'none'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('role')).toHaveTextContent('admin')
      })
    })
  })

  describe('cleanup', () => {
    it('should unsubscribe on unmount', async () => {
      const unsubscribe = vi.fn()
      const { createClient } = await import('@/lib/supabase/client')
      vi.mocked(createClient().auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe } },
      } as never)

      const { AuthProvider } = await import('../../AuthProvider')

      const { unmount } = render(
        <AuthProvider>
          <div>Test</div>
        </AuthProvider>
      )

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })
})
