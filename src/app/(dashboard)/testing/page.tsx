'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  FlaskConical,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Search,
} from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function TestingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()

  // Fetch workflows with their test case counts
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows-testing'],
    queryFn: async () => {
      const { data: workflowsData, error } = await supabase
        .from('workflows')
        .select('id, name, description, status, steps')
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Get test case counts for each workflow
      const workflowIds = workflowsData.map((w) => w.id)
      const { data: testCases } = await supabase
        .from('test_cases')
        .select('workflow_id, last_run_status')
        .in('workflow_id', workflowIds)

      // Get recent test runs
      const { data: testRuns } = await supabase
        .from('test_runs')
        .select('workflow_id, status, created_at')
        .in('workflow_id', workflowIds)
        .order('created_at', { ascending: false })
        .limit(100)

      // Aggregate data
      return workflowsData.map((workflow) => {
        const workflowTestCases = testCases?.filter(
          (tc) => tc.workflow_id === workflow.id
        ) || []
        const workflowTestRuns = testRuns?.filter(
          (tr) => tr.workflow_id === workflow.id
        ) || []

        const passedTests = workflowTestCases.filter(
          (tc) => tc.last_run_status === 'passed'
        ).length
        const failedTests = workflowTestCases.filter(
          (tc) => tc.last_run_status === 'failed'
        ).length

        const recentRun = workflowTestRuns[0]

        return {
          ...workflow,
          testCaseCount: workflowTestCases.length,
          passedTests,
          failedTests,
          recentRunStatus: recentRun?.status,
          recentRunDate: recentRun?.created_at,
        }
      })
    },
  })

  const filteredWorkflows = workflows?.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'running':
      case 'pending':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
      default:
        return <FlaskConical className="h-5 w-5 text-gray-400" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Testing</h1>
            <p className="text-gray-500 mt-1">
              Test your workflows with mock data before production
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!filteredWorkflows || filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FlaskConical className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              {searchQuery ? 'No workflows found' : 'No workflows yet'}
            </h2>
            <p className="text-gray-600 mb-4 max-w-sm">
              {searchQuery
                ? 'Try a different search term'
                : 'Create a workflow first, then you can test it here'}
            </p>
            {!searchQuery && (
              <Link href="/create">
                <Button>Create Workflow</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredWorkflows.map((workflow) => (
              <Link
                key={workflow.id}
                href={`/workflows/${workflow.id}/testing`}
              >
                <Card
                  variant="outlined"
                  className="hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {getStatusIcon(workflow.recentRunStatus)}
                    </div>

                    {/* Workflow Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {workflow.name}
                      </h3>
                      {workflow.description && (
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {workflow.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-400">
                          {(workflow.steps as unknown[])?.length || 0} steps
                        </span>
                        {workflow.testCaseCount > 0 && (
                          <span className="text-xs text-gray-400">
                            {workflow.testCaseCount} test case
                            {workflow.testCaseCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {workflow.recentRunDate && (
                          <span className="text-xs text-gray-400">
                            Last run:{' '}
                            {new Date(workflow.recentRunDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Test Stats */}
                    <div className="flex items-center gap-4">
                      {workflow.testCaseCount > 0 && (
                        <div className="flex items-center gap-2">
                          {workflow.passedTests > 0 && (
                            <span className="flex items-center gap-1 text-sm text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              {workflow.passedTests}
                            </span>
                          )}
                          {workflow.failedTests > 0 && (
                            <span className="flex items-center gap-1 text-sm text-red-600">
                              <XCircle className="h-4 w-4" />
                              {workflow.failedTests}
                            </span>
                          )}
                        </div>
                      )}
                      <Button variant="secondary" size="sm">
                        <Play className="h-4 w-4 mr-1" />
                        Test
                      </Button>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
