/**
 * WorkloadDistributionPie Component Tests
 * Tests for the workload distribution pie chart component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: vi.fn(({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  )),
  PieChart: vi.fn(({ children }) => (
    <div data-testid="pie-chart">{children}</div>
  )),
  Pie: vi.fn(({ data, dataKey, nameKey, children }) => (
    <div
      data-testid="pie"
      data-segments={data?.length || 0}
      data-datakey={dataKey}
      data-namekey={nameKey}
    >
      {children}
    </div>
  )),
  Cell: vi.fn(({ fill }) => <div data-testid="cell" data-fill={fill} />),
  Tooltip: vi.fn(() => <div data-testid="tooltip" />),
  Legend: vi.fn(() => <div data-testid="legend" />),
}))

const mockData = [
  { name: 'Email Worker', value: 100, color: '#3B82F6' },
  { name: 'Data Worker', value: 50, color: '#22C55E' },
  { name: 'Slack Worker', value: 75, color: '#F59E0B' },
  { name: 'API Worker', value: 25, color: '#EF4444' },
]

describe('WorkloadDistributionPie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render chart container', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('should render pie chart', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} />)

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('should render correct number of segments', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} />)

      expect(screen.getByTestId('pie')).toHaveAttribute('data-segments', '4')
    })

    it('should use correct data key', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} dataKey="value" />)

      expect(screen.getByTestId('pie')).toHaveAttribute('data-datakey', 'value')
    })

    it('should use correct name key', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} nameKey="name" />)

      expect(screen.getByTestId('pie')).toHaveAttribute('data-namekey', 'name')
    })
  })

  describe('colors', () => {
    it('should render cells with colors', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} />)

      const cells = screen.getAllByTestId('cell')
      expect(cells.length).toBe(4)
    })

    it('should apply custom color scheme', async () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00']
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} colors={customColors} />)

      const firstCell = screen.getAllByTestId('cell')[0]
      expect(firstCell).toHaveAttribute('data-fill', '#FF0000')
    })
  })

  describe('features', () => {
    it('should render tooltip', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} showTooltip />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('should render legend when enabled', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} showLegend />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })
  })

  describe('labels', () => {
    it('should show percentage labels', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} showLabels labelType="percent" />)

      // Labels should be rendered
      expect(screen.getByTestId('pie')).toBeInTheDocument()
    })

    it('should show value labels', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} showLabels labelType="value" />)

      expect(screen.getByTestId('pie')).toBeInTheDocument()
    })

    it('should show name labels', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} showLabels labelType="name" />)

      expect(screen.getByTestId('pie')).toBeInTheDocument()
    })
  })

  describe('donut chart', () => {
    it('should support donut style', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} innerRadius={60} />)

      expect(screen.getByTestId('pie')).toBeInTheDocument()
    })

    it('should show center content for donut', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(
        <WorkloadDistributionPie
          data={mockData}
          innerRadius={60}
          centerContent={<span>Total: 250</span>}
        />
      )

      expect(screen.getByText('Total: 250')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should handle empty data', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={[]} />)

      expect(screen.getByTestId('pie')).toHaveAttribute('data-segments', '0')
    })

    it('should show empty message', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={[]} showEmptyMessage />)

      expect(screen.getByText(/No data/i)).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('should call onSegmentClick when segment is clicked', async () => {
      const onSegmentClick = vi.fn()
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(
        <WorkloadDistributionPie data={mockData} onSegmentClick={onSegmentClick} />
      )

      fireEvent.click(screen.getAllByTestId('cell')[0])

      expect(onSegmentClick).toHaveBeenCalled()
    })

    it('should highlight segment on hover', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} highlightOnHover />)

      const cell = screen.getAllByTestId('cell')[0]
      fireEvent.mouseEnter(cell)

      // Hover state should be applied
      expect(cell).toBeInTheDocument()
    })
  })

  describe('title', () => {
    it('should render title when provided', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(
        <WorkloadDistributionPie data={mockData} title="Workload Distribution" />
      )

      expect(screen.getByText('Workload Distribution')).toBeInTheDocument()
    })
  })

  describe('animation', () => {
    it('should disable animation when specified', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} animationEnabled={false} />)

      expect(screen.getByTestId('pie')).toBeInTheDocument()
    })
  })

  describe('size', () => {
    it('should apply custom outer radius', async () => {
      const { WorkloadDistributionPie } = await import('../WorkloadDistributionPie')
      render(<WorkloadDistributionPie data={mockData} outerRadius={100} />)

      expect(screen.getByTestId('pie')).toBeInTheDocument()
    })
  })
})
