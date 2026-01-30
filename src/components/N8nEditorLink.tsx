'use client'

import { ExternalLink, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui'

interface N8nEditorLinkProps {
  workflowId?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  showIcon?: boolean
}

export function N8nEditorLink({
  workflowId,
  className,
  variant = 'secondary',
  showIcon = true
}: N8nEditorLinkProps) {
  const n8nUrl = process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678'

  const handleClick = () => {
    const url = workflowId
      ? `${n8nUrl}/workflow/${workflowId}`
      : `${n8nUrl}/workflow/new`
    window.open(url, '_blank')
  }

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleClick}
    >
      {showIcon && (workflowId ? (
        <Edit3 className="h-4 w-4 mr-2" />
      ) : (
        <ExternalLink className="h-4 w-4 mr-2" />
      ))}
      {workflowId ? 'Edit in n8n' : 'Open n8n Editor'}
    </Button>
  )
}

interface N8nExecutionLinkProps {
  executionId: string
  className?: string
}

export function N8nExecutionLink({ executionId, className }: N8nExecutionLinkProps) {
  const n8nUrl = process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678'

  return (
    <a
      href={`${n8nUrl}/execution/${executionId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center text-sm text-blue-600 hover:text-blue-800 ${className}`}
    >
      <ExternalLink className="h-3 w-3 mr-1" />
      View in n8n
    </a>
  )
}
