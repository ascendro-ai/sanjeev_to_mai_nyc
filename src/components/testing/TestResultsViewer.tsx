'use client'

import { useState } from 'react'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Code,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TestRun, TestStepResult, AssertionResult } from '@/types/testing'

interface TestResultsViewerProps {
  testRun: TestRun
  stepResults: TestStepResult[]
  className?: string
}

export default function TestResultsViewer({
  testRun,
  stepResults,
  className,
}: TestResultsViewerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [showAssertions, setShowAssertions] = useState(true)

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'running':
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'skipped':
        return <div className="h-4 w-4 rounded-full bg-gray-300" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className={cn('bg-white', className)}>
      {/* Summary */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon(testRun.status)}
            <div>
              <span className="font-medium text-gray-900">
                {testRun.status === 'passed'
                  ? 'All tests passed'
                  : testRun.status === 'failed'
                    ? 'Some tests failed'
                    : testRun.status === 'error'
                      ? 'Test error'
                      : testRun.status === 'running'
                        ? 'Running...'
                        : 'Pending'}
              </span>
              {testRun.durationMs && (
                <span className="text-sm text-gray-500 ml-2">
                  ({(testRun.durationMs / 1000).toFixed(2)}s)
                </span>
              )}
            </div>
          </div>
          {testRun.totalAssertions > 0 && (
            <div className="text-sm">
              <span className="text-green-600 font-medium">
                {testRun.passedAssertions} passed
              </span>
              {testRun.failedAssertions > 0 && (
                <>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-red-600 font-medium">
                    {testRun.failedAssertions} failed
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        {testRun.errorMessage && (
          <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">
            {testRun.errorMessage}
          </div>
        )}
      </div>

      {/* Step Results */}
      <div className="divide-y divide-gray-200">
        {stepResults.map((step, index) => (
          <div key={step.id} className="bg-white">
            {/* Step Header */}
            <div
              className={cn(
                'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50',
                step.status === 'failed' && 'bg-red-50'
              )}
              onClick={() => toggleStep(step.id)}
            >
              {expandedSteps.has(step.id) ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              {getStatusIcon(step.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    Step {index + 1}: {step.stepName}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    ({step.stepType})
                  </span>
                </div>
                {step.durationMs && (
                  <span className="text-xs text-gray-400">
                    {step.durationMs}ms
                  </span>
                )}
              </div>
              {(step.assertionsPassed > 0 || step.assertionsFailed > 0) && (
                <div className="text-xs">
                  <span className="text-green-600">{step.assertionsPassed}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-600">{step.assertionsFailed}</span>
                </div>
              )}
            </div>

            {/* Step Details */}
            {expandedSteps.has(step.id) && (
              <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                {/* Error */}
                {step.error && (
                  <div className="mt-3 p-2 bg-red-50 text-red-700 text-sm rounded">
                    <p className="font-medium">Error:</p>
                    <p className="mt-1">{step.error}</p>
                    {step.errorStack && (
                      <pre className="mt-2 text-xs overflow-x-auto">
                        {step.errorStack}
                      </pre>
                    )}
                  </div>
                )}

                {/* Input Data */}
                {step.inputData && Object.keys(step.inputData).length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Code className="h-4 w-4" />
                      Input
                    </div>
                    <pre className="mt-1 p-2 bg-white rounded border text-xs overflow-x-auto">
                      {JSON.stringify(step.inputData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Output Data */}
                {step.outputData && Object.keys(step.outputData).length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Code className="h-4 w-4" />
                      Output
                    </div>
                    <pre className="mt-1 p-2 bg-white rounded border text-xs overflow-x-auto">
                      {JSON.stringify(step.outputData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Assertions */}
                {step.assertionDetails && step.assertionDetails.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Assertions
                    </div>
                    <div className="space-y-1">
                      {step.assertionDetails.map((assertion, idx) => (
                        <AssertionRow key={idx} assertion={assertion} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overall Assertions */}
      {showAssertions &&
        testRun.assertionResults &&
        testRun.assertionResults.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowAssertions(!showAssertions)}
            >
              <div className="text-sm font-medium text-gray-700">
                All Assertions ({testRun.assertionResults.length})
              </div>
              {showAssertions ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
            {showAssertions && (
              <div className="mt-3 space-y-1">
                {testRun.assertionResults.map((assertion, idx) => (
                  <AssertionRow key={idx} assertion={assertion} />
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  )
}

function AssertionRow({ assertion }: { assertion: AssertionResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'rounded p-2 text-sm',
        assertion.passed ? 'bg-green-50' : 'bg-red-50'
      )}
    >
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {assertion.passed ? (
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        )}
        <span
          className={cn(
            'flex-1',
            assertion.passed ? 'text-green-700' : 'text-red-700'
          )}
        >
          {assertion.assertionName}
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </div>
      {expanded && (
        <div className="mt-2 pl-6 space-y-1 text-xs">
          {assertion.path && (
            <p className="text-gray-600">
              Path: <code className="bg-white px-1 rounded">{assertion.path}</code>
            </p>
          )}
          <p className="text-gray-600">
            Expected: <code className="bg-white px-1 rounded">{JSON.stringify(assertion.expectedValue)}</code>
          </p>
          <p className="text-gray-600">
            Actual: <code className="bg-white px-1 rounded">{JSON.stringify(assertion.actualValue)}</code>
          </p>
          {assertion.message && (
            <p className={assertion.passed ? 'text-green-600' : 'text-red-600'}>
              {assertion.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
