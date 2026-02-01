/**
 * TrendLineChart Component Tests
 * Tests for the trend line chart component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: vi.fn(({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  )),
  LineChart: vi.fn(({ children, data }) => (
    <div data-testid="line-chart" data-points={data?.length || 0}>
      {children}
    </div>
  )),
  Line: vi.fn(({ dataKey, stroke }) => (
    <div data-testid={`line-${dataKey}`} data-stroke={stroke} />
  )),
  XAxis: vi.fn(({ dataKey }) => <div data-testid="x-axis" data-key={dataKey} />),
  YAxis: vi.fn(() => <div data-testid="y-axis" />),
  CartesianGrid: vi.fn(() => <div data-testid="grid" />),
  Tooltip: vi.fn(() => <div data-testid="tooltip" />),
  Legend: vi.fn(() => <div data-testid="legend" />),
}))

const mockData = [
  { date: '2024-01-01', executions: 10, successRate: 0.9 },
  { date: '2024-01-02', executions: 15, successRate: 0.95 },
  { date: '2024-01-03', executions: 12, successRate: 0.92 },
  { date: '2024-01-04', executions: 18, successRate: 0.88 },
  { date: '2024-01-05', executions: 20, successRate: 0.94 },
]

describe('TrendLineChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render chart container', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('should render line chart', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} />)

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })

    it('should pass correct data points', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} />)

      expect(screen.getByTestId('line-chart')).toHaveAttribute(
        'data-points',
        '5'
      )
    })

    it('should render x-axis with date key', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} xAxisKey="date" />)

      expect(screen.getByTestId('x-axis')).toHaveAttribute('data-key', 'date')
    })

    it('should render y-axis', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} />)

      expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    })
  })

  describe('lines', () => {
    it('should render single line', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} lines={['executions']} />)

      expect(screen.getByTestId('line-executions')).toBeInTheDocument()
    })

    it('should render multiple lines', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(
        <TrendLineChart data={mockData} lines={['executions', 'successRate']} />
      )

      expect(screen.getByTestId('line-executions')).toBeInTheDocument()
      expect(screen.getByTestId('line-successRate')).toBeInTheDocument()
    })

    it('should apply custom colors', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(
        <TrendLineChart
          data={mockData}
          lines={['executions']}
          colors={{ executions: '#FF0000' }}
        />
      )

      expect(screen.getByTestId('line-executions')).toHaveAttribute(
        'data-stroke',
        '#FF0000'
      )
    })
  })

  describe('features', () => {
    it('should render grid when enabled', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} showGrid />)

      expect(screen.getByTestId('grid')).toBeInTheDocument()
    })

    it('should render tooltip', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} showTooltip />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('should render legend when enabled', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} showLegend />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should handle empty data', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={[]} />)

      expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '0')
    })

    it('should show message for empty data', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={[]} showEmptyMessage />)

      expect(screen.getByText(/No data/i)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('should show loading state', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={[]} isLoading />)

      expect(screen.getByTestId('chart-loading')).toBeInTheDocument()
    })
  })

  describe('title', () => {
    it('should render title when provided', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} title="Execution Trends" />)

      expect(screen.getByText('Execution Trends')).toBeInTheDocument()
    })
  })

  describe('height', () => {
    it('should apply custom height', async () => {
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} height={400} />)

      const container = screen.getByTestId('responsive-container')
      expect(container.parentElement).toHaveStyle({ height: '400px' })
    })
  })

  describe('interactions', () => {
    it('should call onClick when chart is clicked', async () => {
      const onClick = vi.fn()
      const { TrendLineChart } = await import('../TrendLineChart')
      render(<TrendLineChart data={mockData} onClick={onClick} />)

      fireEvent.click(screen.getByTestId('line-chart'))

      expect(onClick).toHaveBeenCalled()
    })
  })
})
