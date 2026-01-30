'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { WorkerAnalytics } from '@/types/analytics'

interface WorkerComparisonChartProps {
  workers: WorkerAnalytics[]
  metric: 'executions' | 'successRate' | 'avgDuration' | 'reviewApprovalRate'
  title?: string
  className?: string
  height?: number
  showLegend?: boolean
}

const COLORS = {
  ai: '#3b82f6',
  human: '#a855f7',
}

export default function WorkerComparisonChart({
  workers,
  metric,
  title,
  className,
  height = 300,
  showLegend = true,
}: WorkerComparisonChartProps) {
  // Prepare data for the chart
  const chartData = workers.map((worker) => {
    let value: number
    switch (metric) {
      case 'executions':
        value = worker.totalExecutions30d
        break
      case 'successRate':
        value = worker.successRate30d
        break
      case 'avgDuration':
        value = worker.avgExecutionTimeMs
        break
      case 'reviewApprovalRate':
        value = worker.reviewApprovalRate
        break
      default:
        value = 0
    }

    return {
      name: worker.name.length > 15 ? `${worker.name.slice(0, 12)}...` : worker.name,
      fullName: worker.name,
      value,
      type: worker.type,
      id: worker.id,
    }
  })

  // Sort by value descending
  chartData.sort((a, b) => b.value - a.value)

  const formatValue = (value: number) => {
    switch (metric) {
      case 'successRate':
      case 'reviewApprovalRate':
        return `${value.toFixed(1)}%`
      case 'avgDuration':
        if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}s`
        }
        return `${value}ms`
      default:
        return value.toLocaleString()
    }
  }

  const getMetricLabel = () => {
    switch (metric) {
      case 'executions':
        return 'Total Executions'
      case 'successRate':
        return 'Success Rate'
      case 'avgDuration':
        return 'Avg Duration'
      case 'reviewApprovalRate':
        return 'Review Approval Rate'
      default:
        return metric
    }
  }

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={formatValue}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={75}
          />
          <Tooltip
            formatter={(value) => [formatValue(Number(value) || 0), getMetricLabel()]}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullName
              }
              return label
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          />
          {showLegend && (
            <Legend
              content={() => (
                <div className="flex justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.ai }} />
                    <span>AI Worker</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.human }} />
                    <span>Human</span>
                  </div>
                </div>
              )}
            />
          )}
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.type === 'ai' ? COLORS.ai : COLORS.human}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface StackedComparisonChartProps {
  workers: WorkerAnalytics[]
  title?: string
  className?: string
  height?: number
}

export function StackedComparisonChart({
  workers,
  title,
  className,
  height = 300,
}: StackedComparisonChartProps) {
  const chartData = workers.map((worker) => ({
    name: worker.name.length > 15 ? `${worker.name.slice(0, 12)}...` : worker.name,
    fullName: worker.name,
    successful: worker.successful30d,
    failed: worker.failed30d,
    type: worker.type,
  }))

  // Sort by total executions descending
  chartData.sort((a, b) => (b.successful + b.failed) - (a.successful + a.failed))

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={75}
          />
          <Tooltip
            formatter={(value, name) => [
              Number(value).toLocaleString(),
              name === 'successful' ? 'Successful' : 'Failed',
            ]}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullName
              }
              return label
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          />
          <Legend />
          <Bar dataKey="successful" stackId="a" fill="#22c55e" name="Successful" radius={[0, 0, 0, 0]} />
          <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
