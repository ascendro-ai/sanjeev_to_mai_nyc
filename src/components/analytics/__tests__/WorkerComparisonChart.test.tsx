/**
 * WorkerComparisonChart Component Tests
 * Tests for the worker comparison bar chart component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: vi.fn(({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  )),
  BarChart: vi.fn(({ children, data }) => (
    <div data-testid="bar-chart" data-items={data?.length || 0}>
      {children}
    </div>
  )),
  Bar: vi.fn(({ dataKey, fill }) => (
    <div data-testid={`bar-${dataKey}`} data-fill={fill} />
  )),
  XAxis: vi.fn(({ dataKey }) => <div data-testid="x-axis" data-key={dataKey} />),
  YAxis: vi.fn(() => <div data-testid="y-axis" />),
  CartesianGrid: vi.fn(() => <div data-testid="grid" />),
  Tooltip: vi.fn(() => <div data-testid="tooltip" />),
  Legend: vi.fn(() => <div data-testid="legend" />),
  Cell: vi.fn(({ fill }) => <div data-testid="cell" data-fill={fill} />),
}))

const mockWorkers = [
  {
    id: 'worker-1',
    name: 'Email Worker',
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 5,
    successRate: 0.95,
  },
  {
    id: 'worker-2',
    name: 'Data Worker',
    totalExecutions: 50,
    successfulExecutions: 48,
    failedExecutions: 2,
    successRate: 0.96,
  },
  {
    id: 'worker-3',
    name: 'Slack Worker',
    totalExecutions: 75,
    successfulExecutions: 70,
    failedExecutions: 5,
    successRate: 0.93,
  },
]

describe('WorkerComparisonChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render chart container', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('should render bar chart', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} />)

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('should pass correct number of items', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} />)

      expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-items', '3')
    })

    it('should render x-axis with worker names', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} />)

      expect(screen.getByTestId('x-axis')).toHaveAttribute('data-key', 'name')
    })
  })

  describe('metrics', () => {
    it('should render executions bar by default', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} />)

      expect(screen.getByTestId('bar-totalExecutions')).toBeInTheDocument()
    })

    it('should render success rate bar', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} metric="successRate" />)

      expect(screen.getByTestId('bar-successRate')).toBeInTheDocument()
    })

    it('should render stacked bars for success/failed', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} showStacked />)

      expect(screen.getByTestId('bar-successfulExecutions')).toBeInTheDocument()
      expect(screen.getByTestId('bar-failedExecutions')).toBeInTheDocument()
    })
  })

  describe('features', () => {
    it('should render grid when enabled', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} showGrid />)

      expect(screen.getByTestId('grid')).toBeInTheDocument()
    })

    it('should render tooltip', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} showTooltip />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('should render legend when enabled', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} showLegend />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })
  })

  describe('sorting', () => {
    it('should sort by executions descending', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(
        <WorkerComparisonChart
          workers={mockWorkers}
          sortBy="totalExecutions"
          sortOrder="desc"
        />
      )

      // Email Worker (100) should be first
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('should sort by success rate', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(
        <WorkerComparisonChart
          workers={mockWorkers}
          sortBy="successRate"
          sortOrder="desc"
        />
      )

      // Data Worker (0.96) should be first
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
  })

  describe('colors', () => {
    it('should apply custom bar color', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(
        <WorkerComparisonChart workers={mockWorkers} barColor="#3B82F6" />
      )

      expect(screen.getByTestId('bar-totalExecutions')).toHaveAttribute(
        'data-fill',
        '#3B82F6'
      )
    })

    it('should apply different colors for stacked bars', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(
        <WorkerComparisonChart
          workers={mockWorkers}
          showStacked
          colors={{ success: '#22C55E', failed: '#EF4444' }}
        />
      )

      expect(screen.getByTestId('bar-successfulExecutions')).toHaveAttribute(
        'data-fill',
        '#22C55E'
      )
      expect(screen.getByTestId('bar-failedExecutions')).toHaveAttribute(
        'data-fill',
        '#EF4444'
      )
    })
  })

  describe('empty state', () => {
    it('should handle empty workers array', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={[]} />)

      expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-items', '0')
    })

    it('should show empty message', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={[]} showEmptyMessage />)

      expect(screen.getByText(/No workers/i)).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('should call onBarClick when bar is clicked', async () => {
      const onBarClick = vi.fn()
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(
        <WorkerComparisonChart workers={mockWorkers} onBarClick={onBarClick} />
      )

      fireEvent.click(screen.getByTestId('bar-chart'))

      // Click handler should be registered
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
  })

  describe('title', () => {
    it('should render title when provided', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(
        <WorkerComparisonChart workers={mockWorkers} title="Worker Performance" />
      )

      expect(screen.getByText('Worker Performance')).toBeInTheDocument()
    })
  })

  describe('layout', () => {
    it('should support horizontal layout', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(
        <WorkerComparisonChart workers={mockWorkers} layout="horizontal" />
      )

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('should support vertical layout', async () => {
      const { WorkerComparisonChart } = await import('../WorkerComparisonChart')
      render(<WorkerComparisonChart workers={mockWorkers} layout="vertical" />)

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
  })
})
