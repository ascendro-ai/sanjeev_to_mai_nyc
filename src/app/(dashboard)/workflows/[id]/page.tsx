'use client'

import { useState, use, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Bot,
  User,
  ChevronRight,
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button, Card, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useWorkflows } from '@/hooks/useWorkflows'
import { useTeam } from '@/hooks/useTeam'
import type { WorkflowStep, DigitalWorker, StepRequirements } from '@/types'

// Edit form state type
interface StepEditForm {
  label: string
  type: WorkflowStep['type']
  assignedToType: 'ai' | 'human' | ''
  assignedToName: string
  requirementsText: string
  greenList: string[]
  redList: string[]
}

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
  const [isEditMode, setIsEditMode] = useState(false)
  const [editForm, setEditForm] = useState<StepEditForm | null>(null)
  const [newGreenItem, setNewGreenItem] = useState('')
  const [newRedItem, setNewRedItem] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null) // W1 fix: Error state for mutations
  const [saveSuccess, setSaveSuccess] = useState(false) // W1 fix: Success state for mutations
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false) // W5/W8 fix: Track unsaved changes
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false) // W8 fix: Confirm dialog state
  const [pendingStepId, setPendingStepId] = useState<string | null>(null) // W5 fix: Step to switch to after confirm

  // Initialize edit form from selected step
  const startEditing = useCallback(() => {
    if (!selectedStep) return
    setEditForm({
      label: selectedStep.label,
      type: selectedStep.type,
      assignedToType: selectedStep.assignedTo?.type || '',
      assignedToName: selectedStep.assignedTo?.agentName || '',
      requirementsText: selectedStep.requirements?.requirementsText || '',
      greenList: selectedStep.requirements?.blueprint?.greenList || [],
      redList: selectedStep.requirements?.blueprint?.redList || [],
    })
    setIsEditMode(true)
    setHasUnsavedChanges(false) // W5 fix: Reset unsaved changes when starting edit
  }, [selectedStep])

  // W5 fix: Function to handle step selection with unsaved changes check
  const handleStepSelect = useCallback((step: WorkflowStep) => {
    if (isEditMode && hasUnsavedChanges) {
      // Store the step to switch to and show confirmation
      setPendingStepId(step.id)
      setShowDiscardConfirm(true)
    } else {
      setSelectedStep(step)
      setIsEditMode(false)
      setEditForm(null)
      setHasUnsavedChanges(false)
    }
  }, [isEditMode, hasUnsavedChanges])

  // W8 fix: Function to handle cancel with unsaved changes check
  const handleCancelEdit = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingStepId(null) // No pending step, just canceling
      setShowDiscardConfirm(true)
    } else {
      setIsEditMode(false)
      setEditForm(null)
    }
  }, [hasUnsavedChanges])

  // W5/W8 fix: Confirm discard and proceed
  const confirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false)
    setHasUnsavedChanges(false)
    setIsEditMode(false)
    setEditForm(null)

    if (pendingStepId) {
      // W5: Switch to the pending step
      const step = workflow?.steps.find(s => s.id === pendingStepId)
      if (step) {
        setSelectedStep(step)
      }
      setPendingStepId(null)
    } else {
      // W8: Just canceling edit
      setSelectedStep(null)
    }
  }, [pendingStepId, workflow?.steps])

  // Save step changes - W1 fix: Add error handling
  const handleSaveStep = useCallback(async () => {
    if (!workflow || !selectedStep || !editForm) return

    setSaveError(null)
    setSaveSuccess(false)

    const updatedSteps = workflow.steps.map((step) => {
      if (step.id !== selectedStep.id) return step

      const requirements: StepRequirements = {
        ...step.requirements,
        requirementsText: editForm.requirementsText,
        isComplete: !!(editForm.requirementsText || editForm.greenList.length || editForm.redList.length),
        blueprint: {
          greenList: editForm.greenList,
          redList: editForm.redList,
        },
      }

      return {
        ...step,
        label: editForm.label,
        type: editForm.type,
        assignedTo: editForm.assignedToType ? {
          type: editForm.assignedToType,
          agentName: editForm.assignedToName || undefined,
        } : undefined,
        requirements,
      }
    })

    try {
      await updateSteps.mutateAsync({ workflowId: workflow.id, steps: updatedSteps })
      setSaveSuccess(true)
      setHasUnsavedChanges(false) // W5 fix: Clear unsaved changes on save
      setTimeout(() => setSaveSuccess(false), 3000) // Clear success after 3s
      setIsEditMode(false)
      setSelectedStep(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes'
      setSaveError(errorMessage)
      console.error('Error saving step:', error)
    }
  }, [workflow, selectedStep, editForm, updateSteps])

  // W6 fix: Helper to sanitize and validate list items
  const sanitizeListItem = (item: string): string => {
    // Remove HTML tags and trim
    return item.replace(/<[^>]*>/g, '').trim().slice(0, 200) // Max 200 chars
  }

  // Add item to green list - W6 fix: Add validation
  const addGreenItem = useCallback(() => {
    if (!newGreenItem.trim() || !editForm) return

    const sanitized = sanitizeListItem(newGreenItem)
    if (!sanitized) return

    // W6 fix: Check for duplicates (case-insensitive)
    if (editForm.greenList.some(item => item.toLowerCase() === sanitized.toLowerCase())) {
      return // Silently ignore duplicates
    }

    // W6 fix: Limit max items
    if (editForm.greenList.length >= 50) {
      setSaveError('Maximum 50 items allowed in green list')
      return
    }

    setEditForm({ ...editForm, greenList: [...editForm.greenList, sanitized] })
    setNewGreenItem('')
    setHasUnsavedChanges(true) // W5 fix: Track changes
  }, [newGreenItem, editForm])

  // Add item to red list - W6 fix: Add validation
  const addRedItem = useCallback(() => {
    if (!newRedItem.trim() || !editForm) return

    const sanitized = sanitizeListItem(newRedItem)
    if (!sanitized) return

    // W6 fix: Check for duplicates (case-insensitive)
    if (editForm.redList.some(item => item.toLowerCase() === sanitized.toLowerCase())) {
      return // Silently ignore duplicates
    }

    // W6 fix: Limit max items
    if (editForm.redList.length >= 50) {
      setSaveError('Maximum 50 items allowed in red list')
      return
    }

    setEditForm({ ...editForm, redList: [...editForm.redList, sanitized] })
    setNewRedItem('')
    setHasUnsavedChanges(true) // W5 fix: Track changes
  }, [newRedItem, editForm])

  // Remove item from green list
  const removeGreenItem = useCallback((index: number) => {
    if (!editForm) return
    setEditForm({ ...editForm, greenList: editForm.greenList.filter((_, i) => i !== index) })
    setHasUnsavedChanges(true) // W5 fix: Track changes
  }, [editForm])

  // Remove item from red list
  const removeRedItem = useCallback((index: number) => {
    if (!editForm) return
    setEditForm({ ...editForm, redList: editForm.redList.filter((_, i) => i !== index) })
    setHasUnsavedChanges(true) // W5 fix: Track changes
  }, [editForm])

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

  // W1 fix: Add error handling to status toggle
  const handleStatusToggle = async () => {
    setSaveError(null)
    const newStatus = workflow.status === 'active' ? 'paused' : 'active'
    try {
      await updateStatus.mutateAsync({ workflowId: workflow.id, status: newStatus })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status'
      setSaveError(errorMessage)
      console.error('Error updating status:', error)
    }
  }

  // W1 fix: Add error handling to worker assignment
  const handleAssignWorker = async (worker: DigitalWorker) => {
    setSaveError(null)
    try {
      await assignWorker.mutateAsync({ workflowId: workflow.id, workerId: worker.id })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setIsAssignModalOpen(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign worker'
      setSaveError(errorMessage)
      console.error('Error assigning worker:', error)
    }
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
      {/* W1 fix: Toast notifications for save errors/success */}
      {saveError && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg flex items-start gap-3 max-w-md animate-in slide-in-from-top">
          <div className="text-red-500 flex-shrink-0 mt-0.5">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Save Failed</p>
            <p className="text-sm text-red-600 mt-0.5">{saveError}</p>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg flex items-center gap-3 animate-in slide-in-from-top">
          <div className="text-green-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-green-800">Changes saved successfully</p>
        </div>
      )}

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

              {/* Step card - W5 fix: Use handleStepSelect */}
              <Card
                variant="outlined"
                className="flex-1 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => handleStepSelect(step)}
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

      {/* Step Detail Modal - W5/W8 fix: Check unsaved changes on close */}
      <Modal
        isOpen={!!selectedStep}
        onClose={() => {
          if (isEditMode && hasUnsavedChanges) {
            setPendingStepId(null)
            setShowDiscardConfirm(true)
          } else {
            setSelectedStep(null)
            setIsEditMode(false)
            setEditForm(null)
            setHasUnsavedChanges(false)
          }
        }}
        title={isEditMode ? `Edit: ${selectedStep?.label}` : selectedStep?.label || 'Step Details'}
        size="lg"
      >
        {selectedStep && !isEditMode && (
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
              <Button onClick={startEditing}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          </div>
        )}

        {/* Edit Mode Form */}
        {selectedStep && isEditMode && editForm && (
          <div className="space-y-4">
            {/* Step Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step Label
              </label>
              <Input
                value={editForm.label}
                onChange={(e) => {
                  setEditForm({ ...editForm, label: e.target.value })
                  setHasUnsavedChanges(true) // W5 fix: Track changes
                }}
                placeholder="Enter step label"
              />
            </div>

            {/* Step Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step Type
              </label>
              <select
                value={editForm.type}
                onChange={(e) => {
                  setEditForm({ ...editForm, type: e.target.value as WorkflowStep['type'] })
                  setHasUnsavedChanges(true) // W5 fix: Track changes
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="trigger">Trigger</option>
                <option value="action">Action</option>
                <option value="decision">Decision</option>
                <option value="end">End</option>
              </select>
            </div>

            {/* Assigned To */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned To
                </label>
                <select
                  value={editForm.assignedToType}
                  onChange={(e) => {
                    setEditForm({ ...editForm, assignedToType: e.target.value as 'ai' | 'human' | '' })
                    setHasUnsavedChanges(true) // W5 fix: Track changes
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not assigned</option>
                  <option value="ai">AI Agent</option>
                  <option value="human">Human</option>
                </select>
              </div>
              {editForm.assignedToType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agent/Person Name
                  </label>
                  <Input
                    value={editForm.assignedToName}
                    onChange={(e) => {
                      setEditForm({ ...editForm, assignedToName: e.target.value })
                      setHasUnsavedChanges(true) // W5 fix: Track changes
                    }}
                    placeholder="Enter name"
                  />
                </div>
              )}
            </div>

            {/* Requirements Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requirements / Instructions
              </label>
              <textarea
                value={editForm.requirementsText}
                onChange={(e) => {
                  setEditForm({ ...editForm, requirementsText: e.target.value })
                  setHasUnsavedChanges(true) // W5 fix: Track changes
                }}
                placeholder="Describe what this step should do..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Blueprint: Green List */}
            <div>
              <label className="block text-sm font-medium text-green-700 mb-2">
                Green List (Allowed Actions)
              </label>
              <div className="space-y-2">
                {editForm.greenList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                    <span className="flex-1 text-sm">{item}</span>
                    <button
                      onClick={() => removeGreenItem(idx)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newGreenItem}
                    onChange={(e) => setNewGreenItem(e.target.value)}
                    placeholder="Add allowed action..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGreenItem())}
                  />
                  <Button variant="secondary" onClick={addGreenItem} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Blueprint: Red List */}
            <div>
              <label className="block text-sm font-medium text-red-700 mb-2">
                Red List (Forbidden Actions)
              </label>
              <div className="space-y-2">
                {editForm.redList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                    <span className="flex-1 text-sm">{item}</span>
                    <button
                      onClick={() => removeRedItem(idx)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newRedItem}
                    onChange={(e) => setNewRedItem(e.target.value)}
                    placeholder="Add forbidden action..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRedItem())}
                  />
                  <Button variant="secondary" onClick={addRedItem} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions - W8 fix: Use handleCancelEdit for unsaved changes check */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={handleCancelEdit}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveStep}
                isLoading={updateSteps.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
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

      {/* W8 fix: Discard Changes Confirmation Modal */}
      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Changes?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowDiscardConfirm(false)}
            >
              Keep Editing
            </Button>
            <Button
              variant="danger"
              onClick={confirmDiscard}
            >
              Discard Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
