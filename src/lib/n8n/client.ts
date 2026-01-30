/**
 * n8n API Client
 *
 * Handles communication with the self-hosted n8n instance for workflow orchestration.
 * API Reference: https://docs.n8n.io/api/api-reference/
 */

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
const N8N_API_KEY = process.env.N8N_API_KEY || ''

interface N8NRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: Record<string, unknown>
}

async function n8nRequest<T>(options: N8NRequestOptions): Promise<T> {
  const { method, path, body } = options

  const response = await fetch(`${N8N_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`n8n API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface N8NNode {
  id: string
  name: string
  type: string
  position: [number, number]
  parameters: Record<string, unknown>
  credentials?: Record<string, { id: string; name: string }>
  typeVersion?: number
}

export interface N8NConnection {
  [sourceNode: string]: {
    [outputType: string]: Array<Array<{
      node: string
      type: string
      index: number
    }>>
  }
}

export interface N8NWorkflow {
  id?: string
  name: string
  nodes: N8NNode[]
  connections: N8NConnection
  active?: boolean
  settings?: {
    executionOrder?: string
    saveManualExecutions?: boolean
    callerPolicy?: string
    errorWorkflow?: string
  }
  staticData?: Record<string, unknown>
  tags?: Array<{ id: string; name: string }>
  createdAt?: string
  updatedAt?: string
}

export interface N8NExecution {
  id: string
  finished: boolean
  mode: string
  retryOf?: string
  retrySuccessId?: string
  startedAt: string
  stoppedAt?: string
  workflowId: string
  data?: {
    resultData?: {
      runData?: Record<string, unknown>
    }
  }
  status: 'running' | 'success' | 'failed' | 'waiting'
}

// ============================================================================
// WORKFLOW CRUD OPERATIONS
// ============================================================================

/**
 * Create a new workflow in n8n
 */
export async function createWorkflow(workflow: Omit<N8NWorkflow, 'id'>): Promise<N8NWorkflow> {
  return n8nRequest<N8NWorkflow>({
    method: 'POST',
    path: '/workflows',
    body: workflow as Record<string, unknown>,
  })
}

/**
 * Get a workflow by ID
 */
export async function getWorkflow(workflowId: string): Promise<N8NWorkflow> {
  return n8nRequest<N8NWorkflow>({
    method: 'GET',
    path: `/workflows/${workflowId}`,
  })
}

/**
 * Update an existing workflow
 */
export async function updateWorkflow(
  workflowId: string,
  workflow: Partial<N8NWorkflow>
): Promise<N8NWorkflow> {
  return n8nRequest<N8NWorkflow>({
    method: 'PATCH',
    path: `/workflows/${workflowId}`,
    body: workflow as Record<string, unknown>,
  })
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  await n8nRequest<void>({
    method: 'DELETE',
    path: `/workflows/${workflowId}`,
  })
}

/**
 * List all workflows
 */
export async function listWorkflows(): Promise<{ data: N8NWorkflow[] }> {
  return n8nRequest<{ data: N8NWorkflow[] }>({
    method: 'GET',
    path: '/workflows',
  })
}

// ============================================================================
// WORKFLOW ACTIVATION
// ============================================================================

/**
 * Activate a workflow (enable triggers)
 */
export async function activateWorkflow(workflowId: string): Promise<N8NWorkflow> {
  return n8nRequest<N8NWorkflow>({
    method: 'POST',
    path: `/workflows/${workflowId}/activate`,
  })
}

/**
 * Deactivate a workflow (disable triggers)
 */
export async function deactivateWorkflow(workflowId: string): Promise<N8NWorkflow> {
  return n8nRequest<N8NWorkflow>({
    method: 'POST',
    path: `/workflows/${workflowId}/deactivate`,
  })
}

// ============================================================================
// EXECUTION OPERATIONS
// ============================================================================

/**
 * Execute a workflow manually
 */
export async function executeWorkflow(
  workflowId: string,
  data?: Record<string, unknown>
): Promise<N8NExecution> {
  return n8nRequest<N8NExecution>({
    method: 'POST',
    path: `/workflows/${workflowId}/execute`,
    body: data ? { data } : undefined,
  })
}

/**
 * Get execution by ID
 */
export async function getExecution(executionId: string): Promise<N8NExecution> {
  return n8nRequest<N8NExecution>({
    method: 'GET',
    path: `/executions/${executionId}`,
  })
}

/**
 * List executions for a workflow
 */
export async function listExecutions(workflowId?: string): Promise<{ data: N8NExecution[] }> {
  const path = workflowId
    ? `/executions?workflowId=${workflowId}`
    : '/executions'
  return n8nRequest<{ data: N8NExecution[] }>({
    method: 'GET',
    path,
  })
}

/**
 * Stop a running execution
 */
export async function stopExecution(executionId: string): Promise<N8NExecution> {
  return n8nRequest<N8NExecution>({
    method: 'POST',
    path: `/executions/${executionId}/stop`,
  })
}

// ============================================================================
// WORKFLOW SCHEMA CONVERSION
// ============================================================================

import type { Workflow, WorkflowStep } from '@/types'

/**
 * Convert our platform's workflow schema to n8n workflow format
 */
export function convertToN8NWorkflow(
  workflow: Workflow,
  platformWebhookUrl: string
): Omit<N8NWorkflow, 'id'> {
  const nodes: N8NNode[] = []
  const connections: N8NConnection = {}

  let yPosition = 100

  // Process each step and create corresponding n8n nodes
  workflow.steps.forEach((step, index) => {
    const nodeId = `node_${index}`
    const xPosition = 100 + (index % 3) * 300

    // Alternate Y position for serpentine layout
    if (index > 0 && index % 3 === 0) {
      yPosition += 200
    }

    const node = createN8NNode(step, nodeId, [xPosition, yPosition], platformWebhookUrl, workflow.id)
    nodes.push(node)

    // Create connections (linear flow for now)
    if (index > 0) {
      const previousNodeId = `node_${index - 1}`
      const previousNodeName = nodes[index - 1].name

      if (!connections[previousNodeName]) {
        connections[previousNodeName] = { main: [] }
      }
      connections[previousNodeName].main.push([{
        node: node.name,
        type: 'main',
        index: 0,
      }])
    }
  })

  return {
    name: workflow.name,
    nodes,
    connections,
    active: false,
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
    },
  }
}

/**
 * Create an n8n node from a workflow step
 */
function createN8NNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  switch (step.type) {
    case 'trigger':
      return createTriggerNode(step, nodeId, position)

    case 'action':
      if (step.assignedTo?.type === 'human') {
        return createHumanReviewNode(step, nodeId, position, platformWebhookUrl, workflowId)
      }
      return createAIActionNode(step, nodeId, position, platformWebhookUrl, workflowId)

    case 'decision':
      return createDecisionNode(step, nodeId, position, platformWebhookUrl, workflowId)

    case 'end':
      return createEndNode(step, nodeId, position, platformWebhookUrl, workflowId)

    default:
      return createGenericNode(step, nodeId, position)
  }
}

function createTriggerNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number]
): N8NNode {
  // Default to manual trigger, can be extended for schedule/webhook triggers
  return {
    id: nodeId,
    name: step.label || 'Start',
    type: 'n8n-nodes-base.manualTrigger',
    position,
    parameters: {},
    typeVersion: 1,
  }
}

function createAIActionNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  // Use HTTP Request to call our platform's Gemini API
  const blueprint = step.requirements?.blueprint || { greenList: [], redList: [] }

  return {
    id: nodeId,
    name: step.label || 'AI Action',
    type: 'n8n-nodes-base.httpRequest',
    position,
    parameters: {
      method: 'POST',
      url: `${platformWebhookUrl}/api/n8n/ai-action`,
      sendBody: true,
      bodyParameters: {
        parameters: [
          { name: 'workflowId', value: workflowId },
          { name: 'stepId', value: step.id },
          { name: 'stepLabel', value: step.label },
          { name: 'blueprint', value: JSON.stringify(blueprint) },
          { name: 'input', value: '={{ JSON.stringify($json) }}' },
        ],
      },
      options: {
        response: { response: { responseFormat: 'json' } },
      },
    },
    typeVersion: 4.2,
  }
}

function createHumanReviewNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  // Use Wait node that pauses for human review via webhook callback
  return {
    id: nodeId,
    name: step.label || 'Human Review',
    type: 'n8n-nodes-base.httpRequest',
    position,
    parameters: {
      method: 'POST',
      url: `${platformWebhookUrl}/api/n8n/review-request`,
      sendBody: true,
      bodyParameters: {
        parameters: [
          { name: 'workflowId', value: workflowId },
          { name: 'stepId', value: step.id },
          { name: 'stepLabel', value: step.label },
          { name: 'reviewType', value: 'approval' },
          { name: 'data', value: '={{ JSON.stringify($json) }}' },
        ],
      },
      options: {
        response: { response: { responseFormat: 'json' } },
      },
    },
    typeVersion: 4.2,
  }
}

function createDecisionNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  // Decision nodes that require human review
  return {
    id: nodeId,
    name: step.label || 'Decision',
    type: 'n8n-nodes-base.httpRequest',
    position,
    parameters: {
      method: 'POST',
      url: `${platformWebhookUrl}/api/n8n/review-request`,
      sendBody: true,
      bodyParameters: {
        parameters: [
          { name: 'workflowId', value: workflowId },
          { name: 'stepId', value: step.id },
          { name: 'stepLabel', value: step.label },
          { name: 'reviewType', value: 'decision' },
          { name: 'data', value: '={{ JSON.stringify($json) }}' },
        ],
      },
      options: {
        response: { response: { responseFormat: 'json' } },
      },
    },
    typeVersion: 4.2,
  }
}

function createEndNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  // End node that reports completion back to platform
  return {
    id: nodeId,
    name: step.label || 'Complete',
    type: 'n8n-nodes-base.httpRequest',
    position,
    parameters: {
      method: 'POST',
      url: `${platformWebhookUrl}/api/n8n/execution-complete`,
      sendBody: true,
      bodyParameters: {
        parameters: [
          { name: 'workflowId', value: workflowId },
          { name: 'status', value: 'completed' },
          { name: 'result', value: '={{ JSON.stringify($json) }}' },
        ],
      },
    },
    typeVersion: 4.2,
  }
}

function createGenericNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number]
): N8NNode {
  return {
    id: nodeId,
    name: step.label || 'Step',
    type: 'n8n-nodes-base.noOp',
    position,
    parameters: {},
    typeVersion: 1,
  }
}

// ============================================================================
// WEBHOOK URL GENERATION
// ============================================================================

/**
 * Generate webhook URL for a workflow trigger
 */
export function getWorkflowWebhookUrl(workflowId: string): string {
  return `${N8N_API_URL.replace('/api/v1', '')}/webhook/${workflowId}`
}

/**
 * Generate test webhook URL for a workflow
 */
export function getWorkflowTestWebhookUrl(workflowId: string): string {
  return `${N8N_API_URL.replace('/api/v1', '')}/webhook-test/${workflowId}`
}

// ============================================================================
// UNIFIED CLIENT OBJECT
// ============================================================================

/**
 * Unified n8n client for use in API routes
 */
export const n8nClient = {
  // Workflow operations
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getWorkflows: async () => {
    const result = await listWorkflows()
    return result.data
  },
  listWorkflows,

  // Activation
  activateWorkflow,
  deactivateWorkflow,

  // Execution operations
  executeWorkflow,
  getExecution,
  listExecutions,
  stopExecution,

  // Utility
  convertToN8NWorkflow,
  getWorkflowWebhookUrl,
  getWorkflowTestWebhookUrl,
}
