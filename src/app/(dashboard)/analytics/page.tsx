'use client'

import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-semibold text-gray-900">Worker Analytics</h1>
        <p className="text-gray-500 mt-1">
          Monitor performance metrics and trends for your digital workers
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnalyticsDashboard />
      </div>
    </div>
  )
}
