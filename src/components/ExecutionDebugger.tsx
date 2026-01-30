'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'

interface DebugAnalysis {
  summary: string
  rootCause: string
  affectedStep: string
  suggestedFixes: string[]
  preventionTips: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'configuration' | 'data' | 'integration' | 'logic' | 'timeout' | 'permission' | 'unknown'
}

interface Props {
  executionId?: string
  workflowId?: string
  onFixApplied?: () => void
}

export default function ExecutionDebugger({ executionId, workflowId, onFixApplied }: Props) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [analysis, setAnalysis] = useState<DebugAnalysis | null>(null)

  const debugMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/n8n/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, workflowId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to analyze execution')
      }

      return response.json()
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis)
    },
  })

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'configuration':
        return <Shield className="h-4 w-4" />
      case 'permission':
        return <Shield className="h-4 w-4" />
      case 'integration':
        return <RefreshCw className="h-4 w-4" />
      case 'data':
        return <AlertTriangle className="h-4 w-4" />
      case 'logic':
        return <Bug className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <Card variant="outlined" className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bug className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-gray-900">AI Debugger</span>
          {analysis && (
            <span
              className={cn(
                'px-2 py-0.5 text-xs rounded-full border',
                getSeverityColor(analysis.severity)
              )}
            >
              {analysis.severity.toUpperCase()}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Analyze Button */}
          {!analysis && (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">
                Use AI to analyze this failed execution and get suggestions for fixing it.
              </p>
              <Button
                onClick={() => debugMutation.mutate()}
                isLoading={debugMutation.isPending}
              >
                <Bug className="h-4 w-4 mr-2" />
                Analyze Failure
              </Button>
            </div>
          )}

          {/* Error State */}
          {debugMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Analysis Failed</span>
              </div>
              <p className="text-red-700 mt-1 text-sm">
                {debugMutation.error instanceof Error
                  ? debugMutation.error.message
                  : 'An error occurred'}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => debugMutation.mutate()}
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {getCategoryIcon(analysis.category)}
                  <span className="font-medium text-gray-900">Summary</span>
                  <span className="text-xs text-gray-500 capitalize">
                    ({analysis.category})
                  </span>
                </div>
                <p className="text-gray-700">{analysis.summary}</p>
              </div>

              {/* Root Cause */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Root Cause
                </h4>
                <p className="text-gray-700 bg-orange-50 border border-orange-100 rounded-lg p-3">
                  {analysis.rootCause}
                </p>
                {analysis.affectedStep && (
                  <p className="text-sm text-gray-500 mt-2">
                    Affected step: <span className="font-medium">{analysis.affectedStep}</span>
                  </p>
                )}
              </div>

              {/* Suggested Fixes */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Suggested Fixes
                </h4>
                <ul className="space-y-2">
                  {analysis.suggestedFixes.map((fix, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-lg p-3"
                    >
                      <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prevention Tips */}
              {analysis.preventionTips.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Prevention Tips
                  </h4>
                  <ul className="space-y-1">
                    {analysis.preventionTips.map((tip, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-gray-600"
                      >
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAnalysis(null)
                    debugMutation.reset()
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-analyze
                </Button>
                {onFixApplied && (
                  <Button size="sm" onClick={onFixApplied}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Fixed
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
