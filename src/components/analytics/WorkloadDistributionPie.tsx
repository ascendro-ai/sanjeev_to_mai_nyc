'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import type { WorkerAnalytics } from '@/types/analytics'

interface WorkloadDistributionPieProps {
  workers: WorkerAnalytics[]
  title?: string
  className?: string
  height?: number
}

const COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#22c55e', // green
  '#f97316', // orange
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
]

export default function WorkloadDistributionPie({
  workers,
  title,
  className,
  height = 300,
}: WorkloadDistributionPieProps) {
  const totalExecutions = workers.reduce((sum, w) => sum + w.totalExecutions30d, 0)

  const chartData = workers
    .filter((w) => w.totalExecutions30d > 0)
    .map((worker) => ({
      name: worker.name,
      value: worker.totalExecutions30d,
      percentage: totalExecutions > 0
        ? Math.round((worker.totalExecutions30d / totalExecutions) * 100)
        : 0,
      type: worker.type,
    }))
    .sort((a, b) => b.value - a.value)

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-medium text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          {data.value.toLocaleString()} executions
        </p>
        <p className="text-sm text-gray-500">{data.percentage}% of total</p>
      </div>
    )
  }

  const renderLabel = (props: { name?: string; percent?: number }) => {
    const percentage = props.percent ? Math.round(props.percent * 100) : 0
    if (percentage < 5) return null
    return `${percentage}%`
  }

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No execution data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={60}
              paddingAngle={2}
              label={renderLabel}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value, entry) => {
                const item = chartData.find((d) => d.name === value)
                return (
                  <span className="text-sm">
                    {value.length > 12 ? `${value.slice(0, 12)}...` : value}
                    {item && (
                      <span className="text-gray-400 ml-1">({item.percentage}%)</span>
                    )}
                  </span>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Summary stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {totalExecutions.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total Executions</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{chartData.length}</p>
          <p className="text-xs text-gray-500">Active Workers</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {chartData.length > 0
              ? Math.round(totalExecutions / chartData.length)
              : 0}
          </p>
          <p className="text-xs text-gray-500">Avg per Worker</p>
        </div>
      </div>
    </div>
  )
}

interface TypeDistributionProps {
  workers: WorkerAnalytics[]
  title?: string
  className?: string
}

export function TypeDistribution({
  workers,
  title,
  className,
}: TypeDistributionProps) {
  const aiWorkers = workers.filter((w) => w.type === 'ai')
  const humanWorkers = workers.filter((w) => w.type === 'human')

  const aiExecutions = aiWorkers.reduce((sum, w) => sum + w.totalExecutions30d, 0)
  const humanExecutions = humanWorkers.reduce((sum, w) => sum + w.totalExecutions30d, 0)
  const total = aiExecutions + humanExecutions

  const chartData = [
    {
      name: 'AI Workers',
      value: aiExecutions,
      count: aiWorkers.length,
      color: '#3b82f6',
    },
    {
      name: 'Human',
      value: humanExecutions,
      count: humanWorkers.length,
      color: '#a855f7',
    },
  ].filter((d) => d.value > 0)

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}

      <div className="flex items-center gap-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium text-gray-700">
                {item.name}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {item.value.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}% ·{' '}
              {item.count} workers
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar visualization */}
      <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {chartData.map((item, index) => (
          <div
            key={item.name}
            className="h-full transition-all"
            style={{
              width: total > 0 ? `${(item.value / total) * 100}%` : '0%',
              backgroundColor: item.color,
            }}
          />
        ))}
      </div>
    </div>
  )
}
