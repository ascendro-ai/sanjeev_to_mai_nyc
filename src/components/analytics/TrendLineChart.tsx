'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { MetricDataPoint } from '@/types/analytics'

interface TrendLineChartProps {
  data: MetricDataPoint[]
  dataKey?: string
  title?: string
  color?: string
  showMovingAverage?: boolean
  movingAverageData?: MetricDataPoint[]
  yAxisLabel?: string
  formatValue?: (value: number) => string
  className?: string
  height?: number
}

export default function TrendLineChart({
  data,
  dataKey = 'value',
  title,
  color = '#3b82f6',
  showMovingAverage = false,
  movingAverageData,
  yAxisLabel,
  formatValue = (v) => v.toLocaleString(),
  className,
  height = 300,
}: TrendLineChartProps) {
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Merge data with moving average if provided
  const chartData = data.map((point, index) => ({
    date: point.date,
    value: point.value,
    movingAvg: movingAverageData?.[index]?.value,
  }))

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={formatValue}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 12, fill: '#6b7280' },
                  }
                : undefined
            }
          />
          <Tooltip
            formatter={(value) => [formatValue(Number(value) || 0), dataKey]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          />
          {showMovingAverage && movingAverageData && <Legend />}
          <Line
            type="monotone"
            dataKey="value"
            name="Value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
          {showMovingAverage && movingAverageData && (
            <Line
              type="monotone"
              dataKey="movingAvg"
              name="7-day avg"
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface MultiLineChartProps {
  data: Array<Record<string, unknown>>
  lines: Array<{
    dataKey: string
    name: string
    color: string
  }>
  title?: string
  xAxisKey?: string
  yAxisLabel?: string
  formatValue?: (value: number) => string
  className?: string
  height?: number
}

export function MultiLineChart({
  data,
  lines,
  title,
  xAxisKey = 'date',
  yAxisLabel,
  formatValue = (v) => v.toLocaleString(),
  className,
  height = 300,
}: MultiLineChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={xAxisKey}
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={formatValue}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 12, fill: '#6b7280' },
                  }
                : undefined
            }
          />
          <Tooltip
            formatter={(value, name) => [formatValue(Number(value) || 0), String(name)]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: line.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
