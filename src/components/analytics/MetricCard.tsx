'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KPIMetric } from '@/types/analytics'

interface MetricCardProps {
  metric: KPIMetric
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function MetricCard({
  metric,
  className,
  size = 'md',
}: MetricCardProps) {
  const formatValue = (value: number, format?: KPIMetric['format']) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`
      case 'duration':
        if (value >= 60000) {
          return `${(value / 60000).toFixed(1)}m`
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}s`
        }
        return `${value}ms`
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value)
      default:
        return value.toLocaleString()
    }
  }

  const getTrendIcon = () => {
    if (!metric.trend) return null

    switch (metric.trend.direction) {
      case 'up':
        return <ArrowUp className="h-4 w-4" />
      case 'down':
        return <ArrowDown className="h-4 w-4" />
      default:
        return <Minus className="h-4 w-4" />
    }
  }

  const getTrendColor = () => {
    if (!metric.trend) return 'text-gray-500'

    // For some metrics, down is good (e.g., error rate, execution time)
    const isPositive = metric.trend.direction === 'up'
    const isNeutral = metric.trend.direction === 'stable'

    if (isNeutral) return 'text-gray-500'
    if (metric.status === 'good') return 'text-green-600'
    if (metric.status === 'critical') return 'text-red-600'
    if (metric.status === 'warning') return 'text-yellow-600'

    return isPositive ? 'text-green-600' : 'text-red-600'
  }

  const getStatusColor = () => {
    switch (metric.status) {
      case 'good':
        return 'border-l-green-500'
      case 'warning':
        return 'border-l-yellow-500'
      case 'critical':
        return 'border-l-red-500'
      default:
        return 'border-l-gray-200'
    }
  }

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 border-l-4 shadow-sm',
        getStatusColor(),
        sizeClasses[size],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{metric.label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={cn('font-bold text-gray-900', valueSizeClasses[size])}
            >
              {formatValue(metric.value, metric.format)}
            </span>
            {metric.unit && (
              <span className="text-sm text-gray-500">{metric.unit}</span>
            )}
          </div>
        </div>

        {metric.trend && (
          <div className={cn('flex items-center gap-1 text-sm', getTrendColor())}>
            {getTrendIcon()}
            <span>{Math.abs(metric.trend.value)}%</span>
          </div>
        )}
      </div>

      {metric.trend && (
        <p className="text-xs text-gray-400 mt-2">vs {metric.trend.period}</p>
      )}

      {metric.target !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Target: {formatValue(metric.target, metric.format)}</span>
            <span>
              {((metric.value / metric.target) * 100).toFixed(0)}% of target
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                metric.value >= metric.target ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{
                width: `${Math.min((metric.value / metric.target) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
