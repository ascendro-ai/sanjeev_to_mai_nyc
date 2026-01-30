'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Wand2, ExternalLink } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { consultWorkflow, extractWorkflowFromConversation } from '@/lib/gemini/client'
import { useWorkflows } from '@/hooks/useWorkflows'
import { useConversations } from '@/hooks/useConversations'
import { N8nChatWidget } from '@/components/N8nChatWidget'
import { N8nEditorLink } from '@/components/N8nEditorLink'
import type { ConversationMessage, Workflow } from '@/types'

type ChatMode = 'n8n' | 'gemini'

export default function CreateTaskPage() {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [extractedWorkflow, setExtractedWorkflow] = useState<Workflow | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_CHAT_WEBHOOK_URL || ''
  const hasN8n = Boolean(n8nWebhookUrl)

  // Default to n8n if configured, otherwise use Gemini
  const [chatMode, setChatMode] = useState<ChatMode>(hasN8n ? 'n8n' : 'gemini')

  const { addWorkflow } = useWorkflows()
  const { createConversation, addMessage: addConversationMessage } = useConversations()

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initial greeting for Gemini mode
  useEffect(() => {
    if (chatMode === 'gemini' && messages.length === 0) {
      setMessages([
        {
          sender: 'system',
          text: "Hi! I'm here to help you automate your workflows. Tell me about a task or process you'd like to streamline. What's something that takes up too much of your time?",
          timestamp: new Date(),
        },
      ])
    }
  }, [messages.length, chatMode])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ConversationMessage = {
      sender: 'user',
      text: input.trim(),
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
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

      // Extract workflow in background after a few exchanges
      if (questionCount >= 1) {
        try {
          const workflow = await extractWorkflowFromConversation(
            [...updatedMessages, systemMessage],
            extractedWorkflow?.id
          )
          if (workflow) {
            setExtractedWorkflow(workflow)
          }
        } catch (err) {
          console.error('Background extraction failed:', err)
        }
      }
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
  }

  const handleSaveWorkflow = async () => {
    if (!extractedWorkflow) return

    try {
      // Save the workflow to the database
      await addWorkflow.mutateAsync({
        ...extractedWorkflow,
        organizationId: 'default', // TODO: Get from user context
      })

      // Reset the conversation
      setMessages([
        {
          sender: 'system',
          text: "Great! Your workflow has been saved. You can view and configure it in 'Your Workflows'. Would you like to create another workflow?",
          timestamp: new Date(),
        },
      ])
      setExtractedWorkflow(null)
      setQuestionCount(0)
      setIsComplete(false)
    } catch (error) {
      console.error('Error saving workflow:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Render n8n chat mode
  if (chatMode === 'n8n') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Create a Task</h1>
              <p className="text-gray-600 mt-1">
                Describe your workflow and I'll help you automate it
              </p>
            </div>
            <div className="flex items-center gap-3">
              <N8nEditorLink />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChatMode('gemini')
                  setMessages([])
                }}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Use Gemini Chat
              </Button>
            </div>
          </div>
        </div>

        {/* n8n Chat Widget */}
        <div className="flex-1 overflow-hidden">
          <N8nChatWidget webhookUrl={n8nWebhookUrl} />
        </div>
      </div>
    )
  }

  // Render Gemini chat mode (fallback or manual switch)
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Create a Task</h1>
            <p className="text-gray-600 mt-1">
              Describe your workflow and I'll help you automate it
            </p>
          </div>
          <div className="flex items-center gap-3">
            <N8nEditorLink />
            {hasN8n && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChatMode('n8n')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Use n8n Chat
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              'flex',
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[70%] rounded-lg px-4 py-3',
                message.sender === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              )}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Extracted Workflow Preview */}
      {extractedWorkflow && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <Card variant="outlined" className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">{extractedWorkflow.name}</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {extractedWorkflow.steps.length} steps
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{extractedWorkflow.description}</p>
            <div className="flex flex-wrap gap-2">
              {extractedWorkflow.steps.slice(0, 3).map((step, idx) => (
                <span
                  key={step.id}
                  className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                >
                  {idx + 1}. {step.label}
                </span>
              ))}
              {extractedWorkflow.steps.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{extractedWorkflow.steps.length - 3} more
                </span>
              )}
            </div>
          </Card>
          {isComplete && (
            <Button onClick={handleSaveWorkflow} isLoading={addWorkflow.isPending}>
              Save Workflow
            </Button>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
