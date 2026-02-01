'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, MoreVertical, Play, Pause, Trash2, Settings, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflows } from '@/hooks/useWorkflows'
import WorkflowBuilder from '@/components/WorkflowBuilder'
import type { Workflow } from '@/types'

export default function CreateWorkflowPage() {
  const router = useRouter()
  const { workflows, isLoading, deleteWorkflow, updateStatus, refetch } = useWorkflows()
  const [selectedWorkflowMenu, setSelectedWorkflowMenu] = useState<string | null>(null)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)

  const getStatusColor = (status: Workflow['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500'
      case 'paused':
        return 'bg-yellow-500'
      case 'draft':
        return 'bg-gray-500'
      case 'archived':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const handleStatusToggle = async (e: React.MouseEvent, workflow: Workflow) => {
    e.stopPropagation()
    try {
      const action = workflow.status === 'active' ? 'deactivate' : 'activate'
      const response = await fetch('/api/n8n/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: workflow.id, action }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to toggle workflow status')
      }

      // Refetch workflows to update the list
      await refetch()
    } catch (error) {
      console.error('Error toggling workflow status:', error)
      alert(error instanceof Error ? error.message : 'Failed to toggle workflow status')
    }
    setSelectedWorkflowMenu(null)
  }

  const handleDelete = async (e: React.MouseEvent, workflowId: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this workflow?')) {
      await deleteWorkflow.mutateAsync(workflowId)
      if (activeWorkflowId === workflowId) {
        setActiveWorkflowId(null)
      }
    }
    setSelectedWorkflowMenu(null)
  }

  const handleWorkflowClick = (workflowId: string) => {
    router.push(`/workflows/${workflowId}`)
  }

  const handleNewWorkflow = () => {
    setActiveWorkflowId(null)
  }

  // Separate workflows by status
  const activeWorkflows = workflows.filter(w => w.status === 'active')
  const draftWorkflows = workflows.filter(w => w.status === 'draft')
  const pausedWorkflows = workflows.filter(w => w.status === 'paused')

  return (
    <div className="flex h-full bg-[#0d0d0d]">
      {/* Left Sidebar - Previous Workflows */}
      <div className="w-64 bg-[#0d0d0d] border-r border-[#2a2a2a] flex flex-col">
        {/* New Workflow Button */}
        <div className="p-3">
          <button
            onClick={handleNewWorkflow}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeWorkflowId === null
                ? 'bg-blue-600 text-white'
                : 'bg-[#1a1a1a] text-gray-300 border border-[#2a2a2a] hover:bg-[#2a2a2a]'
            )}
          >
            <Plus className="h-4 w-4" />
            New Workflow
          </button>
        </div>

        {/* Workflow Lists */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" />
            </div>
          ) : (
            <>
              {/* Active Workflows */}
              {activeWorkflows.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                    Active
                  </h3>
                  <div className="space-y-1">
                    {activeWorkflows.map((workflow) => (
                      <WorkflowItem
                        key={workflow.id}
                        workflow={workflow}
                        isActive={activeWorkflowId === workflow.id}
                        isMenuOpen={selectedWorkflowMenu === workflow.id}
                        onMenuToggle={() => setSelectedWorkflowMenu(
                          selectedWorkflowMenu === workflow.id ? null : workflow.id
                        )}
                        onClick={() => handleWorkflowClick(workflow.id)}
                        onStatusToggle={(e) => handleStatusToggle(e, workflow)}
                        onDelete={(e) => handleDelete(e, workflow.id)}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Draft Workflows */}
              {draftWorkflows.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                    Drafts
                  </h3>
                  <div className="space-y-1">
                    {draftWorkflows.map((workflow) => (
                      <WorkflowItem
                        key={workflow.id}
                        workflow={workflow}
                        isActive={activeWorkflowId === workflow.id}
                        isMenuOpen={selectedWorkflowMenu === workflow.id}
                        onMenuToggle={() => setSelectedWorkflowMenu(
                          selectedWorkflowMenu === workflow.id ? null : workflow.id
                        )}
                        onClick={() => handleWorkflowClick(workflow.id)}
                        onStatusToggle={(e) => handleStatusToggle(e, workflow)}
                        onDelete={(e) => handleDelete(e, workflow.id)}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Paused Workflows */}
              {pausedWorkflows.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                    Paused
                  </h3>
                  <div className="space-y-1">
                    {pausedWorkflows.map((workflow) => (
                      <WorkflowItem
                        key={workflow.id}
                        workflow={workflow}
                        isActive={activeWorkflowId === workflow.id}
                        isMenuOpen={selectedWorkflowMenu === workflow.id}
                        onMenuToggle={() => setSelectedWorkflowMenu(
                          selectedWorkflowMenu === workflow.id ? null : workflow.id
                        )}
                        onClick={() => handleWorkflowClick(workflow.id)}
                        onStatusToggle={(e) => handleStatusToggle(e, workflow)}
                        onDelete={(e) => handleDelete(e, workflow.id)}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {workflows.length === 0 && (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    No workflows yet
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Start a conversation to create your first workflow
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content - Workflow Builder */}
      <div className="flex-1 flex flex-col min-w-0">
        <WorkflowBuilder className="flex-1 min-h-0" />
      </div>
    </div>
  )
}

// Workflow Item Component
interface WorkflowItemProps {
  workflow: Workflow
  isActive: boolean
  isMenuOpen: boolean
  onMenuToggle: () => void
  onClick: () => void
  onStatusToggle: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  getStatusColor: (status: Workflow['status']) => string
}

function WorkflowItem({
  workflow,
  isActive,
  isMenuOpen,
  onMenuToggle,
  onClick,
  onStatusToggle,
  onDelete,
  getStatusColor,
}: WorkflowItemProps) {
  return (
    <div className="relative">
      <div
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
        role="button"
        tabIndex={0}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors group cursor-pointer',
          isActive
            ? 'bg-[#2a2a2a] text-white'
            : 'hover:bg-[#1a1a1a] text-gray-300'
        )}
      >
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', getStatusColor(workflow.status))} />
        <span className="flex-1 truncate">{workflow.name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#3a3a3a] rounded transition-opacity"
        >
          <MoreVertical className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute left-full top-0 ml-1 w-40 bg-[#2a2a2a] rounded-md shadow-lg border border-[#3a3a3a] py-1 z-20">
          <button
            onClick={onStatusToggle}
            className="w-full px-3 py-1.5 text-sm text-left text-gray-300 hover:bg-[#3a3a3a] flex items-center gap-2"
          >
            {workflow.status === 'active' ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Activate
              </>
            )}
          </button>
          <Link
            href={`/workflows/${workflow.id}`}
            className="w-full px-3 py-1.5 text-sm text-left text-gray-300 hover:bg-[#3a3a3a] flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings className="h-3.5 w-3.5" />
            Configure
          </Link>
          <button
            onClick={onDelete}
            className="w-full px-3 py-1.5 text-sm text-left text-red-400 hover:bg-[#3a3a3a] flex items-center gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
