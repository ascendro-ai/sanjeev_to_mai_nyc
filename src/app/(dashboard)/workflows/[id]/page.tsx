'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Bot,
  User,
  ChevronRight,
} from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useWorkflows } from '@/hooks/useWorkflows'
import { useTeam } from '@/hooks/useTeam'
import type { WorkflowStep, DigitalWorker } from '@/types'

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { useWorkflow, updateStatus, assignWorker, updateSteps } = useWorkflows()
  const { data: workflow, isLoading } = useWorkflow(id)
  const { workers } = useTeam()

  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-medium text-gray-900 mb-2">Workflow not found</h2>
        <Link href="/workflows">
          <Button variant="secondary">Back to Workflows</Button>
        </Link>
      </div>
    )
  }

  const handleStatusToggle = async () => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active'
    await updateStatus.mutateAsync({ workflowId: workflow.id, status: newStatus })
  }

  const handleAssignWorker = async (worker: DigitalWorker) => {
    await assignWorker.mutateAsync({ workflowId: workflow.id, workerId: worker.id })
    setIsAssignModalOpen(false)
  }

  const getStepTypeColor = (type: WorkflowStep['type']) => {
    switch (type) {
      case 'trigger':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'action':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'decision':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'end':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/workflows"
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">{workflow.name}</h1>
            {workflow.description && (
              <p className="text-gray-600 mt-1">{workflow.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                workflow.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : workflow.status === 'paused'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
              )}
            >
              {workflow.status}
            </span>
            <Button
              variant="secondary"
              onClick={handleStatusToggle}
              isLoading={updateStatus.isPending}
            >
              {workflow.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Assigned Worker */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Assigned to:</span>
          {workflow.assignedTo ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <span className="font-medium text-gray-900">
                {workflow.assignedTo.stakeholderName}
              </span>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsAssignModalOpen(true)}
            >
              Assign Worker
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Workflow Steps</h2>

        <div className="space-y-4">
          {workflow.steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4">
              {/* Step connector */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2',
                    getStepTypeColor(step.type)
                  )}
                >
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                {index < workflow.steps.length - 1 && (
                  <div className="w-0.5 h-8 bg-gray-200 mt-2" />
                )}
              </div>

              {/* Step card */}
              <Card
                variant="outlined"
                className="flex-1 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setSelectedStep(step)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{step.label}</span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full capitalize',
                          getStepTypeColor(step.type)
                        )}
                      >
                        {step.type}
                      </span>
                    </div>

                    {step.assignedTo && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
                        {step.assignedTo.type === 'ai' ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                        <span>
                          {step.assignedTo.agentName || step.assignedTo.type}
                        </span>
                      </div>
                    )}

                    {step.requirements?.isComplete && (
                      <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Configured
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Step Detail Modal */}
      <Modal
        isOpen={!!selectedStep}
        onClose={() => setSelectedStep(null)}
        title={selectedStep?.label || 'Step Details'}
        size="lg"
      >
        {selectedStep && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <span
                  className={cn(
                    'inline-block px-3 py-1 rounded-full text-sm capitalize',
                    getStepTypeColor(selectedStep.type)
                  )}
                >
                  {selectedStep.type}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned To
                </label>
                {selectedStep.assignedTo ? (
                  <div className="flex items-center gap-2">
                    {selectedStep.assignedTo.type === 'ai' ? (
                      <Bot className="h-4 w-4 text-blue-600" />
                    ) : (
                      <User className="h-4 w-4 text-purple-600" />
                    )}
                    <span>
                      {selectedStep.assignedTo.agentName ||
                        selectedStep.assignedTo.type}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500">Not assigned</span>
                )}
              </div>
            </div>

            {selectedStep.requirements && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements
                </label>
                {selectedStep.requirements.requirementsText ? (
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                    {selectedStep.requirements.requirementsText}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No requirements configured yet
                  </p>
                )}
              </div>
            )}

            {selectedStep.requirements?.blueprint && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-2">
                    Green List (Allowed)
                  </label>
                  <ul className="text-sm space-y-1">
                    {selectedStep.requirements.blueprint.greenList.map(
                      (item, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          {item}
                        </li>
                      )
                    )}
                  </ul>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-2">
                    Red List (Forbidden)
                  </label>
                  <ul className="text-sm space-y-1">
                    {selectedStep.requirements.blueprint.redList.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setSelectedStep(null)}>
                Close
              </Button>
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Worker Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Digital Worker"
      >
        <div className="space-y-4">
          {workers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No workers available</p>
              <Link href="/team">
                <Button>Create a Worker</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {workers.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => handleAssignWorker(worker)}
                  className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        worker.type === 'ai' ? 'bg-blue-100' : 'bg-purple-100'
                      )}
                    >
                      {worker.type === 'ai' ? (
                        <Bot className="h-5 w-5 text-blue-600" />
                      ) : (
                        <User className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{worker.name}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {worker.type} • {worker.status}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
