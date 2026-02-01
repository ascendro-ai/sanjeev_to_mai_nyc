'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { extractWorkflowFromConversation } from '@/lib/gemini/client'
import type { ConversationMessage, Workflow } from '@/types'

interface UseWorkflowExtractionOptions {
  /** Debounce delay in milliseconds (default: 500ms) */
  debounceMs?: number
  /** Minimum messages before attempting extraction (default: 2) */
  minMessages?: number
  /** Enable/disable automatic extraction (default: true) */
  enabled?: boolean
}

interface UseWorkflowExtractionResult {
  /** The extracted workflow, if any */
  extractedWorkflow: Workflow | null
  /** Whether extraction is in progress */
  isExtracting: boolean
  /** Any error that occurred during extraction */
  error: Error | null
  /** Manually trigger extraction */
  triggerExtraction: () => Promise<void>
  /** Clear the extracted workflow */
  clearWorkflow: () => void
  /** Update the workflow with new data */
  updateWorkflow: (workflow: Workflow) => void
}

/**
 * Hook for extracting workflow structure from conversation messages.
 * Automatically extracts with debouncing when messages change.
 *
 * @param messages - The conversation messages to extract from
 * @param options - Configuration options
 * @returns Extraction state and controls
 */
export function useWorkflowExtraction(
  messages: ConversationMessage[],
  options: UseWorkflowExtractionOptions = {}
): UseWorkflowExtractionResult {
  const {
    debounceMs = 500,
    minMessages = 2,
    enabled = true,
  } = options

  const [extractedWorkflow, setExtractedWorkflow] = useState<Workflow | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Keep track of the current workflow ID for incremental updates
  const workflowIdRef = useRef<string | undefined>(undefined)

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Track last processed messages to avoid redundant extractions
  const lastProcessedRef = useRef<string>('')

  // Memoize user messages count to detect real changes
  const userMessageCount = useMemo(
    () => messages.filter((m) => m.sender === 'user').length,
    [messages]
  )

  // Create a stable hash of messages for comparison
  const messagesHash = useMemo(() => {
    return messages.map((m) => `${m.sender}:${m.text?.slice(0, 50)}`).join('|')
  }, [messages])

  // Core extraction function
  const performExtraction = useCallback(async () => {
    if (messages.length < minMessages) return
    if (messagesHash === lastProcessedRef.current) return

    setIsExtracting(true)
    setError(null)

    try {
      const workflow = await extractWorkflowFromConversation(
        messages,
        workflowIdRef.current
      )

      if (workflow) {
        setExtractedWorkflow(workflow)
        workflowIdRef.current = workflow.id
        lastProcessedRef.current = messagesHash
        setError(null) // WB7 fix: Clear error on success
      } else {
        // WB7 fix: Set error when extraction returns null (indicates API failure or invalid response)
        console.warn('Workflow extraction returned null - no valid workflow structure found')
        // Don't set error for null - this could be a partial conversation
        // Only clear workflow if we had something and now don't
      }
    } catch (err) {
      console.error('Workflow extraction failed:', err)
      setError(err instanceof Error ? err : new Error('Extraction failed'))
    } finally {
      setIsExtracting(false)
    }
  }, [messages, messagesHash, minMessages])

  // Debounced extraction effect
  useEffect(() => {
    if (!enabled) return
    if (userMessageCount < minMessages) return

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new debounced extraction
    debounceTimerRef.current = setTimeout(() => {
      performExtraction()
    }, debounceMs)

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [enabled, userMessageCount, minMessages, debounceMs, performExtraction])

  // Manual trigger function
  const triggerExtraction = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    await performExtraction()
  }, [performExtraction])

  // Clear function
  const clearWorkflow = useCallback(() => {
    setExtractedWorkflow(null)
    workflowIdRef.current = undefined
    lastProcessedRef.current = ''
    setError(null)
  }, [])

  // Update function for external modifications
  const updateWorkflow = useCallback((workflow: Workflow) => {
    setExtractedWorkflow(workflow)
    workflowIdRef.current = workflow.id
  }, [])

  return {
    extractedWorkflow,
    isExtracting,
    error,
    triggerExtraction,
    clearWorkflow,
    updateWorkflow,
  }
}

export default useWorkflowExtraction
