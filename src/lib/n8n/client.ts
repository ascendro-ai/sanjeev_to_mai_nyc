/**
 * n8n API Client
 *
 * Handles communication with the self-hosted n8n instance for workflow orchestration.
 * API Reference: https://docs.n8n.io/api/api-reference/
 */

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
const N8N_API_KEY = process.env.N8N_API_KEY || ''

// Retry configuration
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_INITIAL_DELAY_MS = 1000
const DEFAULT_MAX_DELAY_MS = 10000

interface N8NRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: Record<string, unknown>
  maxRetries?: number
  initialDelayMs?: number
}

/**
 * Error classification for retry decisions
 */
export interface N8NError extends Error {
  status?: number
  isTransient: boolean
  isRateLimited: boolean
  retryAfter?: number
}

/**
 * Check if an error is transient (should be retried)
 */
function isTransientError(status: number): boolean {
  // 5xx errors are typically transient
  // 429 (rate limit) is also transient
  // 408 (timeout) is transient
  return status >= 500 || status === 429 || status === 408
}

/**
 * Create an N8NError with proper classification
 */
function createN8NError(message: string, status?: number, retryAfter?: number): N8NError {
  const error = new Error(message) as N8NError
  error.status = status
  error.isTransient = status ? isTransientError(status) : false
  error.isRateLimited = status === 429
  error.retryAfter = retryAfter
  return error
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoff(attempt: number, initialDelay: number, maxDelay: number): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // Add up to 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Make an n8n API request with retry logic
 */
async function n8nRequest<T>(options: N8NRequestOptions): Promise<T> {
  const {
    method,
    path,
    body,
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  } = options

  let lastError: N8NError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${N8N_API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': N8N_API_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const errorText = await response.text()
        const retryAfter = response.headers.get('Retry-After')
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined

        const error = createN8NError(
          `n8n API error: ${response.status} - ${errorText}`,
          response.status,
          retryAfterMs
        )

        // If it's a transient error and we have retries left, retry
        if (error.isTransient && attempt < maxRetries) {
          lastError = error
          const delay = error.retryAfter || calculateBackoff(attempt, initialDelayMs, DEFAULT_MAX_DELAY_MS)
          console.warn(`n8n request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, {
            path,
            status: response.status,
          })
          await sleep(delay)
          continue
        }

        throw error
      }

      // Handle empty responses (e.g., 204 No Content from DELETE)
      const contentLength = response.headers.get('content-length')
      if (contentLength === '0' || response.status === 204) {
        return null
      }

      const text = await response.text()
      return text ? JSON.parse(text) : null
    } catch (error) {
      // Handle network errors (no response)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = createN8NError(`Network error connecting to n8n: ${error.message}`)
        networkError.isTransient = true

        if (attempt < maxRetries) {
          lastError = networkError
          const delay = calculateBackoff(attempt, initialDelayMs, DEFAULT_MAX_DELAY_MS)
          console.warn(`Network error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)
          await sleep(delay)
          continue
        }

        throw networkError
      }

      // Re-throw other errors
      throw error
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('n8n request failed after all retries')
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
 * Convert our platform's workflow schema to n8n workflow format.
 * Handles special cases like human review steps that require multiple n8n nodes.
 */
export function convertToN8NWorkflow(
  workflow: Workflow,
  platformWebhookUrl: string
): Omit<N8NWorkflow, 'id'> {
  const nodes: N8NNode[] = []
  const connections: N8NConnection = {}

  let xPosition = 100
  let yPosition = 100
  let lastNodeName: string | null = null

  // Process each step and create corresponding n8n nodes
  workflow.steps.forEach((step, index) => {
    const nodeId = `node_${index}`

    // Check if this is a human review step (requires Wait node pattern)
    const isHumanReview = step.type === 'action' && step.assignedTo?.type === 'human'

    if (isHumanReview) {
      // Human review creates multiple nodes: Request + Wait
      const reviewNodes = createHumanReviewNodes(
        step,
        nodeId,
        [xPosition, yPosition],
        platformWebhookUrl,
        workflow.id
      )

      // Add all review nodes
      reviewNodes.forEach((node, nodeIndex) => {
        nodes.push(node)

        // Connect to previous node
        if (nodeIndex === 0 && lastNodeName) {
          if (!connections[lastNodeName]) {
            connections[lastNodeName] = { main: [[]] }
          }
          connections[lastNodeName].main[0].push({
            node: node.name,
            type: 'main',
            index: 0,
          })
        }

        // Connect review nodes to each other (Request → Wait)
        if (nodeIndex > 0) {
          const prevReviewNode = reviewNodes[nodeIndex - 1]
          if (!connections[prevReviewNode.name]) {
            connections[prevReviewNode.name] = { main: [[]] }
          }
          connections[prevReviewNode.name].main[0].push({
            node: node.name,
            type: 'main',
            index: 0,
          })
        }
      })

      // Update last node reference to the Wait node (last in the review sequence)
      lastNodeName = reviewNodes[reviewNodes.length - 1].name
      xPosition += 500 // Extra space for multi-node step
    } else {
      // Single node for other step types
      const node = createN8NNode(step, nodeId, [xPosition, yPosition], platformWebhookUrl, workflow.id)
      nodes.push(node)

      // Connect to previous node
      if (lastNodeName) {
        if (!connections[lastNodeName]) {
          connections[lastNodeName] = { main: [[]] }
        }
        connections[lastNodeName].main[0].push({
          node: node.name,
          type: 'main',
          index: 0,
        })
      }

      lastNodeName = node.name
      xPosition += 300
    }

    // Move to next row after every 3 positions
    if ((index + 1) % 3 === 0) {
      xPosition = 100
      yPosition += 200
    }
  })

  return {
    name: workflow.name,
    nodes,
    connections,
    // Note: 'active' is read-only in n8n API - use activateWorkflow() separately
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
    },
  }
}

/**
 * Create an n8n node from a workflow step
 *
 * PRIORITY: If user has explicitly configured an n8n node type and parameters
 * via the StepConfigModal, use those. Otherwise fall back to automatic detection.
 */
function createN8NNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  // FIRST: Check if user has explicitly configured an n8n node type
  const userNodeType = step.requirements?.n8nNodeType
  const userConfig = step.requirements?.n8nConfig || {}

  if (userNodeType) {
    // User has configured a specific n8n node - use it directly
    return createUserConfiguredNode(step, nodeId, position, userNodeType, userConfig)
  }

  // FALLBACK: Use automatic node type detection based on step type
  switch (step.type) {
    case 'trigger':
      return createTriggerNode(step, nodeId, position, workflowId)

    case 'action':
      if (step.assignedTo?.type === 'human') {
        return createHumanReviewNode(step, nodeId, position, platformWebhookUrl, workflowId)
      }
      return createAIActionNode(step, nodeId, position, platformWebhookUrl, workflowId)

    case 'decision':
      return createDecisionNode(step, nodeId, position, platformWebhookUrl, workflowId)

    case 'end':
      return createEndNode(step, nodeId, position, platformWebhookUrl, workflowId)

    case 'subworkflow':
      return createSubWorkflowNode(step, nodeId, position)

    default:
      return createGenericNode(step, nodeId, position)
  }
}

/**
 * Create an n8n node using user-configured node type and parameters.
 * This is used when the user has explicitly selected a node type in StepConfigModal.
 */
function createUserConfiguredNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  nodeType: string,
  config: Record<string, unknown>
): N8NNode {
  // Map the user's config to n8n parameters format
  const parameters: Record<string, unknown> = {}

  // Transform config based on node type
  switch (nodeType) {
    case 'n8n-nodes-base.gmail':
      parameters.operation = config.operation || 'send'
      if (config.to) parameters.sendTo = config.to
      if (config.subject) parameters.subject = config.subject
      if (config.message) parameters.message = config.message
      if (config.ccEmail) parameters.ccEmail = config.ccEmail
      if (config.bccEmail) parameters.bccEmail = config.bccEmail
      break

    case 'n8n-nodes-base.slack':
      parameters.operation = config.operation || 'post'
      if (config.channel) parameters.channel = config.channel
      if (config.text) parameters.text = config.text
      if (config.asUser !== undefined) parameters.asUser = config.asUser
      break

    case 'n8n-nodes-base.httpRequest':
      parameters.method = config.method || 'GET'
      parameters.url = config.url || ''
      if (config.sendBody) {
        parameters.sendBody = true
        parameters.bodyParameters = {
          parameters: Object.entries(config.body || {}).map(([name, value]) => ({
            name,
            value,
          })),
        }
      }
      if (config.authentication && config.authentication !== 'none') {
        parameters.authentication = config.authentication
      }
      break

    case 'n8n-nodes-base.googleSheets':
      parameters.operation = config.operation || 'read'
      if (config.documentId) parameters.documentId = { value: config.documentId, mode: 'id' }
      if (config.sheetName) parameters.sheetName = { value: config.sheetName, mode: 'name' }
      if (config.range) parameters.range = config.range
      break

    case 'n8n-nodes-base.scheduleTrigger':
      parameters.rule = {
        interval: [{
          field: 'cronExpression',
          expression: config.cronExpression || '0 9 * * *',
        }],
      }
      break

    case 'n8n-nodes-base.webhook':
      parameters.path = config.path || step.id
      parameters.httpMethod = config.httpMethod || 'POST'
      parameters.responseMode = config.responseMode || 'onReceived'
      break

    case 'n8n-nodes-base.if':
      parameters.conditions = {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{
          id: crypto.randomUUID(),
          leftValue: config.value1 || '',
          rightValue: config.value2 || '',
          operator: mapIfOperator(config.operation as string, config.conditionType as string),
        }],
        combinator: 'and',
      }
      break

    case 'n8n-nodes-base.openAi':
      parameters.operation = config.operation || 'chat'
      parameters.model = config.model || 'gpt-4'
      if (config.prompt) parameters.prompt = config.prompt
      if (config.maxTokens) parameters.maxTokens = config.maxTokens
      if (config.temperature) parameters.temperature = config.temperature
      break

    case 'n8n-nodes-base.airtable':
      parameters.operation = config.operation || 'list'
      if (config.baseId) parameters.base = { value: config.baseId, mode: 'id' }
      if (config.tableId) parameters.table = { value: config.tableId, mode: 'id' }
      if (config.fields) parameters.fields = config.fields
      break

    case 'n8n-nodes-base.notion':
      parameters.resource = config.resource || 'page'
      parameters.operation = config.operation || 'get'
      if (config.databaseId) parameters.databaseId = config.databaseId
      if (config.pageId) parameters.pageId = config.pageId
      if (config.title) parameters.title = config.title
      if (config.content) parameters.content = config.content
      break

    default:
      // For unknown node types, pass config as-is
      Object.assign(parameters, config)
  }

  return {
    id: nodeId,
    name: step.label || nodeType.split('.')[1] || 'Step',
    type: nodeType,
    position,
    parameters,
    typeVersion: getNodeTypeVersion(nodeType),
  }
}

/**
 * Map IF node operator from our format to n8n format
 */
function mapIfOperator(operation: string, conditionType: string = 'string'): { type: string; operation: string } {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
  }

  const opMap: Record<string, string> = {
    equal: 'equals',
    notEqual: 'notEquals',
    contains: 'contains',
    larger: 'gt',
    smaller: 'lt',
  }

  return {
    type: typeMap[conditionType] || 'string',
    operation: opMap[operation] || operation || 'equals',
  }
}

/**
 * Get the appropriate typeVersion for common n8n nodes
 */
function getNodeTypeVersion(nodeType: string): number {
  const versionMap: Record<string, number> = {
    'n8n-nodes-base.gmail': 2,
    'n8n-nodes-base.slack': 2,
    'n8n-nodes-base.httpRequest': 4.2,
    'n8n-nodes-base.googleSheets': 4,
    'n8n-nodes-base.scheduleTrigger': 1.2,
    'n8n-nodes-base.webhook': 2,
    'n8n-nodes-base.if': 2,
    'n8n-nodes-base.openAi': 1,
    'n8n-nodes-base.airtable': 2,
    'n8n-nodes-base.notion': 2,
    'n8n-nodes-base.manualTrigger': 1,
    'n8n-nodes-base.noOp': 1,
  }
  return versionMap[nodeType] || 1
}

/**
 * Create a sub-workflow execution node
 * Allows calling another workflow as a reusable component
 */
function createSubWorkflowNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number]
): N8NNode {
  const subWorkflowId = step.requirements?.subWorkflowId
  const params = step.requirements?.subWorkflowParams || {}

  if (!subWorkflowId) {
    // If no sub-workflow configured, create a placeholder NoOp node
    return {
      id: nodeId,
      name: step.label || 'Sub-Workflow (Not Configured)',
      type: 'n8n-nodes-base.noOp',
      position,
      parameters: {},
      typeVersion: 1,
    }
  }

  return {
    id: nodeId,
    name: step.label || 'Execute Sub-Workflow',
    type: 'n8n-nodes-base.executeWorkflow',
    position,
    parameters: {
      source: 'database',
      workflowId: subWorkflowId,
      mode: 'once',
      options: {
        waitForSubWorkflow: true,
      },
      // Pass parameters to the sub-workflow
      ...(Object.keys(params).length > 0 && {
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: Object.entries(params).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: value.startsWith('={{') ? value : `={{ $json.${value} }}`,
          }), {}),
        },
      }),
    },
    typeVersion: 1.1,
  }
}

function createTriggerNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  workflowId?: string
): N8NNode {
  const triggerType = step.requirements?.triggerType || 'manual'
  const triggerConfig = step.requirements?.triggerConfig || {}

  switch (triggerType) {
    case 'schedule':
      return createScheduleTrigger(step, nodeId, position, triggerConfig.schedule)

    case 'webhook':
      return createWebhookTrigger(step, nodeId, position, triggerConfig.webhookPath, workflowId)

    case 'email':
      return createEmailTrigger(step, nodeId, position, triggerConfig.emailFilter)

    case 'manual':
    default:
      return {
        id: nodeId,
        name: step.label || 'Start',
        type: 'n8n-nodes-base.manualTrigger',
        position,
        parameters: {},
        typeVersion: 1,
      }
  }
}

/**
 * Create a schedule (cron) trigger node
 */
function createScheduleTrigger(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  cronExpression?: string
): N8NNode {
  // Parse cron expression or use defaults
  // Default: Every day at 9 AM
  const cron = cronExpression || '0 9 * * *'
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.split(' ')

  return {
    id: nodeId,
    name: step.label || 'Schedule Trigger',
    type: 'n8n-nodes-base.scheduleTrigger',
    position,
    parameters: {
      rule: {
        interval: [
          {
            field: 'cronExpression',
            expression: cron,
          },
        ],
      },
    },
    typeVersion: 1.2,
  }
}

/**
 * Create a webhook trigger node
 */
function createWebhookTrigger(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  webhookPath?: string,
  workflowId?: string
): N8NNode {
  return {
    id: nodeId,
    name: step.label || 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    position,
    parameters: {
      path: webhookPath || workflowId || crypto.randomUUID(),
      httpMethod: 'POST',
      responseMode: 'onReceived',
      responseData: 'allEntries',
      options: {},
    },
    typeVersion: 2,
  }
}

/**
 * Create an email trigger node (using Gmail)
 */
function createEmailTrigger(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  emailFilter?: string
): N8NNode {
  return {
    id: nodeId,
    name: step.label || 'Email Trigger',
    type: 'n8n-nodes-base.gmailTrigger',
    position,
    parameters: {
      pollTimes: {
        item: [
          {
            mode: 'everyMinute',
          },
        ],
      },
      filters: {
        readStatus: 'unread',
        ...(emailFilter && {
          sender: emailFilter,
        }),
      },
      options: {
        downloadAttachments: false,
      },
    },
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

/**
 * Create nodes for human review step.
 * Returns an array of nodes: [HTTP Request to create review, Wait for approval]
 * This is a special case that generates multiple n8n nodes for a single platform step.
 */
function createHumanReviewNodes(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode[] {
  const requestNodeId = `${nodeId}_request`
  const waitNodeId = `${nodeId}_wait`

  // Node 1: HTTP Request to create review request in platform
  const requestNode: N8NNode = {
    id: requestNodeId,
    name: `${step.label || 'Human Review'} - Request`,
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
          { name: 'workerName', value: step.assignedTo?.agentName || 'Human Reviewer' },
          { name: 'executionId', value: '={{ $execution.id }}' },
          { name: 'data', value: '={{ JSON.stringify($json) }}' },
        ],
      },
      options: {
        response: { response: { responseFormat: 'json' } },
      },
    },
    typeVersion: 4.2,
  }

  // Node 2: Wait node that pauses until webhook callback
  const waitNode: N8NNode = {
    id: waitNodeId,
    name: `${step.label || 'Human Review'} - Wait`,
    type: 'n8n-nodes-base.wait',
    position: [position[0] + 200, position[1]],
    parameters: {
      resume: 'webhook',
      options: {
        webhookSuffix: `review-${step.id}`,
      },
    },
    typeVersion: 1.1,
  }

  return [requestNode, waitNode]
}

// Legacy single-node version for backward compatibility (deprecated)
function createHumanReviewNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  // Use HTTP Request to call our platform's review-request endpoint
  // Note: This doesn't pause the workflow. Use createHumanReviewNodes for proper Wait pattern.
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

/**
 * Create decision nodes with conditional branching (IF node).
 * Supports multiple condition types and routing.
 */
function createDecisionNodes(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode[] {
  const nodes: N8NNode[] = []
  const conditions = step.requirements?.conditions || []

  // If this decision requires AI evaluation first, add an AI action node
  if (step.requirements?.useAIForDecision) {
    const aiNodeId = `${nodeId}_ai`
    nodes.push({
      id: aiNodeId,
      name: `${step.label || 'Decision'} - AI Evaluate`,
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
            { name: 'stepLabel', value: `Evaluate: ${step.label}` },
            { name: 'blueprint', value: JSON.stringify(step.requirements?.blueprint || { greenList: [], redList: [] }) },
            { name: 'input', value: '={{ JSON.stringify($json) }}' },
            { name: 'returnDecision', value: 'true' },
          ],
        },
        options: {
          response: { response: { responseFormat: 'json' } },
        },
      },
      typeVersion: 4.2,
    })
  }

  // Create the IF node for conditional routing
  const ifNodeId = `${nodeId}_if`
  const ifNode: N8NNode = {
    id: ifNodeId,
    name: step.label || 'Decision',
    type: 'n8n-nodes-base.if',
    position: [position[0] + (step.requirements?.useAIForDecision ? 300 : 0), position[1]],
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
        },
        conditions: conditions.length > 0
          ? conditions.map((condition) => ({
              id: condition.id || crypto.randomUUID(),
              leftValue: condition.leftValue || '={{ $json.result }}',
              rightValue: condition.rightValue || 'true',
              operator: mapConditionOperator(condition.operator || 'equals'),
            }))
          : [
              {
                id: crypto.randomUUID(),
                leftValue: '={{ $json.success }}',
                rightValue: 'true',
                operator: { type: 'boolean', operation: 'equals' },
              },
            ],
        combinator: 'and',
      },
    },
    typeVersion: 2,
  }
  nodes.push(ifNode)

  return nodes
}

/**
 * Map condition operators to n8n IF node format
 */
function mapConditionOperator(operator: string): { type: string; operation: string } {
  const operatorMap: Record<string, { type: string; operation: string }> = {
    equals: { type: 'string', operation: 'equals' },
    notEquals: { type: 'string', operation: 'notEquals' },
    contains: { type: 'string', operation: 'contains' },
    notContains: { type: 'string', operation: 'notContains' },
    startsWith: { type: 'string', operation: 'startsWith' },
    endsWith: { type: 'string', operation: 'endsWith' },
    greaterThan: { type: 'number', operation: 'gt' },
    lessThan: { type: 'number', operation: 'lt' },
    greaterThanOrEqual: { type: 'number', operation: 'gte' },
    lessThanOrEqual: { type: 'number', operation: 'lte' },
    isEmpty: { type: 'string', operation: 'empty' },
    isNotEmpty: { type: 'string', operation: 'notEmpty' },
    isTrue: { type: 'boolean', operation: 'true' },
    isFalse: { type: 'boolean', operation: 'false' },
  }

  return operatorMap[operator] || { type: 'string', operation: 'equals' }
}

// Legacy single-node decision function for backward compatibility
function createDecisionNode(
  step: WorkflowStep,
  nodeId: string,
  position: [number, number],
  platformWebhookUrl: string,
  workflowId: string
): N8NNode {
  // Simple decision node - uses HTTP request to evaluate decision
  // For more complex decisions, use createDecisionNodes
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
