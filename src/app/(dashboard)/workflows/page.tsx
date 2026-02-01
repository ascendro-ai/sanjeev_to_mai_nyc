'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkflows } from '@/hooks/useWorkflows'

export default function WorkflowsPage() {
  const router = useRouter()
  const { workflows, isLoading } = useWorkflows()

  useEffect(() => {
    // Only redirect to create page if no workflows exist
    // This prevents infinite redirect loop when using back button
    if (!isLoading && workflows.length === 0) {
      router.replace('/create')
    }
  }, [isLoading, workflows, router])

  // If loading, show spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  // If has workflows, show a simple list with link to create
  if (workflows.length > 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <button
            onClick={() => router.push('/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Workflow
          </button>
        </div>
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              onClick={() => router.push(`/workflows/${workflow.id}`)}
              className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">{workflow.name}</h3>
                  {workflow.description && (
                    <p className="text-sm text-gray-400 mt-1">{workflow.description}</p>
                  )}
                </div>
                <span className={`px-2 py-1 text-xs rounded ${
                  workflow.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  workflow.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {workflow.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {workflow.steps?.length || 0} steps
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Redirecting state
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}
