'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, X, Plus, Upload, Mail, Bot } from 'lucide-react'
import { Button, Card, Input, Modal } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { WorkflowStep, ConversationMessage } from '@/types'

interface RequirementsGatheringModalProps {
  isOpen: boolean
  onClose: () => void
  step: WorkflowStep
  workflowId: string
  workflowName?: string
  stepIndex?: number
  onSave: (requirements: WorkflowStep['requirements']) => void
}

export default function RequirementsGatheringModal({
  isOpen,
  onClose,
  step,
  workflowId,
  workflowName,
  stepIndex,
  onSave,
}: RequirementsGatheringModalProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [blueprint, setBlueprint] = useState<{
    greenList: string[]
    redList: string[]
    outstandingQuestions?: string[]
  }>({
    greenList: [],
    redList: [],
    outstandingQuestions: [],
  })
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  // Load existing requirements when modal opens
  useEffect(() => {
    if (isOpen && step.requirements) {
      setBlueprint(
        step.requirements.blueprint || {
          greenList: [],
          redList: [],
          outstandingQuestions: [],
        }
      )
      if (step.requirements.chatHistory) {
        setMessages(step.requirements.chatHistory)
      }
    }
  }, [isOpen, step])

  // Send initial message when modal opens (if no existing chat)
  useEffect(() => {
    if (isOpen && messages.length === 0 && !step.requirements?.chatHistory?.length) {
      const initialMessage: ConversationMessage = {
        sender: 'system',
        text: `I'll help you configure the requirements for "${step.label}". What should this step accomplish? What actions should it take, and what should it never do?`,
        timestamp: new Date(),
      }
      setMessages([initialMessage])
    }
  }, [isOpen, step.label, messages.length, step.requirements?.chatHistory])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(event.target as Node)
      ) {
        setShowPlusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ConversationMessage = {
      sender: 'user',
      text: inputValue.trim(),
      timestamp: new Date(),
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      // Call requirements API to get AI response and extract blueprint
      const response = await fetch('/api/gemini/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          messages: newMessages,
          workflowId,
        }),
      })

      if (!response.ok) throw new Error('Failed to get requirements response')

      const data = await response.json()

      // Update blueprint
      if (data.blueprint) {
        setBlueprint(data.blueprint)
      }

      // Add AI response to chat
      const systemMessage: ConversationMessage = {
        sender: 'system',
        text: data.response || 'I understand. Is there anything else you need for this step?',
        timestamp: new Date(),
      }

      setMessages([...newMessages, systemMessage])
    } catch (error) {
      console.error('Error getting requirements:', error)
      const errorMessage: ConversationMessage = {
        sender: 'system',
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages([...newMessages, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMarkComplete = () => {
    const requirements: WorkflowStep['requirements'] = {
      isComplete: true,
      requirementsText: blueprint.greenList.join('; '),
      chatHistory: messages,
      integrations: step.requirements?.integrations,
      blueprint,
    }
    onSave(requirements)
    onClose()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles([...uploadedFiles, ...files])
    setShowPlusMenu(false)
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white w-full h-full max-w-6xl max-h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div>
            {workflowName && stepIndex !== undefined && (
              <div className="text-xs text-gray-500 mb-1">
                {workflowName} • Step {stepIndex + 1}
              </div>
            )}
            <h1 className="text-lg font-semibold text-gray-900">{step.label}</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Chat Interface */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <Bot className="h-8 w-8 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-500">
                    Start configuring your automation below
                  </p>
                </div>
              ) : (
                <>
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
                          'max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap',
                          message.sender === 'user'
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-purple-50 text-purple-900'
                        )}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-1 px-4 py-2">
                        <div
                          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white">
              {/* File Upload Chips */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700"
                    >
                      <span>{file.name}</span>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Plus Button */}
                <div className="relative" ref={plusMenuRef}>
                  <button
                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Plus className="h-5 w-5 text-gray-500" />
                  </button>
                  {showPlusMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-48">
                      <button
                        onClick={() => {
                          document.getElementById('req-file-upload')?.click()
                          setShowPlusMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload File
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                        onClick={() => setShowPlusMenu(false)}
                      >
                        <Mail className="h-4 w-4" />
                        Connect Gmail
                      </button>
                    </div>
                  )}
                  <input
                    id="req-file-upload"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {/* Text Input */}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Instruct agent builder..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Blueprint Panel */}
          <div className="w-96 bg-gray-50 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                BLUEPRINT
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Actions Section (Green List) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </h3>
                </div>
                {blueprint.greenList.length > 0 ? (
                  <div className="space-y-2">
                    {blueprint.greenList.map((action, idx) => (
                      <Card
                        key={idx}
                        variant="outlined"
                        className="p-3 bg-green-50 border-green-200"
                      >
                        <p className="text-sm text-green-900">{action}</p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No actions defined yet...
                  </p>
                )}
              </div>

              {/* Hard Limits Section (Red List) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Hard Limits
                  </h3>
                </div>
                {blueprint.redList.length > 0 ? (
                  <div className="space-y-2">
                    {blueprint.redList.map((limit, idx) => (
                      <Card
                        key={idx}
                        variant="outlined"
                        className="p-3 bg-red-50 border-red-200"
                      >
                        <p className="text-sm text-red-900">{limit}</p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No hard limits defined yet...
                  </p>
                )}
              </div>

              {/* Outstanding Questions Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Outstanding Questions
                  </h3>
                </div>
                {blueprint.outstandingQuestions &&
                blueprint.outstandingQuestions.length > 0 ? (
                  <div className="space-y-2">
                    {blueprint.outstandingQuestions.map((question, idx) => (
                      <Card
                        key={idx}
                        variant="outlined"
                        className="p-3 bg-yellow-50 border-yellow-200"
                      >
                        <p className="text-sm text-yellow-900">{question}</p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No outstanding questions...
                  </p>
                )}
              </div>
            </div>

            {/* Complete Button */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <Button
                onClick={handleMarkComplete}
                disabled={blueprint.greenList.length === 0}
                className="w-full"
              >
                Mark Requirements Complete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
