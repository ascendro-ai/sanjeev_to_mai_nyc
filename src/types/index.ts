// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface Workflow {
  id: string
  name: string
  description?: string
  steps: WorkflowStep[]
  assignedTo?: {
    stakeholderName: string
    stakeholderType: 'ai' | 'human'
  }
  status: 'draft' | 'active' | 'paused' | 'archived'
  n8nWorkflowId?: string // ID of the workflow in n8n
  organizationId?: string
  createdBy?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface WorkflowStep {
  id: string
  label: string
  type: 'trigger' | 'action' | 'decision' | 'end' | 'subworkflow'
  assignedTo?: {
    type: 'ai' | 'human'
    agentName?: string
  }
  order: number
  requirements?: StepRequirements
}

export interface StepRequirements {
  isComplete: boolean
  requirementsText?: string
  chatHistory?: Array<{ sender: 'user' | 'system'; text: string }>
  integrations?: {
    gmail?: boolean
  }
  customRequirements?: string[]
  blueprint?: {
    greenList: string[]
    redList: string[]
    outstandingQuestions?: string[]
  }
  // Trigger configuration
  triggerType?: 'manual' | 'schedule' | 'webhook' | 'email'
  triggerConfig?: {
    schedule?: string // Cron expression
    webhookPath?: string
    emailFilter?: string
  }
  // Decision/conditional branching configuration
  conditions?: Array<{
    id?: string
    leftValue: string
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'isEmpty' | 'isNotEmpty' | 'isTrue' | 'isFalse'
    rightValue: string
  }>
  useAIForDecision?: boolean
  // Sub-workflow configuration
  subWorkflowId?: string
  subWorkflowParams?: Record<string, string>
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

export interface AgentConfiguration {
  id: string
  name: string
  stepId: string
  workflowId: string
  blueprint: {
    greenList: string[]
    redList: string[]
  }
  integrations: {
    gmail?: {
      authenticated: boolean
      account?: string
    }
  }
  status: 'configured' | 'active' | 'paused'
  createdAt: Date
}

// ============================================================================
// DIGITAL WORKER / TEAM TYPES
// ============================================================================

export interface DigitalWorker {
  id: string
  organizationId: string
  teamId?: string
  managerId?: string
  name: string
  type: 'ai' | 'human'
  role?: string
  description?: string
  avatarUrl?: string
  status: 'active' | 'inactive' | 'paused' | 'error' | 'needs_attention'
  assignedWorkflows?: string[]
  personality?: {
    tone: string
    verbosity: string
  }
  metadata?: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}

// Legacy NodeData for org chart compatibility
export interface NodeData {
  name: string
  type: 'ai' | 'human'
  role?: string
  status?: 'active' | 'inactive' | 'needs_attention'
  assignedWorkflows?: string[]
  children?: NodeData[]
}

// ============================================================================
// ORGANIZATION & TEAM TYPES
// ============================================================================

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl?: string
  settings?: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}

export interface Team {
  id: string
  organizationId: string
  parentTeamId?: string
  name: string
  description?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  createdAt?: Date
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export interface ConversationMessage {
  sender: 'user' | 'system'
  text: string
  timestamp?: Date
}

export interface ConversationSession {
  id: string
  organizationId?: string
  messages: ConversationMessage[]
  workflowId?: string
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

export interface Execution {
  id: string
  workflowId: string
  workerId?: string
  n8nExecutionId?: string
  status: 'pending' | 'running' | 'waiting_review' | 'completed' | 'failed' | 'cancelled'
  currentStepIndex: number
  triggerType: string
  triggerData?: Record<string, unknown>
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  error?: string
  startedAt?: Date
  completedAt?: Date
  createdAt?: Date
}

export interface ExecutionStep {
  id: string
  executionId: string
  stepIndex: number
  stepName: string
  stepType: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  error?: string
  startedAt?: Date
  completedAt?: Date
  createdAt?: Date
}

// ============================================================================
// REVIEW TYPES
// ============================================================================

export interface ReviewRequest {
  id: string
  executionId: string
  stepId: string
  stepIndex: number
  assignedTo?: string
  workerName?: string
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'expired'
  reviewType: 'approval' | 'input_needed' | 'edit_review' | 'decision'
  reviewData: Record<string, unknown>
  reviewerId?: string
  reviewedAt?: Date
  feedback?: string
  editedData?: Record<string, unknown>
  timeoutAt?: Date
  chatHistory?: Array<{ sender: 'user' | 'agent'; text: string; timestamp: Date }>
  needsGuidance?: boolean
  createdAt?: Date
}

// Legacy ReviewItem for Control Room compatibility
export interface ReviewItem {
  id: string
  workflowId: string
  stepId: string
  digitalWorkerName: string
  action: {
    type: string
    payload: unknown
  }
  timestamp: Date
  chatHistory?: Array<{ sender: 'user' | 'agent'; text: string; timestamp: Date }>
  needsGuidance?: boolean
}

export interface CompletedItem {
  id: string
  workflowId: string
  digitalWorkerName: string
  goal: string
  timestamp: Date
}

// ============================================================================
// CONTROL ROOM TYPES
// ============================================================================

export interface ControlRoomUpdate {
  type: 'workflow_update' | 'review_needed' | 'completed'
  data: {
    workflowId: string
    stepId?: string
    agentId?: string
    digitalWorkerName?: string
    message?: string
    action?: {
      type: string
      payload: unknown
    }
    timestamp: Date
  }
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface Notification {
  id: string
  userId: string
  type: 'review_needed' | 'execution_completed' | 'execution_failed' | 'worker_error' | 'system'
  title: string
  body?: string
  data?: Record<string, unknown>
  isRead: boolean
  createdAt?: Date
}

// ============================================================================
// ACTIVITY LOG TYPES
// ============================================================================

export type ActivityLogType =
  | 'digital_worker_activation'
  | 'agent_building_start'
  | 'agent_building_complete'
  | 'workflow_execution_start'
  | 'workflow_step_execution'
  | 'workflow_step_complete'
  | 'workflow_complete'
  | 'agent_assignment'
  | 'error'
  | 'blocker'

export interface ActivityLog {
  id: string
  organizationId?: string
  type: ActivityLogType
  workerName?: string
  workflowId?: string
  stepId?: string
  data?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt?: Date
}

// ============================================================================
// GMAIL / INTEGRATION TYPES
// ============================================================================

export interface GmailAuthState {
  authenticated: boolean
  account?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}

export interface GmailToken {
  id: string
  userId: string
  organizationId: string
  accessTokenEncrypted?: string
  refreshTokenEncrypted?: string
  expiresAt?: Date
  email?: string
  createdAt?: Date
  updatedAt?: Date
}

// ============================================================================
// APP STATE TYPES
// ============================================================================

export type TabType = 'create-task' | 'create' | 'workflows' | 'team' | 'control-room'

export interface AppState {
  activeTab: TabType
  user?: {
    id: string
    name: string
    email: string
    title?: string
    avatar?: string
  }
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string
  email: string
  fullName?: string
  avatarUrl?: string
  settings?: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T> {
  data?: T
  error?: {
    message: string
    code?: string
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
