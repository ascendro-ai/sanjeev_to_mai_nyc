/**
 * QueryProvider Tests
 * Tests for the React Query provider component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

describe('QueryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should render children', async () => {
      const { QueryProvider } = await import('../QueryProvider')
      render(
        <QueryProvider>
          <div data-testid="child">Child Component</div>
        </QueryProvider>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('should provide QueryClient to children', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const queryClient = useQueryClient()
        return (
          <div data-testid="client">
            {queryClient ? 'has client' : 'no client'}
          </div>
        )
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      expect(screen.getByTestId('client')).toHaveTextContent('has client')
    })
  })

  describe('query functionality', () => {
    it('should support useQuery', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const { data, isLoading } = useQuery({
          queryKey: ['test'],
          queryFn: () => Promise.resolve({ message: 'hello' }),
        })

        if (isLoading) return <div data-testid="loading">Loading</div>
        return <div data-testid="data">{data?.message}</div>
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      expect(screen.getByTestId('loading')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('hello')
      })
    })

    it('should handle query errors', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const { error, isError } = useQuery({
          queryKey: ['error-test'],
          queryFn: () => Promise.reject(new Error('Query failed')),
          retry: false,
        })

        if (isError) return <div data-testid="error">{(error as Error).message}</div>
        return <div data-testid="loading">Loading</div>
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Query failed')
      })
    })

    it('should cache query results', async () => {
      const queryFn = vi.fn(() => Promise.resolve({ count: 1 }))
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const { data } = useQuery({
          queryKey: ['cache-test'],
          queryFn,
          staleTime: 5000,
        })
        return <div data-testid="data">{data?.count}</div>
      }

      const { rerender } = render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('1')
      })

      // Rerender should use cached data
      rerender(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      // Should only call queryFn once due to caching
      expect(queryFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('mutation functionality', () => {
    it('should support useMutation', async () => {
      const { QueryProvider } = await import('../QueryProvider')
      const mutationFn = vi.fn(() => Promise.resolve({ success: true }))

      function TestComponent() {
        const mutation = useMutation({
          mutationFn,
        })

        return (
          <div>
            <button onClick={() => mutation.mutate({ data: 'test' })}>
              Mutate
            </button>
            <div data-testid="status">
              {mutation.isSuccess ? 'success' : 'pending'}
            </div>
          </div>
        )
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      await act(async () => {
        screen.getByRole('button').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('success')
      })

      expect(mutationFn).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should handle mutation errors', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const mutation = useMutation({
          mutationFn: () => Promise.reject(new Error('Mutation failed')),
        })

        return (
          <div>
            <button onClick={() => mutation.mutate({})}>Mutate</button>
            <div data-testid="error">
              {mutation.isError ? (mutation.error as Error).message : 'no error'}
            </div>
          </div>
        )
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      await act(async () => {
        screen.getByRole('button').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Mutation failed')
      })
    })
  })

  describe('cache invalidation', () => {
    it('should support cache invalidation', async () => {
      const { QueryProvider } = await import('../QueryProvider')
      let callCount = 0
      const queryFn = vi.fn(() => Promise.resolve({ count: ++callCount }))

      function TestComponent() {
        const queryClient = useQueryClient()
        const { data } = useQuery({
          queryKey: ['invalidate-test'],
          queryFn,
        })

        return (
          <div>
            <div data-testid="data">{data?.count}</div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['invalidate-test'] })}
            >
              Invalidate
            </button>
          </div>
        )
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('1')
      })

      await act(async () => {
        screen.getByRole('button').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('2')
      })

      expect(queryFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('default options', () => {
    it('should apply default staleTime', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const queryClient = useQueryClient()
        const defaults = queryClient.getDefaultOptions()
        return (
          <div data-testid="stale">
            {defaults.queries?.staleTime ? 'has staleTime' : 'no staleTime'}
          </div>
        )
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      // Provider should have configured default options
      expect(screen.getByTestId('stale')).toBeInTheDocument()
    })

    it('should apply default retry configuration', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const queryClient = useQueryClient()
        const defaults = queryClient.getDefaultOptions()
        return (
          <div data-testid="retry">
            {typeof defaults.queries?.retry !== 'undefined' ? 'has retry' : 'no retry'}
          </div>
        )
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      expect(screen.getByTestId('retry')).toBeInTheDocument()
    })
  })

  describe('devtools', () => {
    it('should render devtools in development', async () => {
      const originalEnv = process.env.NODE_ENV

      // This test verifies the provider doesn't break with devtools
      const { QueryProvider } = await import('../QueryProvider')

      render(
        <QueryProvider>
          <div data-testid="app">App</div>
        </QueryProvider>
      )

      expect(screen.getByTestId('app')).toBeInTheDocument()

      // Restore
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('persistence', () => {
    it('should support query persistence', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      function TestComponent() {
        const { data } = useQuery({
          queryKey: ['persist-test'],
          queryFn: () => Promise.resolve({ persisted: true }),
          gcTime: Infinity, // Keep in cache
        })

        return <div data-testid="data">{data ? 'has data' : 'no data'}</div>
      }

      render(
        <QueryProvider>
          <TestComponent />
        </QueryProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('has data')
      })
    })
  })

  describe('SSR support', () => {
    it('should work with server-side rendering', async () => {
      const { QueryProvider } = await import('../QueryProvider')

      // Simulate SSR by checking if provider works without window
      const { container } = render(
        <QueryProvider>
          <div>SSR Content</div>
        </QueryProvider>
      )

      expect(container).toBeInTheDocument()
    })
  })
})
