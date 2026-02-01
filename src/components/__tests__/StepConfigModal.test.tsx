/**
 * StepConfigModal Component Tests
 * Tests for the step configuration modal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: 'user-123' } } },
        })
      ),
    },
  })),
}))

const mockStep = {
  id: 'step-1',
  name: 'Send Email',
  type: 'action',
  nodeType: 'n8n-nodes-base.emailSend',
  config: {
    to: 'test@example.com',
    subject: 'Test Subject',
    body: 'Test body content',
  },
}

const mockNodeTypes = {
  'n8n-nodes-base.emailSend': {
    name: 'Email Send',
    description: 'Send an email',
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { name: 'to', type: 'string', required: true },
      { name: 'subject', type: 'string', required: true },
      { name: 'body', type: 'string', required: true },
      { name: 'attachments', type: 'array', required: false },
    ],
  },
}

describe('StepConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render modal when open', async () => {
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should not render when closed', async () => {
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={false}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should display step name', async () => {
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByText(/Send Email/i)).toBeInTheDocument()
    })

    it('should display node type info', async () => {
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByText(/Email Send/i)).toBeInTheDocument()
    })
  })

  describe('form fields', () => {
    it('should render config fields', async () => {
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByLabelText(/to/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
    })

    it('should populate fields with existing config', async () => {
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement
      expect(toInput.value).toBe('test@example.com')
    })

    it('should mark required fields', async () => {
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      const toInput = screen.getByLabelText(/to/i)
      expect(toInput).toBeRequired()
    })
  })

  describe('interactions', () => {
    it('should call onClose when cancel clicked', async () => {
      const onClose = vi.fn()
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={onClose}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onClose).toHaveBeenCalled()
    })

    it('should call onSave with updated config', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={onSave}
        />
      )

      const subjectInput = screen.getByLabelText(/subject/i)
      await user.clear(subjectInput)
      await user.type(subjectInput, 'New Subject')

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              subject: 'New Subject',
            }),
          })
        )
      })
    })

    it('should close modal on escape key', async () => {
      const onClose = vi.fn()
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={onClose}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should validate required fields', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={onSave}
        />
      )

      const toInput = screen.getByLabelText(/to/i)
      await user.clear(toInput)

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument()
      })
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={vi.fn()}
        />
      )

      const toInput = screen.getByLabelText(/to/i)
      await user.clear(toInput)
      await user.type(toInput, 'invalid-email')

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument()
      })
    })
  })

  describe('step name editing', () => {
    it('should allow editing step name', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={mockStep}
          nodeTypes={mockNodeTypes}
          onSave={onSave}
        />
      )

      const nameInput = screen.getByLabelText(/step name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'New Step Name')

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Step Name',
          })
        )
      })
    })
  })

  describe('credentials', () => {
    it('should show credentials section for nodes requiring auth', async () => {
      const stepWithCredentials = {
        ...mockStep,
        nodeType: 'n8n-nodes-base.gmail',
      }
      const nodeTypesWithCredentials = {
        'n8n-nodes-base.gmail': {
          ...mockNodeTypes['n8n-nodes-base.emailSend'],
          credentials: [{ name: 'gmailOAuth2Api', required: true }],
        },
      }

      const { StepConfigModal } = await import('../StepConfigModal')
      render(
        <StepConfigModal
          isOpen={true}
          onClose={vi.fn()}
          step={stepWithCredentials}
          nodeTypes={nodeTypesWithCredentials}
          onSave={vi.fn()}
        />
      )

      expect(screen.getByText(/credentials/i)).toBeInTheDocument()
    })
  })
})
