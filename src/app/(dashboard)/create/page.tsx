'use client'

import { useState } from 'react'
import { ExternalLink, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui'
import WorkflowBuilder from '@/components/WorkflowBuilder'
import { N8nChatWidget } from '@/components/N8nChatWidget'
import { N8nEditorLink } from '@/components/N8nEditorLink'

type ChatMode = 'builder' | 'n8n'

export default function CreateTaskPage() {
  const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_CHAT_WEBHOOK_URL || ''
  const hasN8n = Boolean(n8nWebhookUrl)

  // Default to the new workflow builder
  const [chatMode, setChatMode] = useState<ChatMode>('builder')

  // Render n8n chat mode (legacy/alternative)
  if (chatMode === 'n8n') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Create a Task</h1>
              <p className="text-gray-600 mt-1">
                Describe your workflow using n8n chat interface
              </p>
            </div>
            <div className="flex items-center gap-3">
              <N8nEditorLink />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChatMode('builder')}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Use Visual Builder
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

  // Render new visual workflow builder (default)
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Create a Task</h1>
          <p className="text-sm text-gray-600">
            Describe your workflow and see it come to life
          </p>
        </div>
        <div className="flex items-center gap-3">
          <N8nEditorLink />
          {hasN8n && (
            <Button variant="ghost" size="sm" onClick={() => setChatMode('n8n')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Use n8n Chat
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Builder (Split Screen: Chat + Flowchart) */}
      <WorkflowBuilder className="flex-1 min-h-0" />
    </div>
  )
}
