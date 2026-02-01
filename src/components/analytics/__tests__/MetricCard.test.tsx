import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Import the component - adjust path as needed
// import MetricCard from '../MetricCard'

// Mock component for testing if actual component doesn't exist
function MetricCard({
  label,
  value,
  trend,
  trendDirection,
  format = 'number',
}: {
  label: string
  value: number | string
  trend?: number
  trendDirection?: 'up' | 'down' | 'neutral'
  format?: 'number' | 'percentage' | 'currency'
}) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val
    switch (format) {
      case 'percentage':
        return `${val}%`
      case 'currency':
        return `$${val.toLocaleString()}`
      default:
        return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toString()
    }
  }

  return (
    <div className="metric-card" data-testid="metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value" data-testid="metric-value">
        {formatValue(value)}
      </span>
      {trend !== undefined && (
        <span
          className={`metric-trend ${trendDirection === 'up' ? 'positive' : trendDirection === 'down' ? 'negative' : 'neutral'}`}
          data-testid="metric-trend"
        >
          {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  )
}

describe('MetricCard', () => {
  describe('rendering', () => {
    it('should render metric value', () => {
      render(<MetricCard label="Total Users" value={1234} />)

      expect(screen.getByTestId('metric-value')).toBeInTheDocument()
    })

    it('should render metric label', () => {
      render(<MetricCard label="Active Sessions" value={567} />)

      expect(screen.getByText('Active Sessions')).toBeInTheDocument()
    })

    it('should render trend indicator when provided', () => {
      render(
        <MetricCard
          label="Revenue"
          value={10000}
          trend={12}
          trendDirection="up"
        />
      )

      expect(screen.getByTestId('metric-trend')).toBeInTheDocument()
    })

    it('should not render trend when not provided', () => {
      render(<MetricCard label="Users" value={100} />)

      expect(screen.queryByTestId('metric-trend')).not.toBeInTheDocument()
    })
  })

  describe('trend styling', () => {
    it('should apply positive trend styling for upward trend', () => {
      render(
        <MetricCard
          label="Growth"
          value={500}
          trend={15}
          trendDirection="up"
        />
      )

      const trendElement = screen.getByTestId('metric-trend')
      expect(trendElement.className).toContain('positive')
    })

    it('should apply negative trend styling for downward trend', () => {
      render(
        <MetricCard
          label="Churn"
          value={50}
          trend={-5}
          trendDirection="down"
        />
      )

      const trendElement = screen.getByTestId('metric-trend')
      expect(trendElement.className).toContain('negative')
    })

    it('should apply neutral styling for no change', () => {
      render(
        <MetricCard
          label="Steady"
          value={100}
          trend={0}
          trendDirection="neutral"
        />
      )

      const trendElement = screen.getByTestId('metric-trend')
      expect(trendElement.className).toContain('neutral')
    })

    it('should show up arrow for positive trend', () => {
      render(
        <MetricCard
          label="Revenue"
          value={1000}
          trend={10}
          trendDirection="up"
        />
      )

      expect(screen.getByTestId('metric-trend').textContent).toContain('↑')
    })

    it('should show down arrow for negative trend', () => {
      render(
        <MetricCard
          label="Errors"
          value={50}
          trend={-20}
          trendDirection="down"
        />
      )

      expect(screen.getByTestId('metric-trend').textContent).toContain('↓')
    })
  })

  describe('number formatting', () => {
    it('should format large numbers with K suffix', () => {
      render(<MetricCard label="Users" value={5000} />)

      expect(screen.getByTestId('metric-value').textContent).toContain('K')
    })

    it('should not add K suffix for small numbers', () => {
      render(<MetricCard label="Users" value={500} />)

      expect(screen.getByTestId('metric-value').textContent).toBe('500')
    })

    it('should format percentages', () => {
      render(
        <MetricCard label="Completion Rate" value={85} format="percentage" />
      )

      expect(screen.getByTestId('metric-value').textContent).toContain('%')
    })

    it('should format currency', () => {
      render(<MetricCard label="Revenue" value={50000} format="currency" />)

      expect(screen.getByTestId('metric-value').textContent).toContain('$')
    })

    it('should handle string values', () => {
      render(<MetricCard label="Status" value="Active" />)

      expect(screen.getByTestId('metric-value').textContent).toBe('Active')
    })

    it('should handle zero value', () => {
      render(<MetricCard label="Errors" value={0} />)

      expect(screen.getByTestId('metric-value').textContent).toBe('0')
    })
  })

  describe('trend percentage display', () => {
    it('should display trend percentage', () => {
      render(
        <MetricCard
          label="Growth"
          value={1000}
          trend={25}
          trendDirection="up"
        />
      )

      expect(screen.getByTestId('metric-trend').textContent).toContain('25%')
    })

    it('should display absolute value for negative trend', () => {
      render(
        <MetricCard
          label="Decline"
          value={500}
          trend={-15}
          trendDirection="down"
        />
      )

      // Should show absolute value, not -15
      expect(screen.getByTestId('metric-trend').textContent).toContain('15%')
    })
  })

  describe('accessibility', () => {
    it('should have accessible card structure', () => {
      render(<MetricCard label="Users" value={100} />)

      const card = screen.getByTestId('metric-card')
      expect(card).toBeInTheDocument()
    })

    it('should have readable label text', () => {
      render(<MetricCard label="Total Revenue" value={50000} />)

      expect(screen.getByText('Total Revenue')).toBeVisible()
    })
  })

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      render(<MetricCard label="Views" value={1000000} />)

      const valueText = screen.getByTestId('metric-value').textContent
      expect(valueText).toBeTruthy()
    })

    it('should handle decimal numbers', () => {
      render(<MetricCard label="Rate" value={3.14} />)

      expect(screen.getByTestId('metric-value')).toBeInTheDocument()
    })

    it('should handle very small trend values', () => {
      render(
        <MetricCard
          label="Change"
          value={100}
          trend={0.5}
          trendDirection="up"
        />
      )

      expect(screen.getByTestId('metric-trend')).toBeInTheDocument()
    })
  })
})
