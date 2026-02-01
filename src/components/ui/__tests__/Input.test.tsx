/*
 * Input Component Tests
 * Uncomment when tests are enabled
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

describe('Input', () => {
  it('should render with label', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('should render without label', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  describe('error state', () => {
    it('should show error state', () => {
      render(<Input error="This field is required" />)
      expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    it('should apply error styles', () => {
      render(<Input error="Error" data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('border-red-500')
    })

    it('should have aria-invalid when error is present', () => {
      render(<Input error="Error" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveAttribute('aria-invalid', 'true')
    })

    it('should have aria-describedby linking to error message', () => {
      render(<Input error="Error message" id="test-input" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'test-input-error')
    })
  })

  describe('ref forwarding', () => {
    it('should forward ref correctly', () => {
      const ref = vi.fn()
      render(<Input ref={ref} />)
      expect(ref).toHaveBeenCalled()
    })

    it('should allow accessing DOM element via ref', () => {
      let inputRef: HTMLInputElement | null = null
      render(
        <Input ref={(el) => { inputRef = el }} />
      )
      expect(inputRef).toBeInstanceOf(HTMLInputElement)
    })
  })

  describe('onChange events', () => {
    it('should handle onChange events', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'hello')

      expect(handleChange).toHaveBeenCalledTimes(5)
    })

    it('should update value on change', async () => {
      const user = userEvent.setup()
      render(<Input />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test value')

      expect(input).toHaveValue('test value')
    })
  })

  describe('disabled state', () => {
    it('should support disabled state', () => {
      render(<Input disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('should apply disabled styles', () => {
      render(<Input disabled data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('opacity-50', 'cursor-not-allowed')
    })

    it('should not allow typing when disabled', async () => {
      const user = userEvent.setup()
      render(<Input disabled />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')

      expect(input).toHaveValue('')
    })
  })

  describe('helper text', () => {
    it('should render helper text', () => {
      render(<Input helperText="Enter your email address" />)
      expect(screen.getByText('Enter your email address')).toBeInTheDocument()
    })

    it('should show error instead of helper text when both present', () => {
      render(<Input helperText="Helper" error="Error" />)
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })
  })

  describe('input types', () => {
    it('should support text type (default)', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text')
    })

    it('should support email type', () => {
      render(<Input type="email" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
    })

    it('should support password type', () => {
      render(<Input type="password" />)
      // Password inputs don't have textbox role
      expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password')
    })

    it('should support number type', () => {
      render(<Input type="number" />)
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
    })
  })

  describe('className merging', () => {
    it('should merge custom className', () => {
      render(<Input className="custom-class" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveClass('custom-class')
    })
  })

  describe('sizes', () => {
    it('should apply sm size', () => {
      render(<Input size="sm" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveClass('text-sm', 'px-2', 'py-1')
    })

    it('should apply md size (default)', () => {
      render(<Input size="md" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveClass('text-base', 'px-3', 'py-2')
    })

    it('should apply lg size', () => {
      render(<Input size="lg" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveClass('text-lg', 'px-4', 'py-3')
    })
  })

  describe('icons', () => {
    it('should render left icon', () => {
      render(<Input leftIcon={<span data-testid="left-icon">🔍</span>} />)
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('should render right icon', () => {
      render(<Input rightIcon={<span data-testid="right-icon">✓</span>} />)
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('should add padding for left icon', () => {
      render(
        <Input
          leftIcon={<span>🔍</span>}
          data-testid="input"
        />
      )
      expect(screen.getByTestId('input')).toHaveClass('pl-10')
    })

    it('should add padding for right icon', () => {
      render(
        <Input
          rightIcon={<span>✓</span>}
          data-testid="input"
        />
      )
      expect(screen.getByTestId('input')).toHaveClass('pr-10')
    })
  })

  describe('required', () => {
    it('should mark as required', () => {
      render(<Input required />)
      expect(screen.getByRole('textbox')).toBeRequired()
    })

    it('should show required indicator in label', () => {
      render(<Input label="Email" required />)
      expect(screen.getByText('*')).toBeInTheDocument()
    })
  })
})
