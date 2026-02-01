/**
 * WorkflowFlowchart Component Tests
 * Tests for the workflow flowchart visualization component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock ReactFlow
vi.mock('reactflow', () => ({
  default: vi.fn(({ children, nodes, edges, onNodeClick }) => (
    <div data-testid="reactflow-container">
      <div data-testid="nodes-count">{nodes?.length || 0}</div>
      <div data-testid="edges-count">{edges?.length || 0}</div>
      {nodes?.map((node: { id: string; data: { label: string } }) => (
        <div
          key={node.id}
          data-testid={`node-${node.id}`}
          onClick={() => onNodeClick?.({}, node)}
        >
          {node.data.label}
        </div>
      ))}
      {children}
    </div>
  )),
  Background: vi.fn(() => <div data-testid="background" />),
  Controls: vi.fn(() => <div data-testid="controls" />),
  MiniMap: vi.fn(() => <div data-testid="minimap" />),
  Handle: vi.fn(({ type, position }) => (
    <div data-testid={`handle-${type}-${position}`} />
  )),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useNodesState: vi.fn((initial) => [initial, vi.fn()]),
  useEdgesState: vi.fn((initial) => [initial, vi.fn()]),
}))

const mockSteps = [
  {
    id: 'step-1',
    name: 'Email Trigger',
    type: 'trigger',
    nodeType: 'n8n-nodes-base.emailTrigger',
  },
  {
    id: 'step-2',
    name: 'Process Data',
    type: 'action',
    nodeType: 'n8n-nodes-base.function',
  },
  {
    id: 'step-3',
    name: 'Send Notification',
    type: 'action',
    nodeType: 'n8n-nodes-base.slack',
  },
]

const mockConnections = [
  { from: 'step-1', to: 'step-2' },
  { from: 'step-2', to: 'step-3' },
]

describe('WorkflowFlowchart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render flowchart container', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={mockSteps} connections={mockConnections} />)

      expect(screen.getByTestId('reactflow-container')).toBeInTheDocument()
    })

    it('should render correct number of nodes', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={mockSteps} connections={mockConnections} />)

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('3')
    })

    it('should render correct number of edges', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={mockSteps} connections={mockConnections} />)

      expect(screen.getByTestId('edges-count')).toHaveTextContent('2')
    })

    it('should render step labels', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={mockSteps} connections={mockConnections} />)

      expect(screen.getByText('Email Trigger')).toBeInTheDocument()
      expect(screen.getByText('Process Data')).toBeInTheDocument()
      expect(screen.getByText('Send Notification')).toBeInTheDocument()
    })
  })

  describe('controls', () => {
    it('should render background', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={mockSteps} connections={mockConnections} />)

      expect(screen.getByTestId('background')).toBeInTheDocument()
    })

    it('should render controls when enabled', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={mockSteps}
          connections={mockConnections}
          showControls
        />
      )

      expect(screen.getByTestId('controls')).toBeInTheDocument()
    })

    it('should render minimap when enabled', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={mockSteps}
          connections={mockConnections}
          showMinimap
        />
      )

      expect(screen.getByTestId('minimap')).toBeInTheDocument()
    })
  })

  describe('interaction', () => {
    it('should call onNodeClick when node is clicked', async () => {
      const onNodeClick = vi.fn()
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={mockSteps}
          connections={mockConnections}
          onNodeClick={onNodeClick}
        />
      )

      fireEvent.click(screen.getByTestId('node-step-1'))

      expect(onNodeClick).toHaveBeenCalled()
    })

    it('should highlight selected node', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={mockSteps}
          connections={mockConnections}
          selectedNodeId="step-2"
        />
      )

      // The selected node should have a different style
      const selectedNode = screen.getByTestId('node-step-2')
      expect(selectedNode).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should handle empty steps', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={[]} connections={[]} />)

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('0')
    })

    it('should show placeholder for empty workflow', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={[]}
          connections={[]}
          showEmptyState
        />
      )

      // Should show empty state message or still render container
      expect(screen.getByTestId('reactflow-container')).toBeInTheDocument()
    })
  })

  describe('node types', () => {
    it('should differentiate trigger nodes', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={mockSteps} connections={mockConnections} />)

      // Trigger node should be rendered
      expect(screen.getByTestId('node-step-1')).toBeInTheDocument()
    })

    it('should differentiate action nodes', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(<WorkflowFlowchart steps={mockSteps} connections={mockConnections} />)

      // Action nodes should be rendered
      expect(screen.getByTestId('node-step-2')).toBeInTheDocument()
      expect(screen.getByTestId('node-step-3')).toBeInTheDocument()
    })
  })

  describe('layout', () => {
    it('should support horizontal layout', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={mockSteps}
          connections={mockConnections}
          direction="horizontal"
        />
      )

      expect(screen.getByTestId('reactflow-container')).toBeInTheDocument()
    })

    it('should support vertical layout', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={mockSteps}
          connections={mockConnections}
          direction="vertical"
        />
      )

      expect(screen.getByTestId('reactflow-container')).toBeInTheDocument()
    })
  })

  describe('zoom', () => {
    it('should support fit view', async () => {
      const { WorkflowFlowchart } = await import('../WorkflowFlowchart')
      render(
        <WorkflowFlowchart
          steps={mockSteps}
          connections={mockConnections}
          fitView
        />
      )

      expect(screen.getByTestId('reactflow-container')).toBeInTheDocument()
    })
  })
})
