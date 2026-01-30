'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, MoreVertical, Play, Pause, Trash2, Settings } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useWorkflows } from '@/hooks/useWorkflows'
import type { Workflow } from '@/types'

export default function WorkflowsPage() {
  const { workflows, isLoading, deleteWorkflow, updateStatus } = useWorkflows()
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)

  const getStatusColor = (status: Workflow['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700'
      case 'paused':
        return 'bg-yellow-100 text-yellow-700'
      case 'draft':
        return 'bg-gray-100 text-gray-700'
      case 'archived':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const handleStatusToggle = async (workflow: Workflow) => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active'
    await updateStatus.mutateAsync({ workflowId: workflow.id, status: newStatus })
  }

  const handleDelete = async (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      await deleteWorkflow.mutateAsync(workflowId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your Workflows</h1>
          <p className="text-gray-600 mt-1">
            Manage and configure your automated workflows
          </p>
        </div>
        <Link href="/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">No workflows yet</h2>
            <p className="text-gray-600 mb-4 max-w-sm">
              Create your first workflow by describing a task you'd like to automate
            </p>
            <Link href="/create">
              <Button>Create Your First Workflow</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                variant="outlined"
                className="hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Link
                      href={`/workflows/${workflow.id}`}
                      className="font-medium text-gray-900 hover:text-gray-700"
                    >
                      {workflow.name}
                    </Link>
                    <span
                      className={cn(
                        'ml-2 text-xs px-2 py-0.5 rounded-full',
                        getStatusColor(workflow.status)
                      )}
                    >
                      {workflow.status}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setSelectedWorkflow(
                          selectedWorkflow === workflow.id ? null : workflow.id
                        )
                      }
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </button>
                    {selectedWorkflow === workflow.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                        <button
                          onClick={() => handleStatusToggle(workflow)}
                          className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          {workflow.status === 'active' ? (
                            <>
                              <Pause className="h-4 w-4" />
                              Pause Workflow
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              Activate Workflow
                            </>
                          )}
                        </button>
                        <Link
                          href={`/workflows/${workflow.id}`}
                          className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Settings className="h-4 w-4" />
                          Configure
                        </Link>
                        <button
                          onClick={() => handleDelete(workflow.id)}
                          className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {workflow.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {workflow.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{workflow.steps.length} steps</span>
                  <span>•</span>
                  <span>
                    {workflow.createdAt
                      ? new Date(workflow.createdAt).toLocaleDateString()
                      : 'Recently created'}
                  </span>
                </div>

                {/* Step preview */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1">
                    {workflow.steps.slice(0, 3).map((step, idx) => (
                      <span
                        key={step.id}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          step.type === 'trigger'
                            ? 'bg-purple-50 text-purple-700'
                            : step.type === 'end'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-blue-50 text-blue-700'
                        )}
                      >
                        {step.label.slice(0, 20)}
                        {step.label.length > 20 ? '...' : ''}
                      </span>
                    ))}
                    {workflow.steps.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{workflow.steps.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
