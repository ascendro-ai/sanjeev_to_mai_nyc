import { describe, it, expect, vi, beforeEach } from 'vitest'
import { server } from '../../../../vitest.setup'
import { http, HttpResponse } from 'msw'
import type { Workflow, WorkflowStep } from '@/types'

// We need to test the client functions directly, but they use fetch
// which is mocked by MSW. Let's import and test.

// Import the functions to test
import {
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  listWorkflows,
  activateWorkflow,
  deactivateWorkflow,
  executeWorkflow,
  getExecution,
  listExecutions,
  stopExecution,
  convertToN8NWorkflow,
  getWorkflowWebhookUrl,
  getWorkflowTestWebhookUrl,
  n8nClient,
} from '@/lib/n8n/client'

describe('n8n Client', () => {
  describe('Workflow CRUD Operations', () => {
    it('should create a workflow', async () => {
      const workflow = await createWorkflow({
        name: 'Test Workflow',
        nodes: [],
        connections: {},
      })

      expect(workflow).toBeDefined()
      expect(workflow.id).toBe('wf-new')
      expect(workflow.name).toBe('Test Workflow')
    })

    it('should get a workflow by ID', async () => {
      const workflow = await getWorkflow('wf-123')

      expect(workflow).toBeDefined()
      expect(workflow.id).toBe('wf-123')
      expect(workflow.name).toBe('Test Workflow')
    })

    it('should update a workflow', async () => {
      const workflow = await updateWorkflow('wf-123', {
        name: 'Updated Workflow',
      })

      expect(workflow).toBeDefined()
      expect(workflow.id).toBe('wf-123')
    })

    it('should delete a workflow', async () => {
      await expect(deleteWorkflow('wf-123')).resolves.not.toThrow()
    })

    it('should list workflows', async () => {
      const result = await listWorkflows()

      expect(result.data).toHaveLength(2)
      expect(result.data[0].name).toBe('Test Workflow')
    })
  })

  describe('Workflow Activation', () => {
    it('should activate a workflow', async () => {
      const workflow = await activateWorkflow('wf-123')

      expect(workflow.active).toBe(true)
    })

    it('should deactivate a workflow', async () => {
      const workflow = await deactivateWorkflow('wf-123')

      expect(workflow.active).toBe(false)
    })
  })

  describe('Execution Operations', () => {
    it('should execute a workflow', async () => {
      const execution = await executeWorkflow('wf-123')

      expect(execution).toBeDefined()
      expect(execution.id).toBe('exec-1')
      expect(execution.status).toBe('running')
    })

    it('should execute a workflow with data', async () => {
      const execution = await executeWorkflow('wf-123', { input: 'test' })

      expect(execution).toBeDefined()
      expect(execution.workflowId).toBe('wf-123')
    })

    it('should get an execution by ID', async () => {
      const execution = await getExecution('exec-123')

      expect(execution).toBeDefined()
      expect(execution.id).toBe('exec-123')
      expect(execution.status).toBe('success')
    })

    it('should list executions', async () => {
      const result = await listExecutions()

      expect(result.data).toHaveLength(2)
    })

    it('should list executions for a specific workflow', async () => {
      const result = await listExecutions('wf-123')

      expect(result.data).toBeDefined()
    })

    it('should stop an execution', async () => {
      const execution = await stopExecution('exec-123')

      expect(execution.finished).toBe(true)
    })
  })

  describe('Error Handling and Retry Logic', () => {
    it('should retry on transient errors', async () => {
      let attempts = 0

      server.use(
        http.get('http://localhost:5678/api/v1/workflows/retry-test', () => {
          attempts++
          if (attempts < 3) {
            return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 })
          }
          return HttpResponse.json({
            id: 'retry-test',
            name: 'Retry Test',
            nodes: [],
            connections: {},
          })
        })
      )

      const workflow = await getWorkflow('retry-test')
      expect(workflow.id).toBe('retry-test')
      expect(attempts).toBe(3)
    })

    it('should not retry on non-transient errors', async () => {
      server.use(
        http.get('http://localhost:5678/api/v1/workflows/not-found', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 })
        })
      )

      await expect(getWorkflow('not-found')).rejects.toThrow()
    })

    it('should respect rate limit retry-after header', async () => {
      let attempts = 0
      const startTime = Date.now()

      server.use(
        http.get('http://localhost:5678/api/v1/workflows/rate-limit', () => {
          attempts++
          if (attempts === 1) {
            return new HttpResponse(JSON.stringify({ error: 'Rate limited' }), {
              status: 429,
              headers: { 'Retry-After': '1' },
            })
          }
          return HttpResponse.json({
            id: 'rate-limit',
            name: 'Rate Limit Test',
            nodes: [],
            connections: {},
          })
        })
      )

      const workflow = await getWorkflow('rate-limit')
      expect(workflow.id).toBe('rate-limit')
      // Should have waited at least 1 second
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('Webhook URL Generation', () => {
    it('should generate webhook URL', () => {
      const url = getWorkflowWebhookUrl('wf-123')
      expect(url).toContain('/webhook/wf-123')
    })

    it('should generate test webhook URL', () => {
      const url = getWorkflowTestWebhookUrl('wf-123')
      expect(url).toContain('/webhook-test/wf-123')
    })
  })

  describe('Unified Client Object', () => {
    it('should expose all workflow methods', () => {
      expect(n8nClient.createWorkflow).toBeDefined()
      expect(n8nClient.getWorkflow).toBeDefined()
      expect(n8nClient.updateWorkflow).toBeDefined()
      expect(n8nClient.deleteWorkflow).toBeDefined()
      expect(n8nClient.listWorkflows).toBeDefined()
      expect(n8nClient.getWorkflows).toBeDefined()
    })

    it('should expose all execution methods', () => {
      expect(n8nClient.executeWorkflow).toBeDefined()
      expect(n8nClient.getExecution).toBeDefined()
      expect(n8nClient.listExecutions).toBeDefined()
      expect(n8nClient.stopExecution).toBeDefined()
    })

    it('should expose activation methods', () => {
      expect(n8nClient.activateWorkflow).toBeDefined()
      expect(n8nClient.deactivateWorkflow).toBeDefined()
    })

    it('should expose utility methods', () => {
      expect(n8nClient.convertToN8NWorkflow).toBeDefined()
      expect(n8nClient.getWorkflowWebhookUrl).toBeDefined()
      expect(n8nClient.getWorkflowTestWebhookUrl).toBeDefined()
    })
  })
})

describe('convertToN8NWorkflow', () => {
  const platformWebhookUrl = 'http://localhost:3000'

  function createMockWorkflow(steps: WorkflowStep[]): Workflow {
    return {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'Test description',
      steps,
      status: 'draft',
    }
  }

  describe('Basic Workflow Conversion', () => {
    it('should convert a simple workflow with trigger and action', () => {
      const workflow = createMockWorkflow([
        {
          id: 'step-1',
          label: 'Start',
          type: 'trigger',
          order: 0,
        },
        {
          id: 'step-2',
          label: 'AI Action',
          type: 'action',
          assignedTo: { type: 'ai', agentName: 'Test Agent' },
          order: 1,
          requirements: {
            isComplete: true,
            blueprint: {
              greenList: ['read_email', 'summarize'],
              redList: ['delete_email'],
            },
          },
        },
        {
          id: 'step-3',
          label: 'Complete',
          type: 'end',
          order: 2,
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)

      expect(n8nWorkflow.name).toBe('Test Workflow')
      expect(n8nWorkflow.nodes).toHaveLength(3)
      expect(n8nWorkflow.active).toBe(false)
    })

    it('should create correct node connections', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'Action',
          type: 'action',
          assignedTo: { type: 'ai' },
          order: 1,
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)

      // First node (trigger) should connect to second node (action)
      const triggerNode = n8nWorkflow.nodes[0]
      expect(n8nWorkflow.connections[triggerNode.name]).toBeDefined()
    })

    it('should set workflow settings correctly', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)

      expect(n8nWorkflow.settings).toBeDefined()
      expect(n8nWorkflow.settings?.executionOrder).toBe('v1')
      expect(n8nWorkflow.settings?.saveManualExecutions).toBe(true)
    })
  })

  describe('Trigger Node Generation', () => {
    it('should create manual trigger by default', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const triggerNode = n8nWorkflow.nodes[0]

      expect(triggerNode.type).toBe('n8n-nodes-base.manualTrigger')
    })

    it('should create schedule trigger with cron expression', () => {
      const workflow = createMockWorkflow([
        {
          id: 'step-1',
          label: 'Scheduled Start',
          type: 'trigger',
          order: 0,
          requirements: {
            isComplete: true,
            triggerType: 'schedule',
            triggerConfig: { schedule: '0 9 * * *' },
          },
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const triggerNode = n8nWorkflow.nodes[0]

      expect(triggerNode.type).toBe('n8n-nodes-base.scheduleTrigger')
      expect(triggerNode.parameters.rule).toBeDefined()
    })

    it('should create webhook trigger', () => {
      const workflow = createMockWorkflow([
        {
          id: 'step-1',
          label: 'Webhook Start',
          type: 'trigger',
          order: 0,
          requirements: {
            isComplete: true,
            triggerType: 'webhook',
            triggerConfig: { webhookPath: 'my-webhook' },
          },
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const triggerNode = n8nWorkflow.nodes[0]

      expect(triggerNode.type).toBe('n8n-nodes-base.webhook')
      expect(triggerNode.parameters.path).toBe('my-webhook')
    })

    it('should create email trigger', () => {
      const workflow = createMockWorkflow([
        {
          id: 'step-1',
          label: 'Email Start',
          type: 'trigger',
          order: 0,
          requirements: {
            isComplete: true,
            triggerType: 'email',
            triggerConfig: { emailFilter: 'support@example.com' },
          },
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const triggerNode = n8nWorkflow.nodes[0]

      expect(triggerNode.type).toBe('n8n-nodes-base.gmailTrigger')
    })
  })

  describe('Human Review Node Generation (Wait Pattern)', () => {
    it('should create request and wait nodes for human review', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'Human Review',
          type: 'action',
          assignedTo: { type: 'human', agentName: 'John Doe' },
          order: 1,
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)

      // Human review should create 2 nodes (Request + Wait)
      // Trigger (1) + Human Review Request (1) + Human Review Wait (1) = 3 nodes
      expect(n8nWorkflow.nodes.length).toBeGreaterThanOrEqual(2)

      // Find the wait node
      const waitNode = n8nWorkflow.nodes.find((n) => n.type === 'n8n-nodes-base.wait')
      expect(waitNode).toBeDefined()
      expect(waitNode?.parameters.resume).toBe('webhook')
    })

    it('should include step ID in webhook suffix', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-review',
          label: 'Review Step',
          type: 'action',
          assignedTo: { type: 'human' },
          order: 1,
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const waitNode = n8nWorkflow.nodes.find((n) => n.type === 'n8n-nodes-base.wait')

      const options = waitNode?.parameters.options as { webhookSuffix?: string } | undefined
      expect(options?.webhookSuffix).toContain('step-review')
    })
  })

  describe('AI Action Node Generation', () => {
    it('should create HTTP request node for AI action', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'AI Analyze',
          type: 'action',
          assignedTo: { type: 'ai', agentName: 'Analyst' },
          order: 1,
          requirements: {
            isComplete: true,
            blueprint: {
              greenList: ['analyze', 'summarize'],
              redList: ['delete'],
            },
          },
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const aiNode = n8nWorkflow.nodes[1]

      expect(aiNode.type).toBe('n8n-nodes-base.httpRequest')
      expect(aiNode.parameters.url).toContain('/api/n8n/ai-action')
    })

    it('should include blueprint in AI action request', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'AI Action',
          type: 'action',
          assignedTo: { type: 'ai' },
          order: 1,
          requirements: {
            isComplete: true,
            blueprint: {
              greenList: ['read', 'write'],
              redList: ['delete'],
            },
          },
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const aiNode = n8nWorkflow.nodes[1]

      // Check that blueprint is included in parameters
      const bodyParams = (aiNode.parameters as { bodyParameters?: { parameters?: Array<{ name: string }> } }).bodyParameters?.parameters
      const blueprintParam = bodyParams?.find(
        (p: { name: string }) => p.name === 'blueprint'
      )
      expect(blueprintParam).toBeDefined()
    })
  })

  describe('Sub-Workflow Node Generation', () => {
    it('should create execute workflow node for subworkflow', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'Run Sub-Workflow',
          type: 'subworkflow',
          order: 1,
          requirements: {
            isComplete: true,
            subWorkflowId: 'sub-wf-123',
          },
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const subWorkflowNode = n8nWorkflow.nodes[1]

      expect(subWorkflowNode.type).toBe('n8n-nodes-base.executeWorkflow')
      expect(subWorkflowNode.parameters.workflowId).toBe('sub-wf-123')
    })

    it('should create NoOp node when subworkflow not configured', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'Unconfigured Sub-Workflow',
          type: 'subworkflow',
          order: 1,
          requirements: { isComplete: false },
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const subWorkflowNode = n8nWorkflow.nodes[1]

      expect(subWorkflowNode.type).toBe('n8n-nodes-base.noOp')
    })
  })

  describe('Decision Node Generation', () => {
    it('should create decision node for decision step', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'Route Decision',
          type: 'decision',
          order: 1,
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const decisionNode = n8nWorkflow.nodes[1]

      expect(decisionNode.type).toBe('n8n-nodes-base.httpRequest')
      expect(decisionNode.parameters.url).toContain('/api/n8n/review-request')
    })
  })

  describe('End Node Generation', () => {
    it('should create completion node for end step', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'Complete',
          type: 'end',
          order: 1,
        },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)
      const endNode = n8nWorkflow.nodes[1]

      expect(endNode.type).toBe('n8n-nodes-base.httpRequest')
      expect(endNode.parameters.url).toContain('/api/n8n/execution-complete')
    })
  })

  describe('Node Positioning', () => {
    it('should position nodes in a grid layout', () => {
      const workflow = createMockWorkflow([
        { id: 'step-1', label: 'Step 1', type: 'trigger', order: 0 },
        { id: 'step-2', label: 'Step 2', type: 'action', assignedTo: { type: 'ai' }, order: 1 },
        { id: 'step-3', label: 'Step 3', type: 'action', assignedTo: { type: 'ai' }, order: 2 },
        { id: 'step-4', label: 'Step 4', type: 'end', order: 3 },
      ])

      const n8nWorkflow = convertToN8NWorkflow(workflow, platformWebhookUrl)

      // Check that positions are defined and reasonable
      n8nWorkflow.nodes.forEach((node) => {
        expect(node.position).toBeDefined()
        expect(node.position[0]).toBeGreaterThanOrEqual(0)
        expect(node.position[1]).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
