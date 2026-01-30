'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Plus, Mail, Paperclip } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import {
  NightlySecurityIcon,
  SpoilageDetectionIcon,
  FinancialAutopilotIcon,
  SalesResponseIcon,
} from '@/components/ui/ExampleIcons'
import { cn } from '@/lib/utils'
import type { ConversationMessage } from '@/types'

interface ExampleWorkflow {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  prompt: string
}

const EXAMPLE_WORKFLOWS: ExampleWorkflow[] = [
  {
    id: 'nightly-security',
    name: 'Nightly Security Check',
    description: 'Automated security scans and reports',
    icon: <NightlySecurityIcon />,
    prompt:
      'I want to set up a nightly security check that scans our systems for vulnerabilities and sends me a summary report each morning.',
  },
  {
    id: 'spoilage-detection',
    name: 'Spoilage Detection',
    description: 'Monitor inventory for potential spoilage',
    icon: <SpoilageDetectionIcon />,
    prompt:
      'Help me create a workflow that monitors our inventory levels and alerts me when products are approaching their expiration date.',
  },
  {
    id: 'financial-autopilot',
    name: 'Financial Autopilot',
    description: 'Automated financial tracking and reports',
    icon: <FinancialAutopilotIcon />,
    prompt:
      "I need a workflow that tracks our daily expenses, categorizes transactions, and generates a weekly financial summary for the team.",
  },
  {
    id: 'sales-response',
    name: 'Sales Response',
    description: 'Quick response to sales inquiries',
    icon: <SalesResponseIcon />,
    prompt:
      'Create a workflow that automatically responds to incoming sales inquiries with relevant information and schedules follow-up tasks.',
  },
]

interface ChatPanelProps {
  messages: ConversationMessage[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
  showExamples?: boolean
  gmailConnected?: boolean
  onConnectGmail?: () => void
  onFileUpload?: (files: FileList) => void
  className?: string
}

export default function ChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  showExamples = true,
  gmailConnected = false,
  onConnectGmail,
  onFileUpload,
  className = '',
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleExampleClick = (example: ExampleWorkflow) => {
    setInput(example.prompt)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileUpload) {
      onFileUpload(e.target.files)
    }
    setShowMenu(false)
  }

  const showExampleCards = showExamples && messages.length <= 1

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                'max-w-[85%] rounded-lg px-4 py-3',
                message.sender === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p className="whitespace-pre-wrap text-sm">{message.text}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex space-x-1">
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Example workflow cards */}
        {showExampleCards && (
          <div className="pt-4">
            <p className="text-sm text-gray-500 mb-3">Or try one of these examples:</p>
            <div className="grid grid-cols-2 gap-3">
              {EXAMPLE_WORKFLOWS.map((example) => (
                <Card
                  key={example.id}
                  variant="outlined"
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExampleClick(example)}
                >
                  <div className="flex items-start gap-3 p-1">
                    {example.icon}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {example.name}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {example.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200">
        {/* Gmail connection button */}
        {onConnectGmail && !gmailConnected && (
          <div className="mb-3">
            <button
              onClick={onConnectGmail}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span>Connect Gmail to enable email workflows</span>
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* Plus menu for attachments */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>

            {showMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px] z-10">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Attach file
                </button>
                {onConnectGmail && !gmailConnected && (
                  <button
                    onClick={() => {
                      onConnectGmail()
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Connect Gmail
                  </button>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              multiple
            />
          </div>

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your workflow..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            disabled={isLoading}
          />

          {/* Send button */}
          <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
