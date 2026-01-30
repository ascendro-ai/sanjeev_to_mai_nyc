'use client'

import { useEffect, useRef } from 'react'

interface N8nChatWidgetProps {
  webhookUrl: string
  onWorkflowCreated?: (workflowId: string) => void
}

export function N8nChatWidget({ webhookUrl, onWorkflowCreated }: N8nChatWidgetProps) {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || !webhookUrl) return
    initialized.current = true

    // Dynamically import to avoid SSR issues
    const loadChat = async () => {
      try {
        // Load styles via link tag
        const linkId = 'n8n-chat-styles'
        if (!document.getElementById(linkId)) {
          const link = document.createElement('link')
          link.id = linkId
          link.rel = 'stylesheet'
          link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css'
          document.head.appendChild(link)
        }

        // Import and create chat
        const { createChat } = await import('@n8n/chat')

        createChat({
          webhookUrl,
          mode: 'fullscreen',
          showWelcomeScreen: true,
          initialMessages: [
            'Welcome! I can help you create automated workflows.',
            'Describe what you want to automate and I\'ll help you build it.'
          ],
          i18n: {
            en: {
              title: 'Create a Workflow',
              subtitle: 'Describe what you want to automate',
              inputPlaceholder: 'e.g., Send me a daily summary of my emails...',
              getStarted: 'Get Started',
              closeButtonTooltip: 'Close chat',
              footer: '',
            }
          },
          metadata: {
            source: 'enterprise-agent-platform'
          }
        })
      } catch (error) {
        console.error('Failed to load n8n chat:', error)
      }
    }

    loadChat()
  }, [webhookUrl, onWorkflowCreated])

  if (!webhookUrl) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="mb-2">n8n Chat not configured</p>
          <p className="text-sm">Set NEXT_PUBLIC_N8N_CHAT_WEBHOOK_URL in your environment</p>
        </div>
      </div>
    )
  }

  return <div id="n8n-chat" className="h-full w-full" />
}
