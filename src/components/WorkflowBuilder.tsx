'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui'
import ChatPanel from '@/components/ChatPanel'
import WorkflowFlowchart from '@/components/WorkflowFlowchart'
import { useWorkflowExtraction } from '@/hooks/useWorkflowExtraction'
import { useWorkflows } from '@/hooks/useWorkflows'
import { consultWorkflow } from '@/lib/gemini/client'
import type { ConversationMessage, WorkflowStep } from '@/types'

interface WorkflowBuilderProps {
  className?: string
}

export default function WorkflowBuilder({ className = '' }: WorkflowBuilderProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      sender: 'system',
      text: "Hi! I'm here to help you automate your workflows. Tell me about a task or process you'd like to streamline. What's something that takes up too much of your time?",
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>()

  const { addWorkflow } = useWorkflows()

  // Use the debounced workflow extraction hook
  const {
    extractedWorkflow,
    isExtracting,
    clearWorkflow,
    updateWorkflow,
  } = useWorkflowExtraction(messages, {
    debounceMs: 500,
    minMessages: 2,
    enabled: true,
  })

  const handleSendMessage = useCallback(
    async (text: string) => {
      const userMessage: ConversationMessage = {
        sender: 'user',
        text,
        timestamp: new Date(),
      }

      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setIsLoading(true)

      try {
        // Get consultant response
        const { response, isComplete: completed } = await consultWorkflow(
          updatedMessages,
          questionCount
        )

        const systemMessage: ConversationMessage = {
          sender: 'system',
          text: response,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, systemMessage])
        setQuestionCount((prev) => prev + 1)
        setIsComplete(completed)
      } catch (error) {
        console.error('Error getting consultant response:', error)
        setMessages((prev) => [
          ...prev,
          {
            sender: 'system',
            text: "I'm sorry, I encountered an error. Please try again.",
            timestamp: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [messages, questionCount]
  )

  const handleStepClick = useCallback((stepId: string) => {
    setSelectedStepId((prev) => (prev === stepId ? undefined : stepId))
  }, [])

  const handleSaveWorkflow = useCallback(async () => {
    if (!extractedWorkflow) return

    try {
      const result = await addWorkflow.mutateAsync({
        ...extractedWorkflow,
        organizationId: 'default', // TODO: Get from user context
      })

      // Navigate to the workflow detail page
      router.push(`/workflows/${result.id}`)
    } catch (error) {
      console.error('Error saving workflow:', error)
    }
  }, [extractedWorkflow, addWorkflow, router])

  const handleReset = useCallback(() => {
    setMessages([
      {
        sender: 'system',
        text: "Hi! I'm here to help you automate your workflows. Tell me about a task or process you'd like to streamline. What's something that takes up too much of your time?",
        timestamp: new Date(),
      },
    ])
    setQuestionCount(0)
    setIsComplete(false)
    setSelectedStepId(undefined)
    clearWorkflow()
  }, [clearWorkflow])

  // Get steps for flowchart
  const steps: WorkflowStep[] = extractedWorkflow?.steps || []

  return (
    <div className={`flex h-full ${className}`}>
      {/* Left Panel - Chat (1/3 width) */}
      <div className="w-1/3 min-w-[320px] max-w-[480px] border-r border-gray-200 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Design Your Workflow</h2>
              <p className="text-sm text-gray-500">
                {isExtracting ? 'Analyzing conversation...' : 'Describe what you want to automate'}
              </p>
            </div>
            {messages.length > 1 && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Start Over
              </Button>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          showExamples={messages.length <= 1}
          className="flex-1"
        />

        {/* Save Workflow Button */}
        {extractedWorkflow && isComplete && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <Button
              onClick={handleSaveWorkflow}
              isLoading={addWorkflow.isPending}
              className="w-full"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Save Workflow ({steps.length} steps)
            </Button>
          </div>
        )}
      </div>

      {/* Right Panel - Flowchart (2/3 width) */}
      <div className="flex-1 bg-gray-50 flex flex-col">
        {/* Flowchart Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {extractedWorkflow?.name || 'Workflow Preview'}
              </h2>
              <p className="text-sm text-gray-500">
                {steps.length > 0
                  ? `${steps.length} steps defined`
                  : 'Your workflow will appear here as you describe it'}
              </p>
            </div>
            {extractedWorkflow && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {isExtracting ? 'Updating...' : 'Auto-synced'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Flowchart */}
        <WorkflowFlowchart
          steps={steps}
          selectedStepId={selectedStepId}
          onStepClick={handleStepClick}
          className="flex-1"
        />
      </div>
    </div>
  )
}
