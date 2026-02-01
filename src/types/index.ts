/**
 * @fileoverview Core type definitions for the Enterprise Agent Collaboration Platform.
 *
 * This module defines all shared TypeScript interfaces and types used across the application,
 * organized into logical sections: Workflows, Agents, Teams, Executions, Reviews, and more.
 *
 * @module types
 * @see {@link ./testing.ts} for test-related types
 * @see {@link ./analytics.ts} for analytics and metrics types
 */

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

/**
 * Represents a workflow definition that can be executed by digital workers.
 * Workflows consist of ordered steps that define automation logic.
 *
 * @example
 * ```typescript
 * const workflow: Workflow = {
 *   id: 'wf_123',
 *   name: 'Email Response Automation',
 *   status: 'active',
 *   steps: [
 *     { id: 's1', label: 'Receive Email', type: 'trigger', order: 0 },
 *     { id: 's2', label: 'Send Reply', type: 'action', order: 1 }
 *   ]
 * };
 * ```
 */
export interface Workflow {
  /** Unique identifier (UUID format) */
  id: string
  /** Human-readable workflow name (max 100 characters recommended) */
  name: string
  /** Optional detailed description of workflow purpose */
  description?: string
  /** Ordered list of steps that define the workflow logic */
  steps: WorkflowStep[]
  /**
   * Primary stakeholder assigned to oversee this workflow.
   * Can be an AI agent or human operator.
   */
  assignedTo?: {
    stakeholderName: string
    stakeholderType: 'ai' | 'human'
  }
  /**
   * Current lifecycle status of the workflow.
   * - `draft`: Being edited, not executable
   * - `active`: Live and can receive triggers
   * - `paused`: Temporarily disabled
   * - `archived`: No longer in use, kept for history
   */
  status: 'draft' | 'active' | 'paused' | 'archived'
  /**
   * ID of the corresponding workflow in n8n automation engine.
   * Set after workflow is synced to n8n via POST /api/n8n/sync
   */
  n8nWorkflowId?: string
  /** Organization that owns this workflow */
  organizationId?: string
  /** User ID who created this workflow */
  createdBy?: string
  /** Timestamp when workflow was created */
  createdAt?: Date
  /** Timestamp of last modification */
  updatedAt?: Date
}

/**
 * Represents a single step within a workflow.
 * Steps are executed in order based on the `order` field.
 *
 * @example
 * ```typescript
 * const triggerStep: WorkflowStep = {
 *   id: 'step_1',
 *   label: 'New Email Received',
 *   type: 'trigger',
 *   order: 0,
 *   requirements: {
 *     isComplete: true,
 *     triggerType: 'email',
 *     n8nNodeType: 'n8n-nodes-base.emailTrigger'
 *   }
 * };
 * ```
 */
export interface WorkflowStep {
  /** Unique identifier within the workflow */
  id: string
  /** Human-readable step name displayed in UI */
  label: string
  /**
   * Type of step determining its behavior:
   * - `trigger`: Entry point that starts workflow execution
   * - `action`: Performs an operation (send email, update DB, etc.)
   * - `decision`: Conditional branching based on rules or AI
   * - `end`: Terminal step marking workflow completion
   * - `subworkflow`: Invokes another workflow as a child
   */
  type: 'trigger' | 'action' | 'decision' | 'end' | 'subworkflow'
  /**
   * Worker assigned to execute this step.
   * If not set, uses workflow-level assignment.
   */
  assignedTo?: {
    type: 'ai' | 'human'
    agentName?: string
  }
  /**
   * Execution order (0-based). Steps execute sequentially by this value.
   * Decision steps may skip subsequent steps based on conditions.
   */
  order: number
  /** Detailed configuration for step behavior */
  requirements?: StepRequirements
}

/**
 * Comprehensive configuration for a workflow step.
 * Contains trigger settings, decision logic, n8n node config, and review timeouts.
 *
 * This is a complex type that handles multiple step types. Only relevant fields
 * apply based on the parent WorkflowStep.type.
 */
export interface StepRequirements {
  /** Whether all required configuration is complete */
  isComplete: boolean
  /** Human-readable description of what this step does */
  requirementsText?: string
  /**
   * Conversation history from Gemini AI during workflow creation.
   * Used to provide context when editing steps later.
   */
  chatHistory?: Array<{ sender: 'user' | 'system'; text: string }>
  /** Third-party service integrations enabled for this step */
  integrations?: {
    gmail?: boolean
  }
  /** Additional user-defined requirements or notes */
  customRequirements?: string[]
  /**
   * AI agent behavioral blueprint defining allowed/forbidden actions.
   * Used by AI workers to make autonomous decisions within bounds.
   */
  blueprint?: {
    /** Actions the AI is explicitly allowed to take */
    greenList: string[]
    /** Actions the AI must never take (requires human review) */
    redList: string[]
    /** Unresolved questions that need human clarification */
    outstandingQuestions?: string[]
  }

  // ----- Trigger Configuration (for type: 'trigger') -----

  /**
   * How this trigger step is activated:
   * - `manual`: User clicks "Run" in UI
   * - `schedule`: Runs on cron schedule
   * - `webhook`: Activated by external HTTP request
   * - `email`: Triggered by incoming email
   */
  triggerType?: 'manual' | 'schedule' | 'webhook' | 'email'
  /** Trigger-specific configuration */
  triggerConfig?: {
    /** Cron expression for scheduled triggers (e.g., "0 9 * * 1-5" for 9am weekdays) */
    schedule?: string
    /** URL path for webhook triggers (auto-generated if not set) */
    webhookPath?: string
    /** Email filter criteria for email triggers */
    emailFilter?: string
  }

  // ----- Decision Configuration (for type: 'decision') -----

  /**
   * Conditional rules for decision steps.
   * All conditions must pass (AND logic) for the "true" branch.
   */
  conditions?: Array<{
    /** Optional unique ID for this condition */
    id?: string
    /** Left side of comparison (can reference variables like {{input.status}}) */
    leftValue: string
    /**
     * Comparison operator. String operators work on text, numeric on numbers.
     * Boolean operators (isTrue/isFalse) treat value as boolean.
     */
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'isEmpty' | 'isNotEmpty' | 'isTrue' | 'isFalse'
    /** Right side of comparison */
    rightValue: string
  }>
  /**
   * If true, use Gemini AI to evaluate the decision instead of rule-based conditions.
   * AI will consider context and make judgment calls.
   */
  useAIForDecision?: boolean

  // ----- Sub-workflow Configuration (for type: 'subworkflow') -----

  /** ID of the workflow to invoke as a child */
  subWorkflowId?: string
  /** Parameters to pass to the sub-workflow (key-value pairs) */
  subWorkflowParams?: Record<string, string>

  // ----- n8n Node Configuration -----

  /**
   * n8n node type identifier (e.g., "n8n-nodes-base.gmail", "n8n-nodes-base.slack").
   * Used when syncing workflow to n8n automation engine.
   * @see https://docs.n8n.io/integrations/builtin/
   */
  n8nNodeType?: string
  /**
   * n8n node-specific configuration passed directly to the node.
   * Schema varies by node type.
   */
  n8nConfig?: Record<string, unknown>

  // ----- Review Configuration -----

  /**
   * Maximum hours to wait for human review before auto-expiring.
   * @minimum 1
   * @maximum 168 (7 days)
   * @default 72 (3 days)
   */
  timeoutHours?: number
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

/**
 * Configuration for an AI agent assigned to a specific workflow step.
 * Defines the agent's behavioral boundaries and integration access.
 */
export interface AgentConfiguration {
  /** Unique identifier */
  id: string
  /** Display name for the agent */
  name: string
  /** ID of the step this agent is configured for */
  stepId: string
  /** ID of the workflow containing the step */
  workflowId: string
  /**
   * Behavioral blueprint defining allowed and forbidden actions.
   * Agents operate autonomously within greenList bounds,
   * but must escalate to humans for redList items.
   */
  blueprint: {
    /** Actions explicitly permitted (e.g., "send email", "update status") */
    greenList: string[]
    /** Actions forbidden without human approval (e.g., "delete data", "send to external") */
    redList: string[]
  }
  /** External service integrations the agent can access */
  integrations: {
    gmail?: {
      authenticated: boolean
      account?: string
    }
  }
  /**
   * Agent operational status:
   * - `configured`: Setup complete but not running
   * - `active`: Ready to process tasks
   * - `paused`: Temporarily disabled
   */
  status: 'configured' | 'active' | 'paused'
  /** Timestamp when agent was created */
  createdAt: Date
}

// ============================================================================
// DIGITAL WORKER / TEAM TYPES
// ============================================================================

/**
 * Represents a digital worker (AI or human) that can execute workflow steps.
 * Workers are organized into teams and can be assigned to multiple workflows.
 *
 * @example
 * ```typescript
 * const aiWorker: DigitalWorker = {
 *   id: 'worker_ai_1',
 *   organizationId: 'org_123',
 *   name: 'Email Assistant',
 *   type: 'ai',
 *   role: 'Email Processing',
 *   status: 'active'
 * };
 * ```
 */
export interface DigitalWorker {
  /** Unique identifier (UUID format) */
  id: string
  /** Organization this worker belongs to */
  organizationId: string
  /** Team this worker is assigned to (optional) */
  teamId?: string
  /** ID of the worker's manager (for hierarchy) */
  managerId?: string
  /** Display name */
  name: string
  /**
   * Worker type:
   * - `ai`: Automated agent that processes tasks autonomously
   * - `human`: Human operator who reviews and approves actions
   */
  type: 'ai' | 'human'
  /** Job title or function (e.g., "Email Processor", "Approval Manager") */
  role?: string
  /** Detailed description of worker capabilities */
  description?: string
  /** URL to worker's avatar image */
  avatarUrl?: string
  /**
   * Current operational status:
   * - `active`: Working normally
   * - `inactive`: Not currently in use
   * - `paused`: Temporarily suspended
   * - `error`: Encountered an error, needs attention
   * - `needs_attention`: Flagged for human review
   */
  status: 'active' | 'inactive' | 'paused' | 'error' | 'needs_attention'
  /** List of workflow IDs this worker is assigned to */
  assignedWorkflows?: string[]
  /** AI personality settings (for AI workers) */
  personality?: {
    /** Communication style (e.g., "professional", "friendly") */
    tone: string
    /** Response length preference (e.g., "concise", "detailed") */
    verbosity: string
  }
  /** Additional custom data */
  metadata?: Record<string, unknown>
  /** Timestamp when worker was created */
  createdAt?: Date
  /** Timestamp of last update */
  updatedAt?: Date
}

/**
 * Legacy type for org chart visualization.
 * @deprecated Use {@link DigitalWorker} instead. This type exists for backward
 * compatibility with the OrgChart component and will be removed in a future version.
 */
export interface NodeData {
  /** Worker display name */
  name: string
  /** Worker type (ai or human) */
  type: 'ai' | 'human'
  /** Job role */
  role?: string
  /** Current status */
  status?: 'active' | 'inactive' | 'paused' | 'error' | 'needs_attention'
  /** Assigned workflow IDs */
  assignedWorkflows?: string[]
  /** Child nodes for tree hierarchy */
  children?: NodeData[]
}

// ============================================================================
// ORGANIZATION & TEAM TYPES
// ============================================================================

/**
 * Represents an organization (tenant) in the system.
 * Organizations contain teams and digital workers.
 */
export interface Organization {
  /** Unique identifier */
  id: string
  /** Organization display name */
  name: string
  /** URL-friendly identifier (used in routes) */
  slug: string
  /** URL to organization logo */
  logoUrl?: string
  /** Organization-wide settings */
  settings?: Record<string, unknown>
  /** Creation timestamp */
  createdAt?: Date
  /** Last update timestamp */
  updatedAt?: Date
}

/**
 * Represents a team within an organization.
 * Teams can be nested to form hierarchies.
 */
export interface Team {
  /** Unique identifier */
  id: string
  /** Parent organization ID */
  organizationId: string
  /** Parent team ID for nested teams (null for top-level teams) */
  parentTeamId?: string
  /** Team display name */
  name: string
  /** Team description */
  description?: string
  /** Creation timestamp */
  createdAt?: Date
  /** Last update timestamp */
  updatedAt?: Date
}

/**
 * Represents a user's membership in an organization with their role.
 */
export interface OrganizationMember {
  /** Unique membership ID */
  id: string
  /** Organization ID */
  organizationId: string
  /** User ID */
  userId: string
  /**
   * Member's role determining permissions:
   * - `owner`: Full access, can delete organization
   * - `admin`: Full access except deletion
   * - `manager`: Can manage workers and workflows
   * - `member`: Can use workflows
   * - `viewer`: Read-only access
   */
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  /** When the user joined the organization */
  createdAt?: Date
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

/**
 * A single message in a conversation (used in workflow creation chat).
 */
export interface ConversationMessage {
  /**
   * Message sender:
   * - `user`: Human user input
   * - `system`: AI assistant response
   */
  sender: 'user' | 'system'
  /** Message content (plain text or markdown) */
  text: string
  /** When the message was sent */
  timestamp?: Date
}

/**
 * A conversation session between user and AI during workflow creation.
 * Persisted to allow resuming workflow design.
 */
export interface ConversationSession {
  /** Unique session ID */
  id: string
  /** Organization context */
  organizationId?: string
  /** Ordered list of messages */
  messages: ConversationMessage[]
  /** Associated workflow if one was created */
  workflowId?: string
  /** User who started the conversation */
  createdBy?: string
  /** Session creation time */
  createdAt: Date
  /** Last message time */
  updatedAt: Date
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

/**
 * Represents a single execution (run) of a workflow.
 * Tracks the execution's progress through each step.
 *
 * @example
 * ```typescript
 * const execution: Execution = {
 *   id: 'exec_123',
 *   workflowId: 'wf_456',
 *   status: 'running',
 *   currentStepIndex: 2,
 *   triggerType: 'webhook',
 *   startedAt: new Date()
 * };
 * ```
 */
export interface Execution {
  /** Unique execution ID */
  id: string
  /** ID of the workflow being executed */
  workflowId: string
  /** ID of the worker processing this execution */
  workerId?: string
  /** Corresponding execution ID in n8n (if synced) */
  n8nExecutionId?: string
  /**
   * Current execution status:
   * - `pending`: Queued, not yet started
   * - `running`: Currently executing steps
   * - `waiting_review`: Paused for human approval
   * - `completed`: Finished successfully
   * - `failed`: Encountered an error
   * - `cancelled`: Manually stopped
   */
  status: 'pending' | 'running' | 'waiting_review' | 'completed' | 'failed' | 'cancelled'
  /** Index of the currently executing step (0-based) */
  currentStepIndex: number
  /** What triggered this execution (e.g., "webhook", "schedule", "manual") */
  triggerType: string
  /** Data received from the trigger */
  triggerData?: Record<string, unknown>
  /** Input data passed to the workflow */
  inputData?: Record<string, unknown>
  /** Final output data from the workflow */
  outputData?: Record<string, unknown>
  /** Error message if execution failed */
  error?: string
  /** When execution started */
  startedAt?: Date
  /** When execution completed (success or failure) */
  completedAt?: Date
  /** Record creation time */
  createdAt?: Date
}

/**
 * Tracks the execution of a single step within a workflow execution.
 */
export interface ExecutionStep {
  /** Unique step execution ID */
  id: string
  /** Parent execution ID */
  executionId: string
  /** Step index in workflow (0-based) */
  stepIndex: number
  /** Step label/name */
  stepName: string
  /** Step type (trigger, action, decision, etc.) */
  stepType: string
  /**
   * Step execution status:
   * - `pending`: Not yet reached
   * - `running`: Currently executing
   * - `completed`: Finished successfully
   * - `failed`: Encountered an error
   * - `skipped`: Bypassed (e.g., decision branch not taken)
   */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  /** Input data for this step */
  inputData?: Record<string, unknown>
  /** Output data from this step */
  outputData?: Record<string, unknown>
  /** Error message if step failed */
  error?: string
  /** When step started executing */
  startedAt?: Date
  /** When step finished */
  completedAt?: Date
  /** Record creation time */
  createdAt?: Date
}

// ============================================================================
// REVIEW TYPES
// ============================================================================

/**
 * A request for human review during workflow execution.
 * Created when a step requires approval or human input.
 *
 * @example
 * ```typescript
 * const review: ReviewRequest = {
 *   id: 'rev_123',
 *   executionId: 'exec_456',
 *   stepId: 'step_789',
 *   stepIndex: 2,
 *   status: 'pending',
 *   reviewType: 'approval',
 *   reviewData: { action: 'send_email', recipient: 'user@example.com' },
 *   timeoutAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
 * };
 * ```
 */
export interface ReviewRequest {
  /** Unique review request ID */
  id: string
  /** Execution that generated this review */
  executionId: string
  /** Step that requires review */
  stepId: string
  /** Step index in workflow */
  stepIndex: number
  /** User ID assigned to review (optional, for routing) */
  assignedTo?: string
  /** Name of the worker that requested review */
  workerName?: string
  /**
   * Current review status:
   * - `pending`: Awaiting human action
   * - `approved`: Human approved the action
   * - `rejected`: Human rejected the action
   * - `edited`: Human modified and approved
   * - `expired`: Timed out without response
   */
  status: 'pending' | 'approved' | 'rejected' | 'edited' | 'expired'
  /**
   * Type of review needed:
   * - `approval`: Simple yes/no decision
   * - `input_needed`: Requires human to provide data
   * - `edit_review`: Review and optionally modify proposed action
   * - `decision`: Choose between options
   */
  reviewType: 'approval' | 'input_needed' | 'edit_review' | 'decision'
  /** Data to be reviewed (action details, proposed changes, etc.) */
  reviewData: Record<string, unknown>
  /** ID of user who completed the review */
  reviewerId?: string
  /** When the review was completed */
  reviewedAt?: Date
  /** Optional feedback or notes from reviewer */
  feedback?: string
  /** Modified data if reviewer made edits */
  editedData?: Record<string, unknown>
  /** When this review will expire if not completed */
  timeoutAt?: Date
  /** Conversation history between agent and reviewer */
  chatHistory?: Array<{ sender: 'user' | 'agent'; text: string; timestamp: Date }>
  /** Flag indicating agent needs additional guidance */
  needsGuidance?: boolean
  /** Record creation time */
  createdAt?: Date
}

/**
 * Legacy type for Control Room review items.
 * @deprecated Use {@link ReviewRequest} instead. This type exists for backward
 * compatibility with older Control Room implementations.
 */
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

/**
 * Legacy type for completed workflow items in Control Room.
 * @deprecated Use {@link Execution} with status='completed' instead.
 */
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

/**
 * Real-time update message for the Control Room.
 * Pushed via Supabase Realtime when workflow state changes.
 */
export interface ControlRoomUpdate {
  /**
   * Update type:
   * - `workflow_update`: Workflow status changed
   * - `review_needed`: New review request created
   * - `completed`: Execution finished
   */
  type: 'workflow_update' | 'review_needed' | 'completed'
  /** Update payload */
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

/**
 * User notification for important events.
 */
export interface Notification {
  /** Unique notification ID */
  id: string
  /** User to notify */
  userId: string
  /**
   * Notification type:
   * - `review_needed`: Action requires approval
   * - `execution_completed`: Workflow finished successfully
   * - `execution_failed`: Workflow encountered error
   * - `worker_error`: Digital worker has an issue
   * - `system`: System-level notification
   */
  type: 'review_needed' | 'execution_completed' | 'execution_failed' | 'worker_error' | 'system'
  /** Notification title */
  title: string
  /** Optional detailed message */
  body?: string
  /** Additional context data */
  data?: Record<string, unknown>
  /** Whether user has seen this notification */
  isRead: boolean
  /** When notification was created */
  createdAt?: Date
}

// ============================================================================
// ACTIVITY LOG TYPES
// ============================================================================

/**
 * Types of events that can be logged in the activity log.
 * Used for audit trail, debugging, and analytics.
 */
export type ActivityLogType =
  | 'digital_worker_activation'   // Worker was activated
  | 'agent_building_start'        // Started building an agent
  | 'agent_building_complete'     // Agent build completed
  | 'workflow_execution_start'    // Workflow execution began
  | 'workflow_step_execution'     // Step started executing
  | 'workflow_step_complete'      // Step completed successfully
  | 'workflow_step_error'         // Step failed with error
  | 'workflow_complete'           // Workflow finished
  | 'agent_assignment'            // Agent assigned to step
  | 'error'                       // General error
  | 'blocker'                     // Blocking issue encountered
  | 'debug_analysis'              // Debug/troubleshooting performed
  | 'review_approved'             // Human approved a review
  | 'review_rejected'             // Human rejected a review
  | 'review_requested'            // New review was requested
  | 'review_completed'            // Review process completed
  | 'execution_progress'          // Execution progress update
  | 'execution_completed'         // Execution finished successfully
  | 'execution_failed'            // Execution failed

/**
 * Activity log entry for audit trail and debugging.
 * Immutable record of events in the system.
 */
export interface ActivityLog {
  /** Unique log entry ID */
  id: string
  /** Organization context (for multi-tenancy) */
  organizationId?: string
  /** Type of event logged */
  type: ActivityLogType
  /** Worker involved (if applicable) */
  workerName?: string
  /** Workflow involved (if applicable) */
  workflowId?: string
  /** Step involved (if applicable) */
  stepId?: string
  /** Event-specific data payload */
  data?: Record<string, unknown>
  /** Additional metadata (e.g., user agent, IP) */
  metadata?: Record<string, unknown>
  /** When the event occurred */
  createdAt?: Date
}

// ============================================================================
// GMAIL / INTEGRATION TYPES
// ============================================================================

/**
 * OAuth authentication state for Gmail integration.
 * Stored in component state during auth flow.
 */
export interface GmailAuthState {
  /** Whether user has authenticated with Gmail */
  authenticated: boolean
  /** Gmail account email address */
  account?: string
  /** OAuth access token (short-lived) */
  accessToken?: string
  /** OAuth refresh token (long-lived, used to get new access tokens) */
  refreshToken?: string
  /** Unix timestamp when access token expires */
  expiresAt?: number
}

/**
 * Persisted Gmail OAuth tokens for a user.
 * Tokens are stored encrypted in the database.
 */
export interface GmailToken {
  /** Record ID */
  id: string
  /** User who owns these tokens */
  userId: string
  /** Organization context */
  organizationId: string
  /** Encrypted access token */
  accessTokenEncrypted?: string
  /** Encrypted refresh token */
  refreshTokenEncrypted?: string
  /** Token expiration time */
  expiresAt?: Date
  /** Associated Gmail address */
  email?: string
  /** Record creation time */
  createdAt?: Date
  /** Last update time */
  updatedAt?: Date
}

// ============================================================================
// APP STATE TYPES
// ============================================================================

/**
 * Available tabs in the main dashboard navigation.
 */
export type TabType = 'create-task' | 'create' | 'workflows' | 'team' | 'control-room'

/**
 * Global application state (used by React context).
 */
export interface AppState {
  /** Currently active navigation tab */
  activeTab: TabType
  /** Authenticated user info */
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

/**
 * User profile information.
 */
export interface User {
  /** Unique user ID (from auth provider) */
  id: string
  /** User's email address */
  email: string
  /** Display name */
  fullName?: string
  /** Profile picture URL */
  avatarUrl?: string
  /** User preferences */
  settings?: Record<string, unknown>
  /** Account creation time */
  createdAt?: Date
  /** Last profile update */
  updatedAt?: Date
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Standard API response wrapper.
 * All API endpoints should return responses in this format.
 *
 * @template T - Type of the data payload
 *
 * @example
 * ```typescript
 * // Success response
 * const success: ApiResponse<Workflow> = {
 *   data: { id: 'wf_123', name: 'My Workflow', ... }
 * };
 *
 * // Error response
 * const error: ApiResponse<Workflow> = {
 *   error: { message: 'Workflow not found', code: 'NOT_FOUND' }
 * };
 * ```
 */
export interface ApiResponse<T> {
  /** Response payload (present on success) */
  data?: T
  /** Error details (present on failure) */
  error?: {
    /** Human-readable error message */
    message: string
    /** Machine-readable error code (e.g., 'NOT_FOUND', 'UNAUTHORIZED') */
    code?: string
  }
}

/**
 * Paginated API response for list endpoints.
 *
 * @template T - Type of items in the list
 */
export interface PaginatedResponse<T> {
  /** Array of items for current page */
  data: T[]
  /** Total number of items across all pages */
  total: number
  /** Current page number (1-based) */
  page: number
  /** Number of items per page */
  pageSize: number
  /** Whether more pages exist */
  hasMore: boolean
}

// ============================================================================
// RE-EXPORTS FROM FEATURE MODULES
// ============================================================================

/**
 * Testing types for test runner functionality.
 * @see ./testing.ts
 */
export * from './testing'

/**
 * Analytics types for metrics and reporting.
 * @see ./analytics.ts
 */
export * from './analytics'
