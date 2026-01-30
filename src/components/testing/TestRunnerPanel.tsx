'use client'

import { useState } from 'react'
import {
  Play,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useTestRunner } from '@/hooks/useTestRunner'
import { useTestCases } from '@/hooks/useTestCases'
import MockDataEditor from './MockDataEditor'
import TestResultsViewer from './TestResultsViewer'
import type { TestCase, TestRun, TestStepResult } from '@/types/testing'

interface TestRunnerPanelProps {
  workflowId: string
  workflowName?: string
  className?: string
}

type Tab = 'cases' | 'custom' | 'history'

export default function TestRunnerPanel({
  workflowId,
  workflowName,
  className,
}: TestRunnerPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('cases')
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null)
  const [customMockData, setCustomMockData] = useState<Record<string, unknown>>({})
  const [showResults, setShowResults] = useState(false)

  const { testCases, isLoading: isLoadingCases } = useTestCases({ workflowId })
  const {
    testRuns,
    activeRun,
    activeRunStepResults,
    isRunning,
    isPassed,
    isFailed,
    runTestCase,
    runWithMockData,
    cancelTestRun,
    activeRunId,
    setActiveRunId,
    refetchRuns,
  } = useTestRunner({ workflowId })

  const handleRunTestCase = async (testCase: TestCase) => {
    setSelectedTestCase(testCase)
    setShowResults(true)
    await runTestCase(testCase.id, workflowId)
  }

  const handleRunCustomTest = async () => {
    setSelectedTestCase(null)
    setShowResults(true)
    await runWithMockData(workflowId, customMockData)
  }

  const handleCancel = async () => {
    if (activeRunId) {
      await cancelTestRun.mutateAsync(activeRunId)
    }
  }

  const getStatusIcon = (status: TestRun['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'running':
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: TestRun['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      case 'error':
        return 'bg-yellow-100 text-yellow-700'
      case 'running':
      case 'pending':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">Test Runner</h2>
        {workflowName && (
          <p className="text-sm text-gray-500 mt-1">{workflowName}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {(['cases', 'custom', 'history'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'cases' && 'Test Cases'}
            {tab === 'custom' && 'Custom Test'}
            {tab === 'history' && 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'cases' && (
          <div className="space-y-3">
            {isLoadingCases ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : testCases.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No test cases yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create a test case to save your test configuration
                </p>
              </div>
            ) : (
              testCases.map((testCase) => (
                <Card
                  key={testCase.id}
                  variant="outlined"
                  className="hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {testCase.name}
                      </h3>
                      {testCase.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {testCase.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {testCase.lastRunStatus && (
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              getStatusColor(testCase.lastRunStatus)
                            )}
                          >
                            {testCase.lastRunStatus}
                          </span>
                        )}
                        {testCase.assertions.length > 0 && (
                          <span className="text-xs text-gray-400">
                            {testCase.assertions.length} assertions
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRunTestCase(testCase)}
                      disabled={isRunning}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mock Trigger Data
              </label>
              <MockDataEditor
                value={customMockData}
                onChange={setCustomMockData}
                placeholder="Enter mock data for the workflow trigger..."
              />
            </div>
            <Button
              onClick={handleRunCustomTest}
              disabled={isRunning || Object.keys(customMockData).length === 0}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              Run Custom Test
            </Button>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {testRuns.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No test runs yet</p>
              </div>
            ) : (
              testRuns.map((run) => (
                <Card
                  key={run.id}
                  variant="outlined"
                  className={cn(
                    'cursor-pointer hover:shadow-sm transition-shadow',
                    activeRunId === run.id && 'ring-2 ring-blue-500'
                  )}
                  onClick={() => {
                    setActiveRunId(run.id)
                    setShowResults(true)
                  }}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(run.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {run.runType === 'full_workflow'
                            ? 'Full Workflow'
                            : run.runType === 'single_step'
                              ? 'Single Step'
                              : 'Step Range'}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            getStatusColor(run.status)
                          )}
                        >
                          {run.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {run.createdAt && (
                          <span>{new Date(run.createdAt).toLocaleString()}</span>
                        )}
                        {run.durationMs && (
                          <span>{(run.durationMs / 1000).toFixed(2)}s</span>
                        )}
                        {run.totalAssertions > 0 && (
                          <span>
                            {run.passedAssertions}/{run.totalAssertions} passed
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Running Status Bar */}
      {isRunning && (
        <div className="p-4 border-t border-gray-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span className="text-sm text-blue-700">Test running...</span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleCancel}>
              <Square className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {showResults && activeRun && (
        <div className="border-t border-gray-200">
          <div
            className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer"
            onClick={() => setShowResults(!showResults)}
          >
            <div className="flex items-center gap-2">
              {showResults ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-medium text-sm">Test Results</span>
              {activeRun && (
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    getStatusColor(activeRun.status)
                  )}
                >
                  {activeRun.status}
                </span>
              )}
            </div>
          </div>
          {showResults && (
            <TestResultsViewer
              testRun={activeRun}
              stepResults={activeRunStepResults}
              className="border-t border-gray-200"
            />
          )}
        </div>
      )}
    </div>
  )
}
