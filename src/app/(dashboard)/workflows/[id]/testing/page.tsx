'use client'

import { use, useMemo } from 'react'
import { ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui'
import TestRunnerPanel from '@/components/testing/TestRunnerPanel'
import { createClient } from '@/lib/supabase/client'
import type { WorkflowStep } from '@/types'

// Type for workflow from database (8.2 fix)
interface DbWorkflow {
  id: string
  name: string
  description: string | null
  status: string
  steps: WorkflowStep[]
}

interface TestingPageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowTestingPage({ params }: TestingPageProps) {
  const { id } = use(params)
  // Memoize Supabase client (6.5 / W9 fix)
  const supabase = useMemo(() => createClient(), [])

  // Fetch workflow details
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflows', id], // Fix query key to match useWorkflows (2.11 / W3 fix)
    queryFn: async (): Promise<DbWorkflow | null> => {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, description, status, steps')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as DbWorkflow
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Workflow not found
        </h2>
        <Link href="/workflows">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/workflows/${id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Test: {workflow.name}
              </h1>
              <p className="text-gray-500 mt-1">
                Create and run tests for your workflow
              </p>
            </div>
          </div>
          <Link href={`/workflows/${id}`}>
            <Button variant="secondary" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configure Workflow
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Testing Panel */}
        <div className="flex-1 border-r border-gray-200">
          <TestRunnerPanel
            workflowId={id}
            workflowName={workflow.name}
            className="h-full"
          />
        </div>

        {/* Sidebar - Workflow Info */}
        <div className="w-80 bg-gray-50 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Workflow Steps
            </h2>
            <div className="space-y-2">
              {/* Type-safe step rendering (8.2 / W7 fix) */}
              {workflow.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {step.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 capitalize mt-1 block">
                    {step.type}
                  </span>
                </div>
              ))}
            </div>

            {workflow.steps.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No steps defined yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
