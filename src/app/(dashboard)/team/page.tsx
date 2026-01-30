'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  User,
  Bot,
  MoreVertical,
  Power,
  PowerOff,
  Trash2,
  AlertCircle,
  LayoutGrid,
  Network,
} from 'lucide-react'
import { Button, Card, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useTeam } from '@/hooks/useTeam'
import OrgChart from '@/components/OrgChart'
import type { DigitalWorker } from '@/types'

type ViewMode = 'chart' | 'grid'

export default function TeamPage() {
  const {
    workers,
    isLoading,
    error,
    addWorker,
    deleteWorker,
    activateWorker,
    deactivateWorker,
  } = useTeam()

  // Memoize workers array to prevent unnecessary re-renders
  const workersList = useMemo(() => workers || [], [workers])

  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerType, setNewWorkerType] = useState<'ai' | 'human'>('ai')
  const [newWorkerDescription, setNewWorkerDescription] = useState('')
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)

  const getStatusColor = (status: DigitalWorker['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700'
      case 'inactive':
        return 'bg-gray-100 text-gray-700'
      case 'paused':
        return 'bg-yellow-100 text-yellow-700'
      case 'error':
        return 'bg-red-100 text-red-700'
      case 'needs_attention':
        return 'bg-orange-100 text-orange-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const handleAddWorker = async () => {
    if (!newWorkerName.trim()) return

    await addWorker.mutateAsync({
      organizationId: 'default', // TODO: Get from user context
      name: newWorkerName,
      type: newWorkerType,
      description: newWorkerDescription || undefined,
      status: 'inactive',
    })

    setIsAddModalOpen(false)
    setNewWorkerName('')
    setNewWorkerDescription('')
  }

  const handleToggleStatus = async (worker: DigitalWorker) => {
    if (worker.status === 'active') {
      await deactivateWorker.mutateAsync(worker.id)
    } else {
      await activateWorker.mutateAsync(worker.id)
    }
  }

  const handleDelete = async (workerId: string) => {
    if (confirm('Are you sure you want to delete this worker?')) {
      await deleteWorker.mutateAsync(workerId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to load team
          </h2>
          <p className="text-gray-600 mb-4">
            {error instanceof Error
              ? error.message
              : 'An unexpected error occurred'}
          </p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your Team</h1>
          <p className="text-gray-600 mt-1">
            {viewMode === 'chart'
              ? 'Drag canvas to pan • Click workers to manage'
              : 'Manage your digital workers and team members'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('chart')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'chart'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              title="Org Chart View"
            >
              <Network className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Worker
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {workersList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              No workers yet
            </h2>
            <p className="text-gray-600 mb-4 max-w-sm">
              Add digital workers to automate your workflows
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              Add Your First Worker
            </Button>
          </div>
        ) : viewMode === 'chart' ? (
          <OrgChart className="w-full h-full" />
        ) : (
          <div className="p-6 overflow-y-auto h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workersList.map((worker) => (
                <Card
                  key={worker.id}
                  variant="outlined"
                  className="hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                        worker.type === 'ai' ? 'bg-blue-100' : 'bg-purple-100'
                      )}
                    >
                      {worker.type === 'ai' ? (
                        <Bot className={cn('h-5 w-5', 'text-blue-600')} />
                      ) : (
                        <User className={cn('h-5 w-5', 'text-purple-600')} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 truncate">
                          {worker.name}
                        </h3>
                        <div className="relative">
                          <button
                            onClick={() =>
                              setSelectedWorker(
                                selectedWorker === worker.id ? null : worker.id
                              )
                            }
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-500" />
                          </button>
                          {selectedWorker === worker.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                              <button
                                onClick={() => handleToggleStatus(worker)}
                                className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                              >
                                {worker.status === 'active' ? (
                                  <>
                                    <PowerOff className="h-4 w-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Power className="h-4 w-4" />
                                    Activate
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(worker.id)}
                                className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 capitalize">
                          {worker.type}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            getStatusColor(worker.status)
                          )}
                        >
                          {worker.status}
                        </span>
                      </div>

                      {worker.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {worker.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Worker Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Digital Worker"
      >
        <div className="space-y-4">
          <Input
            label="Worker Name"
            value={newWorkerName}
            onChange={(e) => setNewWorkerName(e.target.value)}
            placeholder="e.g., Email Handler"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Worker Type
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setNewWorkerType('ai')}
                className={cn(
                  'flex-1 p-4 rounded-lg border-2 transition-colors',
                  newWorkerType === 'ai'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <Bot className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <span className="block text-sm font-medium">AI Agent</span>
                <span className="block text-xs text-gray-500 mt-1">
                  Automated digital worker
                </span>
              </button>
              <button
                onClick={() => setNewWorkerType('human')}
                className={cn(
                  'flex-1 p-4 rounded-lg border-2 transition-colors',
                  newWorkerType === 'human'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <User className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <span className="block text-sm font-medium">Human</span>
                <span className="block text-xs text-gray-500 mt-1">
                  Team member
                </span>
              </button>
            </div>
          </div>

          <Input
            label="Description (optional)"
            value={newWorkerDescription}
            onChange={(e) => setNewWorkerDescription(e.target.value)}
            placeholder="What does this worker do?"
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddWorker}
              isLoading={addWorker.isPending}
              disabled={!newWorkerName.trim()}
            >
              Add Worker
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
