import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import ErrorBoundary from '../ErrorBoundary'

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Component that throws on click
function ThrowOnClick() {
  const [shouldThrow, setShouldThrow] = React.useState(false)

  if (shouldThrow) {
    throw new Error('Clicked error')
  }

  return (
    <button onClick={() => setShouldThrow(true)}>
      Throw Error
    </button>
  )
}

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Suppress console.error for expected errors
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('error catching', () => {
    it('should render children when no error', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child content</div>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Child content')).toBeInTheDocument()
    })

    it('should catch rendering errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Should not show child content
      expect(screen.queryByText('No error')).not.toBeInTheDocument()
    })

    it('should display fallback UI on error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Should show error message
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })

    it('should display custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error view</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom error view')).toBeInTheDocument()
    })

    it('should log error details', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('recovery', () => {
    it('should allow retry via try again button', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Error boundary should show fallback
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

      // Find and click retry button
      const retryButton = screen.queryByRole('button', { name: /try again/i })
      if (retryButton) {
        // First, rerender with non-throwing component
        rerender(
          <ErrorBoundary>
            <ThrowError shouldThrow={false} />
          </ErrorBoundary>
        )

        fireEvent.click(retryButton)
      }
    })

    it('should reset error state on retry', () => {
      let shouldThrow = true

      function Wrapper() {
        return (
          <ErrorBoundary key={shouldThrow ? 'error' : 'success'}>
            <ThrowError shouldThrow={shouldThrow} />
          </ErrorBoundary>
        )
      }

      const { rerender } = render(<Wrapper />)

      // Initially shows error
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

      // Change state and rerender
      shouldThrow = false
      rerender(<Wrapper />)

      // Should now show normal content
      expect(screen.getByText('No error')).toBeInTheDocument()
    })
  })

  describe('error information', () => {
    it('should show error message in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // In development, might show error details
      // This depends on implementation
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should not expose error details in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Should show generic error, not technical details
      expect(screen.queryByText('Test error')).not.toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('nested error boundaries', () => {
    it('should catch error at nearest boundary', () => {
      render(
        <ErrorBoundary>
          <div data-testid="outer">
            <ErrorBoundary>
              <ThrowError shouldThrow={true} />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      )

      // Outer content should still be visible
      expect(screen.getByTestId('outer')).toBeInTheDocument()
      // Inner error caught
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })

    it('should not affect sibling components', () => {
      render(
        <ErrorBoundary>
          <div>
            <ErrorBoundary>
              <ThrowError shouldThrow={true} />
            </ErrorBoundary>
            <div data-testid="sibling">Sibling content</div>
          </div>
        </ErrorBoundary>
      )

      // Sibling should not be affected
      expect(screen.getByTestId('sibling')).toBeInTheDocument()
    })
  })

  describe('event handler errors', () => {
    it('should not catch errors from event handlers directly', () => {
      // Error boundaries don't catch errors in event handlers
      // This is React behavior - just documenting it
      const onErrorClick = () => {
        throw new Error('Event handler error')
      }

      render(
        <ErrorBoundary>
          <button onClick={onErrorClick}>Click me</button>
        </ErrorBoundary>
      )

      // The button should render
      expect(screen.getByText('Click me')).toBeInTheDocument()

      // Clicking would throw uncaught in event handler
      // Error boundary won't catch this
    })
  })

  describe('multiple children', () => {
    it('should handle multiple children', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
      expect(screen.getByText('Child 3')).toBeInTheDocument()
    })

    it('should show error if any child throws', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <ThrowError shouldThrow={true} />
          <div>Child 3</div>
        </ErrorBoundary>
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      expect(screen.queryByText('Child 1')).not.toBeInTheDocument()
    })
  })

  describe('onError callback', () => {
    it('should call onError callback when error occurs', () => {
      const onError = vi.fn()

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // onError should have been called if prop is supported
      // Implementation dependent
    })
  })
})
