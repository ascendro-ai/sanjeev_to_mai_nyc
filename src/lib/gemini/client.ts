import type {
  ConversationMessage,
  Workflow,
  WorkflowStep,
  AgentConfiguration,
  NodeData,
} from '@/types'

/**
 * Client-side Gemini service.
 * All calls go through server API routes to keep the API key secure.
 */

/**
 * Workflow consultant chat - asks questions to understand the user's workflow needs.
 */
export async function consultWorkflow(
  messages: ConversationMessage[],
  questionCount: number
): Promise<{ response: string; isComplete: boolean }> {
  const response = await fetch('/api/gemini/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, questionCount }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get consultant response')
  }

  return response.json()
}

/**
 * Extract workflow from conversation.
 * Called in the background as the user chats with the consultant.
 */
export async function extractWorkflowFromConversation(
  messages: ConversationMessage[],
  existingWorkflowId?: string
): Promise<Workflow | null> {
  const response = await fetch('/api/gemini/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, existingWorkflowId }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('Failed to extract workflow:', error)
    return null
  }

  const data = await response.json()
  return data.workflow || null
}

/**
 * Get initial requirements gathering message for a step.
 */
export async function getInitialRequirementsMessage(
  step: WorkflowStep,
  workflowName?: string,
  createTaskConversation?: ConversationMessage[]
): Promise<string> {
  const response = await fetch('/api/gemini/requirements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'init',
      step,
      workflowName,
      createTaskConversation,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get initial message')
  }

  const data = await response.json()
  return data.message
}

/**
 * Conversational requirements gathering - responds to user messages.
 */
export async function gatherRequirementsConversation(
  step: WorkflowStep,
  messages: ConversationMessage[],
  createTaskConversation?: ConversationMessage[]
): Promise<string> {
  const response = await fetch('/api/gemini/requirements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'chat',
      step,
      messages,
      createTaskConversation,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to gather requirements')
  }

  const data = await response.json()
  return data.response
}

/**
 * Build automation requirements from conversation.
 */
export async function buildAutomation(
  step: WorkflowStep,
  messages: ConversationMessage[],
  createTaskConversation?: ConversationMessage[]
): Promise<{
  requirementsText: string
  blueprint: {
    greenList: string[]
    redList: string[]
    outstandingQuestions?: string[]
  }
  customRequirements: string[]
}> {
  const response = await fetch('/api/gemini/requirements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'build',
      step,
      messages,
      createTaskConversation,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to build automation')
  }

  const data = await response.json()
  return {
    requirementsText: data.requirementsText,
    blueprint: data.blueprint,
    customRequirements: data.customRequirements,
  }
}

/**
 * Build agents from workflow requirements.
 * Called when activating a digital worker.
 */
export async function buildAgentsFromWorkflowRequirements(
  workflow: Workflow,
  digitalWorkerName?: string
): Promise<AgentConfiguration[]> {
  const response = await fetch('/api/gemini/build-agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow, digitalWorkerName }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to build agents')
  }

  const data = await response.json()
  return data.agents
}

/**
 * Extract people/stakeholders from conversation.
 */
export async function extractPeopleFromConversation(
  messages: ConversationMessage[]
): Promise<NodeData[]> {
  const response = await fetch('/api/gemini/extract-people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('Failed to extract people:', error)
    return []
  }

  const data = await response.json()
  return data.people || []
}
