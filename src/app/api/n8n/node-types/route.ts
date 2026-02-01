/**
 * n8n Node Types API
 * Returns the schema/parameters required for a given n8n node type
 */

import { NextRequest, NextResponse } from 'next/server'

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
const N8N_API_KEY = process.env.N8N_API_KEY || ''

// Map our step types to n8n node types
const STEP_TYPE_TO_N8N_NODE: Record<string, string[]> = {
  trigger: [
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.scheduleTrigger',
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.gmailTrigger',
  ],
  action: [
    'n8n-nodes-base.httpRequest',
    'n8n-nodes-base.gmail',
    'n8n-nodes-base.slack',
    'n8n-nodes-base.googleSheets',
    'n8n-nodes-base.airtable',
    'n8n-nodes-base.notion',
    'n8n-nodes-base.openAi',
  ],
  decision: [
    'n8n-nodes-base.if',
    'n8n-nodes-base.switch',
  ],
  end: [
    'n8n-nodes-base.httpRequest',
    'n8n-nodes-base.noOp',
  ],
  subworkflow: [
    'n8n-nodes-base.executeWorkflow',
  ],
}

// Common node parameters that we expose to users
interface NodeParameter {
  name: string
  displayName: string
  type: 'string' | 'number' | 'boolean' | 'options' | 'json' | 'collection'
  default?: unknown
  description?: string
  required?: boolean
  options?: Array<{ name: string; value: string }>
}

// Pre-defined node schemas for common nodes (faster than API call)
const NODE_SCHEMAS: Record<string, NodeParameter[]> = {
  'n8n-nodes-base.gmail': [
    { name: 'operation', displayName: 'Operation', type: 'options', required: true, options: [
      { name: 'Send Email', value: 'send' },
      { name: 'Reply to Email', value: 'reply' },
      { name: 'Create Draft', value: 'draft' },
    ]},
    { name: 'to', displayName: 'To', type: 'string', required: true, description: 'Recipient email address' },
    { name: 'subject', displayName: 'Subject', type: 'string', required: true },
    { name: 'message', displayName: 'Message', type: 'string', required: true, description: 'Email body content' },
    { name: 'ccEmail', displayName: 'CC', type: 'string', description: 'CC recipients (comma-separated)' },
    { name: 'bccEmail', displayName: 'BCC', type: 'string', description: 'BCC recipients (comma-separated)' },
  ],
  'n8n-nodes-base.slack': [
    { name: 'operation', displayName: 'Operation', type: 'options', required: true, options: [
      { name: 'Send Message', value: 'post' },
      { name: 'Update Message', value: 'update' },
      { name: 'Get Channel', value: 'get' },
    ]},
    { name: 'channel', displayName: 'Channel', type: 'string', required: true, description: 'Channel ID or name' },
    { name: 'text', displayName: 'Message', type: 'string', required: true },
    { name: 'asUser', displayName: 'Send as User', type: 'boolean', default: false },
  ],
  'n8n-nodes-base.httpRequest': [
    { name: 'method', displayName: 'Method', type: 'options', required: true, options: [
      { name: 'GET', value: 'GET' },
      { name: 'POST', value: 'POST' },
      { name: 'PUT', value: 'PUT' },
      { name: 'PATCH', value: 'PATCH' },
      { name: 'DELETE', value: 'DELETE' },
    ]},
    { name: 'url', displayName: 'URL', type: 'string', required: true },
    { name: 'sendBody', displayName: 'Send Body', type: 'boolean', default: false },
    { name: 'bodyContentType', displayName: 'Body Type', type: 'options', options: [
      { name: 'JSON', value: 'json' },
      { name: 'Form Data', value: 'multipart-form-data' },
      { name: 'Form URL Encoded', value: 'form-urlencoded' },
      { name: 'Raw', value: 'raw' },
    ]},
    { name: 'body', displayName: 'Body', type: 'json', description: 'Request body (JSON)' },
    { name: 'authentication', displayName: 'Authentication', type: 'options', options: [
      { name: 'None', value: 'none' },
      { name: 'Basic Auth', value: 'basicAuth' },
      { name: 'Header Auth', value: 'headerAuth' },
      { name: 'OAuth2', value: 'oAuth2' },
    ]},
  ],
  'n8n-nodes-base.googleSheets': [
    { name: 'operation', displayName: 'Operation', type: 'options', required: true, options: [
      { name: 'Append Row', value: 'append' },
      { name: 'Read Rows', value: 'read' },
      { name: 'Update Row', value: 'update' },
      { name: 'Delete Row', value: 'delete' },
    ]},
    { name: 'documentId', displayName: 'Spreadsheet ID', type: 'string', required: true },
    { name: 'sheetName', displayName: 'Sheet Name', type: 'string', required: true },
    { name: 'range', displayName: 'Range', type: 'string', description: 'e.g., A1:D10' },
    { name: 'dataMode', displayName: 'Data Mode', type: 'options', options: [
      { name: 'Auto-Map', value: 'autoMap' },
      { name: 'Manual Mapping', value: 'manual' },
    ]},
  ],
  'n8n-nodes-base.scheduleTrigger': [
    { name: 'cronExpression', displayName: 'Cron Expression', type: 'string', required: true, description: 'e.g., 0 9 * * * (every day at 9am)' },
    { name: 'timezone', displayName: 'Timezone', type: 'string', default: 'America/New_York' },
  ],
  'n8n-nodes-base.webhook': [
    { name: 'path', displayName: 'Webhook Path', type: 'string', required: true },
    { name: 'httpMethod', displayName: 'HTTP Method', type: 'options', options: [
      { name: 'GET', value: 'GET' },
      { name: 'POST', value: 'POST' },
    ]},
    { name: 'responseMode', displayName: 'Response Mode', type: 'options', options: [
      { name: 'On Received', value: 'onReceived' },
      { name: 'Last Node', value: 'lastNode' },
    ]},
  ],
  'n8n-nodes-base.if': [
    { name: 'conditionType', displayName: 'Condition Type', type: 'options', options: [
      { name: 'String', value: 'string' },
      { name: 'Number', value: 'number' },
      { name: 'Boolean', value: 'boolean' },
    ]},
    { name: 'value1', displayName: 'Value 1', type: 'string', required: true, description: 'Left side of comparison (e.g., {{$json.status}})' },
    { name: 'operation', displayName: 'Operation', type: 'options', required: true, options: [
      { name: 'Equals', value: 'equal' },
      { name: 'Not Equals', value: 'notEqual' },
      { name: 'Contains', value: 'contains' },
      { name: 'Greater Than', value: 'larger' },
      { name: 'Less Than', value: 'smaller' },
    ]},
    { name: 'value2', displayName: 'Value 2', type: 'string', required: true, description: 'Right side of comparison' },
  ],
  'n8n-nodes-base.openAi': [
    { name: 'operation', displayName: 'Operation', type: 'options', required: true, options: [
      { name: 'Chat Completion', value: 'chat' },
      { name: 'Text Completion', value: 'complete' },
      { name: 'Edit', value: 'edit' },
    ]},
    { name: 'model', displayName: 'Model', type: 'options', options: [
      { name: 'GPT-4', value: 'gpt-4' },
      { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
    ]},
    { name: 'prompt', displayName: 'Prompt', type: 'string', required: true },
    { name: 'maxTokens', displayName: 'Max Tokens', type: 'number', default: 1000 },
    { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7 },
  ],
  'n8n-nodes-base.airtable': [
    { name: 'operation', displayName: 'Operation', type: 'options', required: true, options: [
      { name: 'Create Record', value: 'create' },
      { name: 'Get Record', value: 'get' },
      { name: 'List Records', value: 'list' },
      { name: 'Update Record', value: 'update' },
      { name: 'Delete Record', value: 'delete' },
    ]},
    { name: 'baseId', displayName: 'Base ID', type: 'string', required: true },
    { name: 'tableId', displayName: 'Table ID', type: 'string', required: true },
    { name: 'fields', displayName: 'Fields', type: 'json', description: 'Field values as JSON' },
  ],
  'n8n-nodes-base.notion': [
    { name: 'resource', displayName: 'Resource', type: 'options', required: true, options: [
      { name: 'Page', value: 'page' },
      { name: 'Database', value: 'database' },
      { name: 'Block', value: 'block' },
    ]},
    { name: 'operation', displayName: 'Operation', type: 'options', options: [
      { name: 'Create', value: 'create' },
      { name: 'Get', value: 'get' },
      { name: 'Update', value: 'update' },
    ]},
    { name: 'databaseId', displayName: 'Database ID', type: 'string' },
    { name: 'pageId', displayName: 'Page ID', type: 'string' },
    { name: 'title', displayName: 'Title', type: 'string' },
    { name: 'content', displayName: 'Content', type: 'string' },
  ],
  // Trigger nodes with no/minimal configuration
  'n8n-nodes-base.manualTrigger': [],
  'n8n-nodes-base.gmailTrigger': [
    { name: 'pollInterval', displayName: 'Poll Interval', type: 'options', options: [
      { name: 'Every Minute', value: 'everyMinute' },
      { name: 'Every 5 Minutes', value: 'every5Minutes' },
      { name: 'Every 15 Minutes', value: 'every15Minutes' },
    ]},
    { name: 'filters', displayName: 'Email Filter', type: 'string', description: 'Filter emails by sender, subject, etc.' },
  ],
  'n8n-nodes-base.switch': [
    { name: 'mode', displayName: 'Mode', type: 'options', required: true, options: [
      { name: 'Rules', value: 'rules' },
      { name: 'Expression', value: 'expression' },
    ]},
    { name: 'dataPropertyName', displayName: 'Property Name', type: 'string', required: true, description: 'The property to evaluate' },
  ],
  'n8n-nodes-base.executeWorkflow': [
    { name: 'workflowId', displayName: 'Workflow ID', type: 'string', required: true, description: 'ID of the sub-workflow to execute' },
    { name: 'mode', displayName: 'Mode', type: 'options', options: [
      { name: 'Once', value: 'once' },
      { name: 'Each Item', value: 'each' },
    ]},
  ],
  'n8n-nodes-base.noOp': [],
}

// Try to fetch node type info from live n8n instance
async function fetchFromN8n(nodeType: string): Promise<NodeParameter[] | null> {
  if (!N8N_API_KEY || !N8N_API_URL) return null

  try {
    // n8n API endpoint for node type info
    const response = await fetch(`${N8N_API_URL}/node-types/${encodeURIComponent(nodeType)}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
      // Short timeout to fallback to cached schemas
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) return null

    const data = await response.json()

    // Transform n8n's property format to our NodeParameter format
    if (data.properties && Array.isArray(data.properties)) {
      return data.properties
        .filter((prop: Record<string, unknown>) => !prop.name?.toString().startsWith('_'))
        .slice(0, 10) // Limit to most important parameters
        .map((prop: Record<string, unknown>) => ({
          name: prop.name as string,
          displayName: prop.displayName as string || prop.name as string,
          type: mapN8nType(prop.type as string),
          default: prop.default,
          description: prop.description as string,
          required: prop.required as boolean,
          options: (prop.options as Array<{ name: string; value: string }>) || undefined,
        }))
    }
    return null
  } catch {
    // n8n not available, use cached schemas
    return null
  }
}

function mapN8nType(n8nType: string): NodeParameter['type'] {
  switch (n8nType) {
    case 'string': return 'string'
    case 'number': return 'number'
    case 'boolean': return 'boolean'
    case 'options': return 'options'
    case 'json': return 'json'
    case 'collection': return 'collection'
    default: return 'string'
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const stepType = searchParams.get('stepType')
  const nodeType = searchParams.get('nodeType')
  const stepLabel = searchParams.get('stepLabel') || ''
  const fetchLive = searchParams.get('live') === 'true'

  try {
    // If specific node type requested
    if (nodeType) {
      // Try live n8n first if requested
      let parameters: NodeParameter[] | null = null
      if (fetchLive) {
        parameters = await fetchFromN8n(nodeType)
      }
      // Fallback to cached schema
      if (!parameters) {
        parameters = NODE_SCHEMAS[nodeType] || []
      }

      return NextResponse.json({
        nodeType,
        displayName: nodeType.split('.')[1]?.replace(/([A-Z])/g, ' $1').trim() || nodeType,
        parameters,
        source: parameters === NODE_SCHEMAS[nodeType] ? 'cached' : 'live',
      })
    }

    // Get available node types for this step type
    const availableNodes = stepType ? STEP_TYPE_TO_N8N_NODE[stepType] || [] : []

    // Infer best node type from step label
    let suggestedNode = availableNodes[0] || 'n8n-nodes-base.httpRequest'
    const labelLower = stepLabel.toLowerCase()

    if (labelLower.includes('email') || labelLower.includes('gmail') || labelLower.includes('mail')) {
      suggestedNode = 'n8n-nodes-base.gmail'
    } else if (labelLower.includes('slack') || labelLower.includes('message') || labelLower.includes('notify')) {
      suggestedNode = 'n8n-nodes-base.slack'
    } else if (labelLower.includes('sheet') || labelLower.includes('spreadsheet') || labelLower.includes('google')) {
      suggestedNode = 'n8n-nodes-base.googleSheets'
    } else if (labelLower.includes('airtable')) {
      suggestedNode = 'n8n-nodes-base.airtable'
    } else if (labelLower.includes('notion')) {
      suggestedNode = 'n8n-nodes-base.notion'
    } else if (labelLower.includes('api') || labelLower.includes('http') || labelLower.includes('request')) {
      suggestedNode = 'n8n-nodes-base.httpRequest'
    } else if (labelLower.includes('ai') || labelLower.includes('gpt') || labelLower.includes('openai')) {
      suggestedNode = 'n8n-nodes-base.openAi'
    } else if (labelLower.includes('schedule') || labelLower.includes('cron') || labelLower.includes('timer')) {
      suggestedNode = 'n8n-nodes-base.scheduleTrigger'
    } else if (labelLower.includes('webhook')) {
      suggestedNode = 'n8n-nodes-base.webhook'
    } else if (labelLower.includes('condition') || labelLower.includes('if') || labelLower.includes('check')) {
      suggestedNode = 'n8n-nodes-base.if'
    }

    // Get schema - try live if requested
    let schema: NodeParameter[] | null = null
    if (fetchLive) {
      schema = await fetchFromN8n(suggestedNode)
    }
    if (!schema) {
      schema = NODE_SCHEMAS[suggestedNode] || []
    }

    return NextResponse.json({
      stepType,
      stepLabel,
      suggestedNode,
      displayName: suggestedNode.split('.')[1]?.replace(/([A-Z])/g, ' $1').trim() || suggestedNode,
      parameters: schema,
      source: schema === NODE_SCHEMAS[suggestedNode] ? 'cached' : 'live',
      availableNodes: availableNodes.map(node => ({
        type: node,
        displayName: node.split('.')[1]?.replace(/([A-Z])/g, ' $1').trim() || node,
        hasSchema: !!NODE_SCHEMAS[node],
      })),
    })
  } catch (error) {
    console.error('Error fetching node types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch node type information' },
      { status: 500 }
    )
  }
}
