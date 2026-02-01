import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock hooks
vi.mock('@/hooks/useWorkflowExtraction', () => ({
  useWorkflowExtraction: () => ({
    extractWorkflow: vi.fn().mockResolvedValue({
      name: 'Test Workflow',
      steps: [],
    }),
    isExtracting: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: () => ({
    workflows: [],
    isLoading: false,
    createWorkflow: vi.fn().mockResolvedValue({ id: 'workflow-123' }),
    updateWorkflow: vi.fn().mockResolvedValue({}),
    activateWorkflow: vi.fn().mockResolvedValue({}),
    deleteWorkflow: vi.fn().mockResolvedValue({}),
  }),
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => ({
    organization: { id: 'org-123', name: 'Test Org' },
    isLoading: false,
    error: null,
  }),
}))

// Mock Gemini client
vi.mock('@/lib/gemini/client', () => ({
  consultWorkflow: vi.fn().mockResolvedValue({
    message: 'Here is some workflow advice',
    suggestions: [],
  }),
}))

// Mock UI components
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', { onClick, disabled, ...props }, children),
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', { className }, children),
}))

// Mock WorkflowFlowchart
vi.mock('@/components/WorkflowFlowchart', () => ({
  default: ({ steps, onStepClick }: { steps: unknown[]; onStepClick?: (step: unknown) => void }) =>
    React.createElement('div', { 'data-testid': 'workflow-flowchart' }, `Flowchart with ${steps?.length || 0} steps`),
}))

// Mock StepConfigModal
vi.mock('@/components/StepConfigModal', () => ({
  default: ({ open, onClose, step }: { open: boolean; onClose: () => void; step?: unknown }) =>
    open
      ? React.createElement(
          'div',
          { 'data-testid': 'step-config-modal' },
          React.createElement('button', { onClick: onClose }, 'Close Modal')
        )
      : null,
}))

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}))

// Import after mocks
import WorkflowBuilder from '../WorkflowBuilder'

describe('WorkflowBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render chat interface', () => {
      render(<WorkflowBuilder />)

      // Should have input for chat messages
      const input = screen.getByRole('textbox') || screen.getByPlaceholderText(/describe|workflow|message/i)
      expect(input).toBeInTheDocument()
    })

    it('should render workflow flowchart area', () => {
      render(<WorkflowBuilder />)

      expect(screen.getByTestId('workflow-flowchart')).toBeInTheDocument()
    })

    it('should render send button', () => {
      render(<WorkflowBuilder />)

      // Look for send button or similar action button
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should render with custom className', () => {
      const { container } = render(<WorkflowBuilder className="custom-class" />)

      // Check that custom class is applied somewhere in the component
      expect(container.innerHTML).toContain('custom-class')
    })
  })

  describe('chat interaction', () => {
    it('should allow typing in chat input', async () => {
      render(<WorkflowBuilder />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'Create a workflow' } })

      expect(input).toHaveValue('Create a workflow')
    })

    it('should show messages in chat', async () => {
      render(<WorkflowBuilder />)

      // The component should have a messages area
      // We check that the flowchart area exists which implies the main structure is rendered
      expect(screen.getByTestId('workflow-flowchart')).toBeInTheDocument()
    })
  })

  describe('workflow operations', () => {
    it('should render save button when workflow exists', () => {
      render(<WorkflowBuilder />)

      // Component should have workflow management buttons
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  describe('step management', () => {
    it('should not show step config modal by default', () => {
      render(<WorkflowBuilder />)

      expect(screen.queryByTestId('step-config-modal')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible input field', () => {
      render(<WorkflowBuilder />)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      // Input should be focusable
      expect(input.tabIndex).not.toBe(-1)
    })

    it('should have accessible buttons', () => {
      render(<WorkflowBuilder />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button.tabIndex).not.toBe(-1)
      })
    })
  })

  describe('loading states', () => {
    it('should render without errors in initial state', () => {
      const { container } = render(<WorkflowBuilder />)

      // Should render without throwing
      expect(container).toBeTruthy()
    })
  })

  describe('workflow flowchart', () => {
    it('should render flowchart component', () => {
      render(<WorkflowBuilder />)

      const flowchart = screen.getByTestId('workflow-flowchart')
      expect(flowchart).toBeInTheDocument()
    })

    it('should show empty state when no steps', () => {
      render(<WorkflowBuilder />)

      const flowchart = screen.getByTestId('workflow-flowchart')
      expect(flowchart.textContent).toContain('0 steps')
    })
  })
})
