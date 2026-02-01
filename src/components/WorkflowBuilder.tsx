/**
 * @fileoverview Main workflow creation interface with AI-assisted design.
 *
 * WorkflowBuilder is the primary interface for creating and configuring workflows.
 * It combines a conversational AI assistant with a visual flowchart editor, enabling
 * users to describe their automation needs in plain English while seeing the workflow
 * structure built in real-time.
 *
 * Features:
 * - Chat interface for conversational workflow design with Gemini AI
 * - Real-time flowchart visualization as workflow is extracted
 * - Step configuration modal for n8n integration settings
 * - Validation system ensuring all steps are properly configured
 * - Workflow activation/deactivation with n8n sync
 * - Draft saving for work-in-progress workflows
 *
 * User Flow:
 * 1. User describes workflow in chat ("I want to send Slack messages when emails arrive")
 * 2. Gemini AI asks clarifying questions ("Which Slack channel?")
 * 3. useWorkflowExtraction hook extracts structured workflow from conversation
 * 4. WorkflowFlowchart renders visual preview of steps
 * 5. User clicks steps to configure n8n integration details
 * 6. User activates workflow when all steps are configured
 *
 * @module components/WorkflowBuilder
 *
 * @example
 * ```tsx
 * // In /workflows/new page
 * import WorkflowBuilder from '@/components/WorkflowBuilder'
 *
 * export default function NewWorkflowPage() {
 *   return (
 *     <div className="h-screen">
 *       <WorkflowBuilder className="h-full" />
 *     </div>
 *   )
 * }
 * ```
 */

'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Plus, Wand2, Paperclip, Play, Pause, Loader2, Bot, User, Save, AlertCircle, X } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import WorkflowFlowchart from '@/components/WorkflowFlowchart'
import StepConfigModal from '@/components/StepConfigModal'
import { useWorkflowExtraction } from '@/hooks/useWorkflowExtraction'
import { useWorkflows } from '@/hooks/useWorkflows'
import { useOrganization } from '@/hooks/useOrganization'
import { consultWorkflow } from '@/lib/gemini/client'
import { cn } from '@/lib/utils'
import type { ConversationMessage, WorkflowStep, Workflow } from '@/types'

// -----------------------------------------------------------------------------
// Node Type Validation Configuration
// -----------------------------------------------------------------------------

/**
 * Required parameters for each n8n node type.
 *
 * This configuration ensures that workflow steps have all necessary
 * parameters before the workflow can be activated. Each key is an n8n
 * node type identifier, and the value is an array of required parameter names.
 *
 * Must be kept in sync with /api/n8n/node-types/route.ts
 *
 * @example
 * ```typescript
 * // Gmail node requires: operation, to, subject, message
 * REQUIRED_PARAMS['n8n-nodes-base.gmail'] = ['operation', 'to', 'subject', 'message']
 * ```
 */
const REQUIRED_PARAMS: Record<string, string[]> = {
  // Action nodes
  'n8n-nodes-base.gmail': ['operation', 'to', 'subject', 'message'],
  'n8n-nodes-base.slack': ['operation', 'channel', 'text'],
  'n8n-nodes-base.httpRequest': ['method', 'url'],
  'n8n-nodes-base.googleSheets': ['operation', 'documentId', 'sheetName'],
  'n8n-nodes-base.openAi': ['operation', 'prompt'],
  'n8n-nodes-base.airtable': ['operation', 'baseId', 'tableId'],
  'n8n-nodes-base.notion': ['resource'],
  // Trigger nodes
  'n8n-nodes-base.scheduleTrigger': ['cronExpression'],
  'n8n-nodes-base.webhook': ['path'],
  'n8n-nodes-base.manualTrigger': [], // No required params
  'n8n-nodes-base.gmailTrigger': [], // Optional filters only
  // Decision/control nodes
  'n8n-nodes-base.if': ['value1', 'operation', 'value2'],
  'n8n-nodes-base.switch': ['mode', 'dataPropertyName'],
  // Sub-workflow
  'n8n-nodes-base.executeWorkflow': ['workflowId'],
  // Utility
  'n8n-nodes-base.noOp': [], // No required params
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Result of validating workflow steps before activation.
 */
interface ValidationResult {
  /** True if all steps have required configuration */
  isValid: boolean
  /** List of steps with missing configuration */
  missingSteps: Array<{
    /** Step identifier */
    stepId: string
    /** Human-readable step name */
    stepLabel: string
    /** Names of missing required fields */
    missingFields: string[]
  }>
}

/**
 * Props for the WorkflowBuilder component.
 */
interface WorkflowBuilderProps {
  /** Additional CSS classes */
  className?: string
}

// -----------------------------------------------------------------------------
// Validation Functions
// -----------------------------------------------------------------------------

/**
 * Validates that all workflow steps have required n8n configuration.
 *
 * Checks each step against REQUIRED_PARAMS to ensure:
 * 1. The step has an n8n node type selected
 * 2. All required parameters for that node type have values
 *
 * @param steps - Array of workflow steps to validate
 * @returns Validation result with isValid flag and details of missing fields
 *
 * @example
 * ```typescript
 * const result = validateWorkflowSteps(workflow.steps)
 *
 * if (!result.isValid) {
 *   console.log('Missing configuration:', result.missingSteps)
 * }
 * ```
 */
function validateWorkflowSteps(steps: WorkflowStep[]): ValidationResult {
  const missingSteps: ValidationResult['missingSteps'] = []

  for (const step of steps) {
    const nodeType = step.requirements?.n8nNodeType
    const config = step.requirements?.n8nConfig || {}

    // If no node type is configured, the step needs configuration
    if (!nodeType) {
      missingSteps.push({
        stepId: step.id,
        stepLabel: step.label,
        missingFields: ['Integration type not selected'],
      })
      continue
    }

    // Check required parameters for this node type
    const requiredParams = REQUIRED_PARAMS[nodeType] || []
    const missingFields: string[] = []

    for (const param of requiredParams) {
      const value = config[param]
      if (value === undefined || value === null || value === '') {
        missingFields.push(param)
      }
    }

    if (missingFields.length > 0) {
      missingSteps.push({
        stepId: step.id,
        stepLabel: step.label,
        missingFields,
      })
    }
  }

  return {
    isValid: missingSteps.length === 0,
    missingSteps,
  }
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * Main workflow creation and configuration interface.
 *
 * This component orchestrates the entire workflow creation experience,
 * combining AI-assisted design with manual configuration capabilities.
 *
 * State Management:
 * - `messages`: Chat history with Gemini AI
 * - `currentWorkflow`: Saved workflow (null if unsaved draft)
 * - `extractedWorkflow`: Latest extraction from conversation
 * - `selectedStepId`: Currently selected step for configuration
 *
 * Key Interactions:
 * - Chat input → consultWorkflow → messages update → useWorkflowExtraction
 * - Step click → StepConfigModal → handleStepConfigSave → updateSteps
 * - Activate click → validation check → /api/n8n/activate → status update
 *
 * @param props - Component props
 * @param props.className - Additional CSS classes
 *
 * @example
 * ```tsx
 * <WorkflowBuilder className="h-full" />
 * ```
 */
export default function WorkflowBuilder({ className = '' }: WorkflowBuilderProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>()
  const [input, setInput] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null)
  const [showStepConfig, setShowStepConfig] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  // WB9 fix: Removed unused fileInputRef - file upload not yet implemented
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasSavedDraft = useRef(false)

  // Get user's organization
  const { organizationId, isLoading: orgLoading } = useOrganization()

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const { addWorkflow, updateWorkflow, updateStatus, updateSteps } = useWorkflows()

  // Use the debounced workflow extraction hook
  const {
    extractedWorkflow,
    isExtracting,
    clearWorkflow,
  } = useWorkflowExtraction(messages, {
    debounceMs: 500,
    minMessages: 1,
    enabled: true,
  })

  // Save draft manually
  const handleSaveDraft = useCallback(async () => {
    if (!extractedWorkflow || extractedWorkflow.steps.length === 0) return

    try {
      if (currentWorkflow) {
        // Update existing draft
        await updateSteps.mutateAsync({
          workflowId: currentWorkflow.id,
          steps: extractedWorkflow.steps,
        })
      } else {
        // Create new draft
        if (!organizationId) {
          console.error('No organization found for user')
          return
        }
        const result = await addWorkflow.mutateAsync({
          name: extractedWorkflow.name || 'Untitled Workflow',
          description: extractedWorkflow.description,
          steps: extractedWorkflow.steps,
          status: 'draft',
          organizationId,
        })
        setCurrentWorkflow(result)
        hasSavedDraft.current = true
      }
    } catch (error) {
      console.error('Error saving draft:', error)
    }
  }, [extractedWorkflow, currentWorkflow, addWorkflow, updateSteps])

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
      setInput('')

      try {
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
    setSelectedStepId(stepId)
    setShowStepConfig(true)
  }, [])

  const handleStepConfigSave = useCallback(async (config: Record<string, unknown>) => {
    if (!currentWorkflow || !selectedStepId || !extractedWorkflow) return

    // Update the step requirements with n8n config
    const updatedSteps: WorkflowStep[] = extractedWorkflow.steps.map(step => {
      if (step.id === selectedStepId) {
        return {
          ...step,
          requirements: {
            ...(step.requirements || { isComplete: false }),
            n8nNodeType: config.n8nNodeType as string | undefined,
            n8nConfig: config.n8nConfig as Record<string, unknown> | undefined,
          },
        } as WorkflowStep
      }
      return step
    })

    try {
      await updateSteps.mutateAsync({
        workflowId: currentWorkflow.id,
        steps: updatedSteps,
      })
    } catch (error) {
      console.error('Error saving step config:', error)
    }
  }, [currentWorkflow, selectedStepId, extractedWorkflow, updateSteps])

  const [activationError, setActivationError] = useState<string | null>(null)

  const handleActivateToggle = useCallback(async () => {
    if (!currentWorkflow) return

    setIsActivating(true)
    setActivationError(null)

    try {
      const action = currentWorkflow.status === 'active' ? 'deactivate' : 'activate'

      // Call the n8n activation API
      const response = await fetch('/api/n8n/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: currentWorkflow.id,
          action,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to toggle workflow status')
      }

      // Update local state with the returned workflow
      if (data.workflow) {
        setCurrentWorkflow(data.workflow)
      }

      // Invalidate queries to refetch workflow list
      // Note: The mutation will handle this, but we can also do it here for immediate effect
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error toggling workflow status:', errorMessage)
      setActivationError(errorMessage)
    } finally {
      setIsActivating(false)
    }
  }, [currentWorkflow])

  const handleSaveWorkflow = useCallback(async () => {
    if (!extractedWorkflow || !organizationId) return

    try {
      const result = await addWorkflow.mutateAsync({
        ...extractedWorkflow,
        organizationId,
      })

      router.push(`/workflows/${result.id}`)
    } catch (error) {
      console.error('Error saving workflow:', error)
    }
  }, [extractedWorkflow, addWorkflow, router, organizationId])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    handleSendMessage(input.trim())
  }

  // Get steps for flowchart
  const steps: WorkflowStep[] = extractedWorkflow?.steps || []

  // Validate workflow steps
  const validation = useMemo(() => validateWorkflowSteps(steps), [steps])
  const [showValidationTooltip, setShowValidationTooltip] = useState(false)

  // Check if we can activate (need saved workflow and valid steps)
  const canActivate = currentWorkflow && currentWorkflow.status !== 'active' && validation.isValid

  return (
    <div className={`flex flex-col h-full bg-[#0d0d0d] ${className}`}>
      {/* Main Canvas Area - Flowchart */}
      <div className="flex-1 relative min-h-0">
        <WorkflowFlowchart
          steps={steps}
          selectedStepId={selectedStepId}
          onStepClick={handleStepClick}
          className="h-full"
        />

        {/* Top controls bar - overlaid on flowchart */}
        {(isExtracting || steps.length > 0) && (
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-4">
            {/* Status indicator - left */}
            <div className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                {currentWorkflow && (
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    currentWorkflow.status === 'active' ? 'bg-green-500' :
                    currentWorkflow.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-500'
                  )} />
                )}
                {!currentWorkflow && steps.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
                <p className="text-sm text-gray-300">
                  {isExtracting ? 'Building workflow...' :
                   currentWorkflow ? `${currentWorkflow.name} · ${steps.length} steps` :
                   extractedWorkflow?.name || `${steps.length} steps (unsaved)`}
                </p>
              </div>
              {currentWorkflow && (
                <p className="text-xs text-gray-500 mt-0.5 capitalize">
                  {currentWorkflow.status}
                </p>
              )}
              {!currentWorkflow && steps.length > 0 && (
                <p className="text-xs text-blue-400 mt-0.5">
                  Not saved yet
                </p>
              )}
            </div>

            {/* Action buttons - right */}
            <div className="flex items-center gap-2">
              {/* Save Draft button - shown when unsaved */}
              {!currentWorkflow && steps.length > 0 && (
                <button
                  onClick={handleSaveDraft}
                  disabled={addWorkflow.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#2a2a2a] border border-[#3a3a3a] text-gray-300 hover:bg-[#3a3a3a] transition-all disabled:opacity-50"
                >
                  {addWorkflow.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Draft
                </button>
              )}

              {/* Activate/Pause button - shown when saved */}
              {currentWorkflow && (
                <div className="relative">
                  <button
                    onClick={currentWorkflow.status === 'active' ? handleActivateToggle : (canActivate ? handleActivateToggle : undefined)}
                    onMouseEnter={() => !canActivate && currentWorkflow.status !== 'active' && setShowValidationTooltip(true)}
                    onMouseLeave={() => setShowValidationTooltip(false)}
                    disabled={isActivating || (currentWorkflow.status !== 'active' && !canActivate)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      currentWorkflow.status === 'active'
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : canActivate
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 text-gray-300 cursor-not-allowed',
                      isActivating && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isActivating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : currentWorkflow.status === 'active' ? (
                      <Pause className="h-4 w-4" />
                    ) : !canActivate ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {currentWorkflow.status === 'active' ? 'Pause' : 'Activate'}
                  </button>

                  {/* Validation tooltip */}
                  {showValidationTooltip && !validation.isValid && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl z-30 p-3">
                      <div className="flex items-center gap-2 text-yellow-400 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Configuration Required</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        Complete all required fields before activating:
                      </p>
                      <ul className="space-y-1.5">
                        {validation.missingSteps.map((item) => (
                          <li key={item.stepId} className="text-xs">
                            <button
                              onClick={() => {
                                setSelectedStepId(item.stepId)
                                setShowStepConfig(true)
                                setShowValidationTooltip(false)
                              }}
                              className="w-full text-left p-2 rounded bg-[#1a1a1a] hover:bg-[#333] transition-colors"
                            >
                              <span className="text-gray-200 font-medium">{item.stepLabel}</span>
                              <span className="block text-gray-500 mt-0.5">
                                Missing: {item.missingFields.join(', ')}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Activation error tooltip */}
                  {activationError && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-red-900/90 border border-red-700 rounded-lg shadow-xl z-30 p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-red-200">Activation Failed</span>
                          <p className="text-xs text-red-300 mt-1">{activationError}</p>
                        </div>
                        <button
                          onClick={() => setActivationError(null)}
                          className="text-red-400 hover:text-red-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Chat Panel */}
      <div className="bg-[#1a1a1a] border-t border-[#2a2a2a]">
        {/* Collapsible Messages Area */}
        {messages.length > 0 && (
          <div className="max-h-40 overflow-y-auto border-b border-[#2a2a2a]">
            <div className="flex flex-col">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'px-6 py-3',
                    message.sender === 'user' ? 'bg-[#1a1a1a]' : 'bg-[#222]'
                  )}
                >
                  <div className="flex gap-3 max-w-3xl mx-auto">
                    <div className={cn(
                      'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                      message.sender === 'user' ? 'bg-blue-600' : 'bg-[#3a3a3a]'
                    )}>
                      {message.sender === 'user' ? (
                        <User className="w-3 h-3 text-white" />
                      ) : (
                        <Bot className="w-3 h-3 text-gray-300" />
                      )}
                    </div>
                    <p className="text-sm text-gray-200 flex-1">
                      {message.text}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="px-6 py-3 bg-[#222]">
                  <div className="flex gap-3 max-w-3xl mx-auto">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3a3a3a] flex items-center justify-center">
                      <Bot className="w-3 h-3 text-gray-300" />
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] px-4 py-3">
              {/* Attachment button */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#3a3a3a] rounded-lg transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </button>

                {/* WB9 fix: File upload disabled - not yet implemented */}
                {showMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg shadow-lg py-1 min-w-[150px] z-10">
                    <button
                      disabled
                      className="w-full px-4 py-2 text-sm text-left text-gray-500 cursor-not-allowed flex items-center gap-2"
                      title="File attachments coming soon"
                    >
                      <Paperclip className="h-4 w-4" />
                      Attach file
                      <span className="text-xs text-gray-600 ml-auto">(Soon)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Text input */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Describe your workflow..."
                className="flex-1 px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none bg-transparent resize-none min-h-[24px] max-h-[120px]"
                disabled={isLoading}
                rows={1}
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'p-2 rounded-lg transition-colors flex-shrink-0',
                  input.trim() && !isLoading
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-[#3a3a3a] text-gray-500 cursor-not-allowed'
                )}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step Configuration Modal (WB2 fix: safe step lookup) */}
      {selectedStepId && (() => {
        const selectedStep = steps.find(s => s.id === selectedStepId)
        if (!selectedStep) return null
        return (
          <StepConfigModal
            step={selectedStep}
            isOpen={showStepConfig}
            onClose={() => {
              setShowStepConfig(false)
              setSelectedStepId(undefined)
            }}
            onSave={handleStepConfigSave}
          />
        )
      })()}
    </div>
  )
}
