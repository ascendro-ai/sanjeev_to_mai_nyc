# ENTERPRISE AGENT COLLABORATION PLATFORM - TECHNICAL SPECIFICATION

## EXECUTIVE SUMMARY

This is a React-based web application (Workflow.ai) that enables business users to create, configure, and execute automated workflows using AI agents powered by Google's Gemini API. The platform combines conversational workflow discovery, intelligent agent building, team organization visualization, and real-time execution monitoring.

---

## IMPORTANT: POST-IMPLEMENTATION CLEANUP

> **CLAUDE CODE DIRECTIVE**: After implementing any changes to this codebase, review `CODEBASE_CLEANUP_GUIDE.md` in the repo root. For each issue listed:
>
> 1. **Check if the issue still exists** in the current codebase
> 2. **If it exists, fix it** following the recommended solution
> 3. **If already resolved, skip it**
>
> **Priority order for remaining issues:**
> 1. Security issues (CLIENT_SECRET exposure, XSS risks)
> 2. Error Boundary component
> 3. Replace `any` types with proper TypeScript types
> 4. Extract duplicate code to utilities
> 5. Replace polling with event-based patterns
>
> This ensures the codebase stays clean as features are added.

---

## 1. TYPES & DATA STRUCTURES

### 1.1 Workflow Types

**`Workflow` Interface**
- `id`: string - Unique workflow identifier
- `name`: string - Workflow display name
- `description?`: string - Optional workflow description
- `steps`: WorkflowStep[] - Array of workflow steps in execution order
- `assignedTo?`: object - Assignment to stakeholder
  - `stakeholderName`: string - Name of assigned stakeholder/digital worker
  - `stakeholderType`: 'ai' | 'human' - Type of stakeholder
- `status`: 'draft' | 'active' | 'paused' - Current workflow state
- `createdAt?`: Date - Creation timestamp
- `updatedAt?`: Date - Last modification timestamp

**`WorkflowStep` Interface**
- `id`: string - Unique step identifier
- `label`: string - Step display name/description
- `type`: 'trigger' | 'action' | 'decision' | 'end' - Step classification
- `assignedTo?`: object - Step assignment
  - `type`: 'ai' | 'human' - Executor type
  - `agentName?`: string - Name of AI agent executing step
- `order`: number - Execution sequence order (0-indexed)
- `requirements?`: StepRequirements - Step-specific requirements/configuration

**`StepRequirements` Interface**
- `isComplete`: boolean - Whether requirements gathering is complete
- `requirementsText?`: string - Natural language requirements summary
- `chatHistory?`: Array<{ sender: 'user' | 'system'; text: string }> - Conversation history
- `integrations?`: object
  - `gmail?`: boolean - Whether step uses Gmail integration
- `customRequirements?`: string[] - User-defined custom requirements
- `blueprint?`: object - AI behavioral constraints
  - `greenList`: string[] - Allowed actions
  - `redList`: string[] - Forbidden actions
  - `outstandingQuestions?`: string[] - Unanswered clarification questions

### 1.2 Agent Types

**`AgentConfiguration` Interface**
- `id`: string - Unique agent identifier
- `name`: string - Agent display name
- `stepId`: string - Primary workflow step ID
- `workflowId`: string - Parent workflow ID
- `blueprint`: object
  - `greenList`: string[] - Allowed operations
  - `redList`: string[] - Forbidden operations
- `integrations`: object
  - `gmail?`: object
    - `authenticated`: boolean
    - `account?`: string - Associated email account
- `status`: 'configured' | 'active' | 'paused' - Agent lifecycle state
- `createdAt`: Date - Creation timestamp

### 1.3 Organization Structure

**`NodeData` Interface** - Represents team members (human or AI)
- `name`: string - Node identifier/name
- `type`: 'ai' | 'human' - Stakeholder type
- `role?`: string - Job title or role description
- `status?`: 'active' | 'inactive' | 'needs_attention' - Current status
- `assignedWorkflows?`: string[] - Array of workflow IDs assigned to node
- `children?`: NodeData[] - Organizational hierarchy support

### 1.4 Conversation Types

**`ConversationMessage` Interface**
- `sender`: 'user' | 'system' - Message originator
- `text`: string - Message content
- `timestamp?`: Date - When message was sent

**`ConversationSession` Interface**
- `id`: string - Session identifier
- `messages`: ConversationMessage[] - Conversation history
- `workflowId?`: string - Associated workflow ID
- `createdAt`: Date - Session start time
- `updatedAt`: Date - Last update time

### 1.5 Control Room Types

**`ControlRoomUpdate` Interface** - Real-time status events
- `type`: 'workflow_update' | 'review_needed' | 'completed' - Event type
- `data`: object
  - `workflowId`: string - Workflow being updated
  - `stepId?`: string - Step being executed
  - `agentId?`: string - Agent performing action
  - `digitalWorkerName?`: string - Digital worker name
  - `message?`: string - Status message
  - `action?`: object - Action payload
    - `type`: string - Action type
    - `payload`: unknown - Action-specific data
  - `timestamp`: Date - Event timestamp

**`ReviewItem` Interface** - Workflow step requiring human review
- `id`: string - Unique review item ID
- `workflowId`: string - Associated workflow
- `stepId`: string - Associated step
- `digitalWorkerName`: string - Agent requesting review
- `action`: object
  - `type`: string - Action type requiring approval
  - `payload`: unknown - Action details
- `timestamp`: Date - When review was requested
- `chatHistory?`: Array<{ sender: 'user' | 'agent'; text: string; timestamp: Date }> - Guidance conversation
- `needsGuidance?`: boolean - Flag for guidance requests

**`CompletedItem` Interface** - Finished workflow execution record
- `id`: string - Item ID
- `workflowId`: string - Completed workflow
- `digitalWorkerName`: string - Executing agent
- `goal`: string - Workflow objective summary
- `timestamp`: Date - Completion time

### 1.6 Gmail Integration

**`GmailAuthState` Interface**
- `authenticated`: boolean - Authentication status
- `account?`: string - Authenticated email address
- `accessToken?`: string - OAuth 2.0 access token
- `refreshToken?`: string - OAuth 2.0 refresh token
- `expiresAt?`: number - Token expiration timestamp (milliseconds)

### 1.7 App State

**`TabType`** - Union type: 'create-task' | 'workflows' | 'team' | 'control-room'

**`AppState` Interface**
- `activeTab`: TabType - Current active tab
- `user?`: object
  - `name`: string
  - `title`: string
  - `avatar?`: string

---

## 2. SERVICES

### 2.1 activityLogService.ts

**Purpose**: Persistent activity logging for digital worker actions and workflow execution events.

**LogEntry Interface** (Internal)
- `id`: string - Unique log entry ID (format: `${Date.now()}-${randomString}`)
- `timestamp`: string - ISO 8601 timestamp
- `type`: 'digital_worker_activation' | 'agent_building_start' | 'agent_building_complete' | 'workflow_execution_start' | 'workflow_step_execution' | 'workflow_step_complete' | 'workflow_complete' | 'agent_assignment' | 'error' | 'blocker'
- `digitalWorkerName`: string - Associated digital worker
- `workflowId?`: string - Associated workflow
- `stepId?`: string - Associated step
- `data`: Record<string, any> - Event-specific metadata
- `metadata?`: object - Additional tracking data
  - `duration?`: number - Duration in milliseconds
  - `error?`: string - Error message if applicable
  - `agentsCreated?`: AgentConfiguration[]
  - `stepsProcessed?`: number

**Constants**
- `STORAGE_KEY`: 'digital_worker_activity_logs'
- `MAX_LOG_ENTRIES`: 1000 - Circular buffer limit
- `LOG_UPDATE_EVENT`: 'digital_worker_log_update' - Custom event name

**Functions**

**`logDigitalWorkerActivation(digitalWorkerName: string, assignedWorkflows: string[]): void`**
- Logs when a digital worker is activated
- Stores workflow assignments
- Emits LOG_UPDATE_EVENT

**`logAgentBuildingStart(workflowId: string, digitalWorkerName: string, workflowSteps: number): void`**
- Logs start of agent creation process
- Records step count for the workflow

**`logAgentBuildingComplete(workflowId: string, digitalWorkerName: string, agents: AgentConfiguration[], duration: number): void`**
- Logs completion of agent configuration
- Stores created agents in metadata
- Records duration

**`logWorkflowExecutionStart(workflowId: string, digitalWorkerName: string, workflowName: string, totalSteps: number): void`**
- Logs workflow execution initiation
- Records workflow metadata

**`logWorkflowStepExecution(workflowId: string, stepId: string, stepLabel: string, stepType: string, digitalWorkerName: string, stepOrder: number, assignedTo?: {...}): void`**
- Logs individual step execution
- Captures step assignment info

**`logWorkflowStepComplete(workflowId: string, stepId: string, stepLabel: string, digitalWorkerName: string, duration: number): void`**
- Logs step completion
- Records execution duration

**`logWorkflowComplete(workflowId: string, digitalWorkerName: string, totalDuration: number, stepsCompleted: number): void`**
- Logs complete workflow execution finish
- Records total duration and step count

**`logAgentAssignment(workflowId: string, digitalWorkerName: string, workflowName: string): void`**
- Logs when workflow is assigned to digital worker

**`logErrorOrBlocker(workflowId: string, stepId: string, stepLabel: string, digitalWorkerName: string, errorMessage: string, errorType?: 'error' | 'blocker'): void`**
- Logs execution errors or blockers
- Defaults to 'error' type if not specified

**`getLogs(filters?: {...}): LogEntry[]`**
- Retrieves logs with optional filtering
- Filters: digitalWorkerName, workflowId, type, startDate, endDate
- Returns logs sorted by timestamp (newest first)

**`getLogStatistics(): object`**
- Returns analytics object:
  - `totalLogs`: number
  - `byType`: Record<string, number>
  - `byDigitalWorker`: Record<string, number>
  - `oldestLog?`: string
  - `newestLog?`: string

**`exportLogs(): void`**
- Downloads logs as JSON file
- Filename: `digital-worker-logs-${YYYY-MM-DD}.json`

**`clearLogs(): void`**
- Removes all logs from localStorage

**Storage Implementation**
- Uses localStorage with key 'digital_worker_activity_logs'
- Implements circular buffer (keeps only MAX_LOG_ENTRIES recent entries)
- Custom event dispatching for real-time updates

---

### 2.2 geminiService.ts

**Purpose**: LLM-powered workflow discovery, requirements gathering, and agent building using Google Gemini API.

**Dependencies**
- GoogleGenerativeAI SDK (@google/generative-ai)
- Environment variable: `VITE_GEMINI_API_KEY`
- Model: 'gemini-3-pro-preview'

**AgentAction Interface**
- `type`: 'send_email' | 'read_email' | 'modify_email' | 'guidance_requested' | 'complete'
- `parameters?`: object
  - `to?`: string - Email recipient
  - `subject?`: string - Email subject
  - `body?`: string - Email body
  - `emailId?`: string - Email ID for modifications
  - `label?`: string - Gmail label
  - `guidanceQuestion?`: string - Question for user guidance

**AgentExecutionResult Interface**
- `success`: boolean - Execution status
- `actions`: AgentAction[] - Executed actions
- `message?`: string - Execution summary
- `error?`: string - Error message if failed
- `needsGuidance?`: boolean - Guidance required flag
- `guidanceQuestion?`: string - Guidance prompt

**Functions**

**`consultWorkflow(conversationHistory: ConversationMessage[], questionCount: number): Promise<{response: string; isComplete: boolean}>`**
- Conversational workflow consultant using Gemini LLM
- Analyzes conversation to determine if user is ready to move forward
- Uses rules-based approach to detect final confirmation vs intermediate acknowledgment
- Returns response and completion flag
- Tracks question count (max 3-5 per GEMINI_CONFIG.MAX_QUESTIONS)

**Consultant Logic**
- Strong final confirmations: "that works", "perfect", "great", "correct", etc.
- Readiness phrases: "let's build", "ready to build", "let's get started"
- Intermediate acknowledgments: "ok", "okay", "yes", "got it"
- Summary detection: checks if last assistant message contains summary indicators
- After max questions reached: wraps up and summarizes

**`extractWorkflowFromConversation(conversationHistory: ConversationMessage[], existingWorkflowId?: string): Promise<Workflow | null>`**
- Extracts workflow structure from conversation history
- Real-time background extraction (debounced 500ms)
- Auto-assigns steps to AI or human based on context clues
- Classification: trigger, action, decision, end
- Returns complete Workflow object or null if extraction fails

**Extraction Rules**
- "worker", "staff", "person", "employee" mentions → human assignment
- Email, Excel, PDF, calculations → AI assignment
- Review, approval, consultation → human assignment
- Maintains chronological order exactly as discussed

**`buildAutomation(step: WorkflowStep, conversationHistory: ConversationMessage[], createTaskConversation?: ConversationMessage[]): Promise<{requirementsText, blueprint, customRequirements}>`**
- Gathers detailed requirements for individual workflow steps
- Uses context from both requirements chat and initial workflow chat
- Generates greenList/redList (behavioral constraints)
- Extracts outstanding questions indicating gaps
- Returns structured requirements object

**`getInitialRequirementsMessage(step: WorkflowStep, workflowName: string, createTaskConversation?: ConversationMessage[]): Promise<string>`**
- Generates friendly opening message for requirements gathering
- References workflow context
- Asks initial exploratory question

**`gatherRequirementsConversation(step: WorkflowStep, conversationHistory: ConversationMessage[], createTaskConversation?: ConversationMessage[]): Promise<string>`**
- Conversational response generator for requirements gathering
- Acknowledges user input
- Asks follow-up questions naturally
- Returns single conversational response (2-4 sentences)

**`buildAgentsFromWorkflowRequirements(workflow: Workflow, digitalWorkerName?: string): Promise<AgentConfiguration[]>`**
- Intelligently groups workflow steps into shareable AI agents
- Considers: shared integrations, related actions, efficiency
- Logs agent building start/complete with duration
- Returns array of configured agents ready for execution

**Agent Grouping Strategy**
- Steps with similar integrations (Gmail) share agents
- Related actions are grouped together
- Optimization for execution efficiency
- Default digital worker name: 'default'

**`extractAgentContext(agentConfig: AgentConfiguration, workflow: Workflow): Promise<string>`**
- Generates context summary for a specific agent
- Used for agent-specific documentation
- References step, blueprint, and requirements

**`extractPeopleFromConversation(conversationHistory: ConversationMessage[]): Promise<NodeData[]>`**
- Extracts people/stakeholders mentioned in workflow discovery
- Returns array of NodeData objects
- Used to populate team org chart
- Returns empty array if no people found

**Error Handling**
- Validates Gemini API key is configured
- Parses JSON responses with regex matching
- Handles guidance request detection
- Re-throws errors with context

---

### 2.3 gmailService.ts

**Purpose**: OAuth 2.0 authentication with Gmail API using PKCE flow and email operations.

**Environment Variables**
- `VITE_GMAIL_CLIENT_ID`: OAuth client ID
- `VITE_GMAIL_CLIENT_SECRET`: OAuth client secret
- Redirect URI: `${window.location.origin}/auth/gmail/callback`
- Scopes: `gmail.send` and `gmail.modify`

**Functions**

**`generateCodeVerifier(): string`**
- Generates cryptographically secure random PKCE code verifier (base64url encoded)
- Used in PKCE authorization flow

**`generateCodeChallenge(verifier: string): Promise<string>`**
- Derives SHA-256 hash of verifier
- Returns base64url encoded challenge

**`getGmailAuthState(): GmailAuthState | null`**
- Retrieves cached auth state from localStorage
- Returns null if not authenticated

**`isGmailAuthenticated(): boolean`**
- Checks authentication status
- Validates token expiration
- Returns boolean

**`initiateGmailAuth(): Promise<void>`**
- Initiates OAuth2 PKCE flow
- Generates code verifier/challenge
- Stores verifier in sessionStorage
- Redirects to Google OAuth consent screen
- Required parameters in authorization URL:
  - client_id, redirect_uri, response_type=code
  - scope, code_challenge, code_challenge_method=S256
  - access_type=offline, prompt=consent

**`handleGmailCallback(code: string): Promise<void>`**
- Called by App.tsx when returning from OAuth callback
- Exchanges authorization code for tokens via POST to `oauth2.googleapis.com/token`
- Request payload includes: client_id, client_secret, code, code_verifier
- Stores GmailAuthState in localStorage
- Error handling for: redirect_uri_mismatch, invalid_grant, invalid_client
- Updates window location to '/'

**`refreshGmailToken(): Promise<string | null>`**
- Uses refresh token to obtain new access token
- POST to `oauth2.googleapis.com/token`
- Clears auth on refresh failure
- Returns new access token or null

**`getGmailAccessToken(): Promise<string | null>`**
- Gets valid access token, refreshing if expired
- Returns null if not authenticated
- Checks expiresAt timestamp

**`getGmailProfile(): Promise<{email: string} | null>`**
- Calls Gmail API: GET `/gmail/v1/users/me/profile`
- Authorization header: `Bearer ${accessToken}`
- Returns email address from profile
- Returns null on failure

**`sendEmail(to: string, subject: string, body: string): Promise<void>`**
- Sends email via Gmail API
- Constructs message in RFC 2822 format
- Encodes to base64url
- POST to `/gmail/v1/users/me/messages/send`
- Headers: Authorization, Content-Type: application/json
- Request body: { raw: encodedEmail }
- Throws if not authenticated

**`readEmails(maxResults?: number): Promise<any[]>`**
- Reads recent emails via Gmail API
- Default maxResults: 10
- GET `/gmail/v1/users/me/messages?maxResults=${maxResults}`
- Returns array of message objects
- Each message has: id, threadId, labelIds, etc.
- Full message body requires separate fetch (not implemented here)

**`signOutGmail(): void`**
- Clears Gmail authentication
- Sets authenticated: false in storage

**Error Handling**
- Detailed error messages for specific OAuth failures
- Session expiration detection for PKCE verifier
- Token exchange error parsing and reporting
- Network error propagation

---

### 2.4 agentExecutionService.ts

**Purpose**: Executes individual workflow steps using LLM decision-making within blueprint constraints.

**AgentAction Interface**
- `type`: 'send_email' | 'read_email' | 'modify_email' | 'guidance_requested' | 'complete'
- `parameters?`: object with type-specific fields

**AgentExecutionResult Interface**
- `success`: boolean
- `actions`: AgentAction[]
- `message?`: string
- `error?`: string
- `needsGuidance?`: boolean
- `guidanceQuestion?`: string

**Functions**

**`executeAgentAction(step: WorkflowStep, blueprint: {greenList, redList}, guidanceContext?: [...], integrations?: {gmail}): Promise<AgentExecutionResult>`**
- Main agent execution orchestrator
- Builds prompt with step requirements and blueprint constraints
- LLM decides which actions to take
- Validates actions against blueprint
- Executes valid actions (email sending/reading)
- Handles guidance requests specially

**Prompt Structure**
- Step label, type, and requirements
- GREEN LIST: allowed actions
- RED LIST: forbidden actions
- Available integrations (Gmail)
- User guidance context from previous interactions
- CRITICAL RULES:
  1. Only perform GREEN LIST actions
  2. Never perform RED LIST actions
  3. Request guidance if clarification needed
  4. Use Gmail when available and appropriate
  5. Be specific with action parameters
- Returns JSON with actions array and reasoning

**`executeSingleAction(action: AgentAction, hasGmail: boolean): Promise<void>`**
- Executes individual action
- send_email: Validates to/subject/body, calls sendEmail
- read_email: Calls readEmails(10)
- modify_email: Not yet implemented
- guidance_requested: Throws error with guidance question
- complete: Marks step done
- Throws if required parameters missing or integration unavailable

**Error Handling**
- Validates agent response is valid JSON
- Checks for guidance request indicators
- Guidance request errors are special-cased (don't fail execution)
- Detailed logging at each stage (LLM call, action execution, completion)

---

### 2.5 workflowExecutionService.ts

**Purpose**: Manages workflow step-by-step execution, agent coordination, and human review workflows.

**ExecutionState Interface** (Internal)
- `workflowId`: string
- `currentStepIndex`: number - Current position in workflow
- `isRunning`: boolean - Execution status
- `startTime`: Date - Execution start timestamp
- `stepStartTimes`: Map<string, number> - Per-step timing
- `guidanceContext?`: Array<{stepId, chatHistory, timestamp}> - User guidance history

**Global State**
- `executionStates`: Map<string, ExecutionState> - Active workflow executions

**Functions**

**`startWorkflowExecution(workflowId: string, digitalWorkerName?: string): void`**
- Validates workflow exists and is in 'active' status
- Initializes execution state
- Logs workflow execution start event
- Emits control room update
- Calls executeWorkflowSteps asynchronously

**`executeWorkflowSteps(workflowId: string): Promise<void>`** (Internal)
- Sequential step execution loop
- Checks execution state and workflow validity
- Increments currentStepIndex after each step
- Handles completion when all steps processed
- Catches errors and logs them
- 1-second delay between steps

**`executeAgentStep(workflowId: string, step: WorkflowStep): Promise<void>`** (Internal)
- Executes individual step via LLM
- Skips human-assigned steps (just logs and continues)
- Extracts blueprint from step requirements
- Gets guidance context if available
- Calls executeAgentAction from agentExecutionService
- Handles three outcomes:
  1. **needsGuidance**: Stops execution, emits review_needed event
  2. **Decision step or approval required**: Stops execution, requests human review
  3. **Success**: Logs completion, continues to next step

**Step Execution Flow**
1. Log step execution start
2. Skip if human-assigned
3. Get blueprint and guidance context
4. Call LLM agent
5. Check for guidance request → pause execution
6. Check for review needed (decision steps) → pause for approval
7. Log completion and emit updates

**`completeWorkflow(workflowId: string, workflow: Workflow): void`** (Internal)
- Logs workflow completion with total duration
- Emits completed event to control room
- Calculates execution time from startTime

**`emitControlRoomUpdate(update: ControlRoomUpdate): void`** (Internal)
- Dispatches custom event 'controlRoomUpdate'
- Broadcasts to window event listeners
- Includes detailed update data

**`getExecutionState(workflowId: string): ExecutionState | null`**
- Retrieves current execution state for workflow

**`approveReviewItem(reviewItem: ReviewItem): void`**
- Called when human approves a review item
- Stores chat history/guidance in execution state
- For errors: retries current step
- For approvals: continues to next step
- Resumes execution with executeWorkflowSteps

**`rejectReviewItem(reviewItem: ReviewItem): void`**
- Logs rejection event
- Emits workflow_update event

**`provideGuidanceToReviewItem(reviewItemId: string, message: string): void`**
- Logs user guidance message
- (Future: would notify agent with guidance)
- Currently just stores in review item's chatHistory

**Guidance System**
- Chat history stored in ReviewItem.chatHistory
- When approved, passed to agent via executeAgentAction
- Agent uses guidance context when making decisions
- Supports iterative refinement of agent actions

---

### 2.6 workflowReadinessService.ts

**Purpose**: Validates workflow state and readiness for activation.

**Functions**

**`getWorkflowById(workflowId: string): Workflow | null`**
- Retrieves workflow from storage
- Returns null if not found

**`getAgentConfig(agentId: string): AgentConfiguration | null`**
- Retrieves agent configuration
- Constructs from step requirements if not explicitly stored
- Returns null if agent not found

**`checkWorkflowReadiness(workflowId: string): {isReady: boolean; errors: string[]}`**
- Comprehensive readiness validation
- Checks:
  1. Workflow exists
  2. Workflow is structurally valid
  3. Workflow status is 'draft' (not already active)
  4. All non-trigger/end steps have complete requirements
  5. Gmail authentication present if workflow requires it
- Returns object with isReady flag and error array
- Errors are human-readable messages

**Validation Flow**
- Workflow validity: has name and at least one step
- Status check: must be 'draft' to activate
- Requirements check: each action/decision step must have isComplete=true
- Gmail integration: if any step requires Gmail, must be authenticated

---

## 3. CONTEXTS & STATE MANAGEMENT

### 3.1 AppContext.tsx

**Purpose**: Global app state for active tab and user information.

**AppContextType Interface**
- `activeTab`: TabType
- `setActiveTab`: (tab: TabType) => void
- `user`: {name, title, avatar?}

**Default User**
```json
{
  "name": "Chitra M.",
  "title": "CEO, Treasure Blossom"
}
```

**AppProvider Component**
- Loads app state from localStorage on mount
- Persists active tab changes to localStorage
- Provides context to all children

**useApp() Hook**
- Returns AppContextType
- Throws error if used outside AppProvider

**Storage Keys**
- 'app_state' in localStorage

---

### 3.2 WorkflowContext.tsx

**Purpose**: Manages workflows and conversation sessions across the app.

**WorkflowContextType Interface**
- `workflows`: Workflow[]
- `conversations`: ConversationSession[]
- `addWorkflow`: (workflow: Workflow) => void
- `updateWorkflow`: (id: string, updates: Partial<Workflow>) => void
- `deleteWorkflow`: (id: string) => void
- `activateWorkflow`: (id: string) => void
- `addConversation`: (session: ConversationSession) => void
- `updateConversation`: (id: string, messages: ConversationMessage[]) => void
- `getConversationByWorkflowId`: (workflowId: string) => ConversationSession | undefined
- `updateStepRequirements`: (workflowId: string, stepId: string, requirements: WorkflowStep['requirements']) => void
- `updateStepAssignment`: (workflowId: string, stepId: string, assignedTo: WorkflowStep['assignedTo']) => void

**WorkflowProvider Component**
- Loads workflows and conversations from localStorage on mount
- Syncs to localStorage on any change
- Persists both workflows and conversations separately

**Workflow Operations**
- `addWorkflow`: Upserts workflow (updates if exists by ID, adds if new)
- `updateWorkflow`: Patches workflow and sets updatedAt
- `deleteWorkflow`: Removes by ID
- `activateWorkflow`: Sets status to 'active' and updates timestamp

**Conversation Operations**
- `addConversation`: Creates or updates conversation by ID
- `updateConversation`: Updates messages array and timestamp
- `getConversationByWorkflowId`: Finds conversation linked to workflow

**Step-Level Operations**
- `updateStepRequirements`: Updates requirements object for specific step
- `updateStepAssignment`: Updates assignedTo for specific step
- Both preserve workflow updatedAt timestamp

**useWorkflows() Hook**
- Returns WorkflowContextType
- Throws error if used outside WorkflowProvider

**Storage Keys**
- 'workflows' in localStorage
- 'conversations' in localStorage

---

### 3.3 TeamContext.tsx

**Purpose**: Manages organizational structure (team members and digital workers).

**TeamContextType Interface**
- `team`: NodeData[]
- `setTeam`: (team: NodeData[]) => void
- `addNode`: (node: NodeData) => void
- `updateNode`: (name: string, updates: Partial<NodeData>) => void
- `toggleNodeStatus`: (name: string) => void
- `assignWorkflowToNode`: (nodeName: string, workflowId: string) => void
- `removeWorkflowFromNode`: (nodeName: string, workflowId: string) => void
- `getDefaultDigitalWorker`: () => NodeData | undefined
- `ensureDefaultDigitalWorker`: () => void

**Default Digital Worker**
```json
{
  "name": "default",
  "type": "ai",
  "status": "inactive",
  "assignedWorkflows": []
}
```

**TeamProvider Component**
- Initializes with default digital worker if empty
- Syncs to localStorage on changes
- Ensures default digital worker always exists

**Team Operations**
- `addNode`: Adds node if not already exists (duplicate check)
- `updateNode`: Updates specific node fields
- `toggleNodeStatus`: Toggles between 'active' and 'inactive'
- `assignWorkflowToNode`: Adds workflow ID to node's assignedWorkflows (no duplicates)
- `removeWorkflowFromNode`: Removes workflow ID from assignedWorkflows
- `getDefaultDigitalWorker`: Finds node where name='default' and type='ai'
- `ensureDefaultDigitalWorker`: Ensures default digital worker exists in team

**useTeam() Hook**
- Returns TeamContextType
- Throws error if used outside TeamProvider

**Storage Keys**
- 'team' in localStorage

**Display Name Mapping**
- Internal name 'default' displays as 'Digi' in UI
- Used in Screen2OrgChart and Screen4ControlRoom

---

## 4. COMPONENTS

### 4.1 App.tsx

**Root Component**
- Wraps entire app with three providers: AppProvider → WorkflowProvider → TeamProvider
- Handles Gmail OAuth callback detection and processing
- Routes to screen components based on activeTab

**AppContent Component**
- Renders Sidebar + current screen
- Handles Gmail auth flow:
  1. Checks for `/auth/gmail/callback` path and `code` parameter
  2. Calls handleGmailCallback
  3. Shows error alert if callback fails
  4. Cleans up URL on success

**Screen Routing**
- 'create-task' → Screen1Consultant
- 'workflows' → Screen3Workflows
- 'team' → Screen2OrgChart
- 'control-room' → Screen4ControlRoom

---

### 4.2 Sidebar.tsx

**Props Interface**
- `user?`: {name, title, avatar?}

**Tabs Configuration**
```typescript
[
  { id: 'create-task', label: 'Create a Task', icon: FileText },
  { id: 'workflows', label: 'Your Workflows', icon: Workflow },
  { id: 'team', label: 'Your Team', icon: Users },
  { id: 'control-room', label: 'Control Room', icon: Monitor }
]
```

**UI Structure**
- Logo area: "Workflow.ai" with W icon
- Navigation list with tab buttons
- User profile section at bottom with initials avatar

**Styling**
- Active tab: gray-lighter background
- Logo color: gray-dark
- Height: full screen with flex column layout
- Width: 256px (w-64)

---

### 4.3 Screen1Consultant.tsx

**Purpose**: Conversational workflow discovery interface.

**Props**: None (uses contexts)

**State Variables**
- `messages`: ConversationMessage[] - Chat history
- `inputValue`: string - Input field content
- `isLoading`: boolean - API request in progress
- `questionCount`: number - Questions asked by consultant
- `sessionId`: string | null - Current session ID
- `currentWorkflowId`: string | null - Extracted workflow ID
- `showPlusMenu`: boolean - Plus button menu visibility
- `gmailConnected`: boolean - Gmail auth status

**Key Features**

**Automatic Workflow Extraction**
- Debounced (500ms) background extraction after each message
- Uses extractWorkflowFromConversation from geminiService
- Updates workflow if exists, adds if new
- Links conversation to workflow via workflowId

**Example Workflows**
- Nightly Security Check
- Spoilage Detection
- Financial Autopilot
- Sales Response
Each with title, description, icon, and starter prompt

**Plus Menu**
- Upload File option (placeholder)
- Connect Gmail option (disabled if already connected)
- Opens above plus button
- Closes when clicking outside

**Message Handling**
- `handleSend`: Send user message, get consultant response, update conversation
- `handleExampleClick`: Send example workflow prompt
- Consultant response includes isComplete flag
- Question count incremented if not complete
- Input disabled when isLoading or max questions reached

**Gmail Integration**
- Checks authentication status every 2 seconds
- Displays "Gmail Connected" when authenticated
- Initiates OAuth flow when clicked
- Shows connection errors in alert

**UI Layout**
- Header: back button, session info
- Messages area: scrollable, user messages right-aligned, system messages left
- Loading indicator: animated dots
- Input area: plus menu, text input, mic button (placeholder), send button

---

### 4.4 Screen3Workflows.tsx

**Purpose**: Workflow management and activation interface.

**Props**: None (uses contexts and services)

**State Variables**
- `selectedWorkflowId`: string | null
- `selectedStepId`: string | null
- `isRequirementsMode`: boolean - Showing requirements gatherer
- `showActivationModal`: boolean
- `activationMessage`: {type, title, message, errors?}

**Key Features**

**Two-Panel Layout**
- Left panel: Workflow list with selection
- Right panel: Selected workflow details

**Workflow List**
- Cards showing name, step count, status
- Selected workflow has ring-2 ring-accent-blue
- Empty state message and icon

**Workflow Details**
- Header: workflow name, description, activate button
- Flowchart visualization via WorkflowFlowchart component
- Shows all steps with connections

**Step Configuration**
- Clicking step enters RequirementsGatherer full-screen mode
- Back button returns to workflow view

**Workflow Activation**
- Calls checkWorkflowReadiness
- On success: activates and shows success modal
- On failure: shows error modal with list of issues to resolve
- Issues include: missing requirements, incomplete steps, missing Gmail auth

**Modal Dialogs**
- Success: Green checkmark, confirmation message, "Got it" button
- Error: Red X, error message, list of required fixes, "OK" button

---

### 4.5 Screen2OrgChart.tsx

**Purpose**: Team organization visualization using D3 hierarchical layout.

**Props**: None (uses contexts)

**Key Features**

**D3 Organization Chart**
- Creates tree hierarchy with user at root
- Digital workers as children of user
- Zoom/pan capability
- Smooth Bezier link curves

**D3 Configuration**
- nodeSize: [200, 200] - vertical and horizontal spacing
- Tree layout with centered initial view
- Zoom extent: [0.1, 3x]
- Centers on root node with initial scale 0.75

**Node Visualization**
- Avatars: Light blue for AI, light pink for human
- Name, role, and status indicator
- Active status: green oval with "ACTIVE" badge
- Inactive/needs attention: small colored dot

**Node Styling**
- AI: #DBEAFE background, #93C5FD border
- Human: #FCE7F3 background, #F9A8D4 border
- Status badge: green (#10B981) for active

**Interactions**
- Click node to select
- Pan by dragging canvas
- Zoom with mouse wheel/trackpad

**Workflow Assignment**
- Selected node shows workflow assignment UI
- Dropdown to select workflow
- Button to assign workflow to node
- Logs assignment via activityLogService

**Digital Worker Activation**
- Toggle node status (active/inactive)
- Activating triggers workflow execution if assigned
- Calls startWorkflowExecution from workflowExecutionService
- Logs activation via logDigitalWorkerActivation

**Agent Building**
- When workflow assigned, calls buildAgentsFromWorkflowRequirements
- Creates agents for the workflow
- Logs agent building process
- Ready for execution

---

### 4.6 Screen4ControlRoom.tsx

**Purpose**: Real-time monitoring dashboard for workflow execution and review management.

**Props**: None (uses contexts and services)

**State Variables**
- `watchingItems`: {id, name, workflow}[] - Active digital workers
- `reviewItems`: ReviewItem[] - Items needing human review
- `completedItems`: CompletedItem[] - Finished items
- `expandedChatId`: string | null - Expanded review chat
- `chatMessages`: Record<string, string> - Input for each review item

**Key Features**

**Kanban Board Layout**
- Three columns: Active Digital Workers, Needs Review, Completed
- Cards for each item with status
- Horizontal scroll if needed

**Active Digital Workers Column**
- Shows currently running workflows
- Synced from team state (filters active AI nodes)
- Cards show worker name, role, assigned workflow
- Avatar with initials

**Needs Review Column**
- Review items requiring human decision
- Shows action type, step name, message
- Chat interface for guidance
- Approve/Reject buttons

**Chat Interface for Guidance**
- Expandable chat area per review item
- Shows existing chat history
- Input field to provide guidance
- Send button
- Auto-scrolls to latest message

**Completed Column**
- Completed workflow executions
- Shows goal/objective, timestamp
- Read-only display
- Auto-removes from watching when completed

**Event Handling**
- Listens for 'controlRoomUpdate' custom event
- Handles three event types:
  1. **workflow_update**: Updates watching items
  2. **review_needed**: Adds review items
  3. **completed**: Moves to completed, removes from watching

**Review Item Actions**
- `handleApprove`: Calls approveReviewItem, removes from list
- `handleReject`: Calls rejectReviewItem, removes from list
- `handleSendGuidance`: Adds message to chat history, calls provideGuidanceToReviewItem

---

### 4.7 RequirementsGatherer.tsx

**Purpose**: Step-by-step requirements configuration interface.

**Props Interface**
- `workflowId`: string
- `step`: WorkflowStep
- `workflowName?`: string
- `stepIndex?`: number
- `onComplete`: () => void
- `onBack?`: () => void

**State Variables**
- `messages`: ConversationMessage[] - Requirements gathering chat
- `inputValue`: string
- `isLoading`: boolean
- `blueprint`: {greenList, redList, outstandingQuestions?}
- `requirementsText`: string
- `showPlusMenu`: boolean
- `uploadedFiles`: File[]
- `gmailConnected`: boolean

**Key Features**

**Dual API Approach**
- gatherRequirementsConversation: Returns conversational response
- buildAutomation: Extracts blueprint/requirements in parallel
- Both called simultaneously, results merged

**Context Integration**
- Loads Create a Task conversation for context
- Passes context to both Gemini calls
- Provides workflow background to agent

**Requirements Extraction**
- requirementsText: Natural language summary
- blueprint.greenList: Allowed actions
- blueprint.redList: Forbidden actions
- blueprint.outstandingQuestions: Unanswered clarifications

**Persistence**
- Saves to step.requirements after each exchange
- Stores chatHistory in requirements
- Preserves conversation if reopening step
- Loads existing requirements on mount

**Two-Column Layout**
- Left: Chat interface
- Right: Extracted requirements sidebar (details vary)

**Chat Interface**
- Initial message auto-sends on first load (if no existing history)
- Message exchange updates blueprint silently
- Users see conversational responses
- All data saved to step requirements

**Mark Complete Button**
- Marks requirements as isComplete: true
- Saves blueprint and chat history
- Calls onComplete callback
- Returns to workflow view

**File Upload** (Placeholder)
- Plus button menu with file upload option
- Files stored in local state
- Future: could be used for reference documents

**Gmail Integration**
- Checks connection status periodically (every 2s)
- Saves to integrations.gmail in requirements
- Reflects in email-related blueprint constraints

---

### 4.8 WorkflowFlowchart.tsx

**Purpose**: Visual representation of workflow steps with serpentine layout.

**Props Interface**
- `steps`: WorkflowStep[]
- `selectedStepId?`: string
- `onStepClick?`: (stepId: string) => void

**Layout Configuration**
- CARD_WIDTH: 240px
- CARD_HEIGHT: 140px
- HORIZONTAL_GAP: 280px
- VERTICAL_GAP: 220px
- CARDS_PER_ROW: 3
- Serpentine pattern: rows alternate left-to-right and right-to-left

**Step Positioning**
- Calculated via calculatePosition function
- Even rows: left to right
- Odd rows: right to left (reversed)
- Creates snake-like flow pattern

**Step Card Styling**
- AI-assigned: Greyish blue (#C4D1E3)
- Human-assigned: Peach (#F5C9B8)
- Unassigned: Default to AI blue
- Decision steps: Dashed border
- Regular steps: Solid border

**Step Type Labels**
- trigger → TRIGGER
- action → ACTION
- decision → CHECK
- end → END

**Status Badges**
- Complete: Green checkmark
- Needs attention: Yellow warning indicator
- Only shown on AI-assigned action/decision steps

**Interactions**
- Click step to select (if onStepClick provided)
- Pan by dragging canvas (drag detection prevents click)
- Dragging sets wasDragging flag briefly

**Connection Arrows**
- SVG path lines connecting steps
- Arrows point from current step to next in sequence
- Follows serpentine layout pattern

**Rendering**
- Canvas-based drawing
- Pan state stored locally
- Hover state for step highlighting
- Selected step gets visual emphasis

---

### 4.9 GmailAuth.tsx

**Purpose**: Gmail authentication status display and connection control.

**Props**: None (uses services)

**State Variables**
- `authState`: GmailAuthState | null
- `isLoading`: boolean

**UI Display**
- Mail icon + status text
- Shows account email if connected
- Shows "Not connected" if not authenticated

**Actions**
- If connected: Shows green checkmark + Disconnect button
- If not connected: Shows X icon + Connect Gmail button
- Connect button initiates OAuth flow
- Disconnect button signs out

**Auto-Refresh**
- Checks auth status every 1 second
- Updates button state in real-time

**Error Handling**
- Catches auth errors and logs
- Disables button during loading
- Shows "Connecting..." text while loading

---

### 4.10 UI Components

**Button.tsx**
- Variants: primary (gray-dark), secondary (gray-lighter), ghost (transparent)
- Sizes: sm, md, lg
- States: hover, focus (ring), disabled
- Forward ref support
- Default: primary/md

**Card.tsx**
- Variants: default (plain), outlined (border), elevated (shadow)
- Border radius: lg (0.5rem)
- Padding: 1rem (p-4)
- Forward ref support

**Input.tsx**
- Border color: gray-lighter
- Focus state: ring-2 ring-gray-dark
- Disabled state: opacity-50
- Error variant: red border and ring
- Placeholder text: gray-darker
- Forward ref support

**Modal.tsx**
- Fixed overlay with 50% opacity backdrop
- Centered content
- Sizes: sm (md), md (lg), lg (2xl), xl (4xl)
- Auto scrolls if content exceeds max-height
- Close button in header if title provided
- Prevents body scroll when open
- Click outside to close (modal click-through handled)

---

## 5. UTILITIES & CONSTANTS

### 5.1 constants.ts

**Storage Keys**
```typescript
STORAGE_KEYS = {
  WORKFLOWS: 'workflows',
  CONVERSATIONS: 'conversations',
  TEAM: 'team',
  GMAIL_AUTH: 'gmail_auth',
  REQUIREMENTS: 'requirements',
  APP_STATE: 'app_state'
}
```

**Gemini Configuration**
```typescript
GEMINI_CONFIG = {
  MODEL: 'gemini-3-pro-preview',
  MAX_QUESTIONS: 5,  // Max questions in consultant mode
  TEMPERATURE: 0.7   // LLM creativity parameter
}
```

**Workflow Configuration**
```typescript
WORKFLOW_CONFIG = {
  EXTRACTION_DEBOUNCE_MS: 500,     // Debounce for background extraction
  DEFAULT_DIGITAL_WORKER_NAME: 'default'
}
```

**Control Room Event**
```typescript
CONTROL_ROOM_EVENT: 'controlRoomUpdate'  // Custom event type
```

### 5.2 storage.ts

**Purpose**: Unified localStorage abstraction with type safety.

**Functions**

**getWorkflows(): Workflow[]**
- Parses stored workflows JSON
- Converts date strings back to Date objects
- Returns empty array on parse error

**saveWorkflows(workflows: Workflow[]): void**
- Serializes and stores workflows
- Logs errors on failure

**getConversations(): ConversationSession[]**
- Parses and deserializes conversations
- Reconstructs message timestamps
- Returns empty array on failure

**saveConversations(conversations: ConversationSession[]): void**
- Serializes conversation sessions

**getTeam(): NodeData[]**
- Parses team/org structure
- Returns empty array on failure

**saveTeam(team: NodeData[]): void**
- Serializes team data

**getGmailAuth(): GmailAuthState | null**
- Retrieves auth state
- Returns null if not set or parse fails

**saveGmailAuth(auth: GmailAuthState): void**
- Stores Gmail authentication state

**getAppState(): AppState | null**
- Retrieves app-wide state (active tab, user)

**saveAppState(state: AppState): void**
- Persists app state

**clearAll(): void**
- Removes all app data from localStorage
- Iterates through all STORAGE_KEYS

### 5.3 validation.ts

**Purpose**: Workflow and step validation helpers.

**Functions**

**isWorkflowValid(workflow: Workflow): boolean**
- Checks: name is not empty
- Checks: has at least one step
- Returns validation result

**areRequirementsComplete(step: WorkflowStep): boolean**
- Checks: step.requirements exists
- Checks: isComplete flag is true
- Returns boolean

**isWorkflowReady(workflow: Workflow): boolean**
- Checks: workflow is in 'draft' status
- Checks: structurally valid
- Checks: all non-trigger/non-end steps have complete requirements
- Returns boolean (all checks must pass)

**hasGmailIntegration(step: WorkflowStep): boolean**
- Checks: integrations.gmail === true
- Returns boolean

**requiresGmailAuth(workflow: Workflow): boolean**
- Checks: any step requires Gmail
- Uses hasGmailIntegration for each step
- Returns boolean

### 5.4 cn.ts (Component Utils)

**Purpose**: Utility for merging Tailwind CSS classes intelligently.

**`cn(...inputs: ClassValue[]): string`**
- Combines clsx for class composition with tailwind-merge for conflict resolution
- Prevents duplicate/conflicting Tailwind classes
- Returns merged class string
- Used throughout all components for dynamic styling

---

## 6. DATA FLOW ARCHITECTURE

### 6.1 Workflow Creation Flow

```
User Input (Screen1Consultant)
  ↓
consultWorkflow() → Gemini LLM analyzes conversation
  ↓
extractWorkflowFromConversation() → Parses workflow structure (debounced 500ms)
  ↓
addWorkflow() → Stores in WorkflowContext
  ↓
saveWorkflows() → Persists to localStorage
```

### 6.2 Requirements Gathering Flow

```
User selects step (Screen3Workflows)
  ↓
RequirementsGatherer component loads
  ↓
getInitialRequirementsMessage() → Initial prompt from Gemini
  ↓
User sends message
  ↓
[Parallel]
├─ gatherRequirementsConversation() → Conversational response
└─ buildAutomation() → Extract blueprint/constraints
  ↓
updateStepRequirements() → Update WorkflowContext
  ↓
saveWorkflows() → Persist to localStorage
```

### 6.3 Workflow Activation Flow

```
User clicks "Activate Workflow" (Screen3Workflows)
  ↓
checkWorkflowReadiness() → Validates requirements
  ↓
If ready:
  activateWorkflow() → Changes status to 'active'
  ↓
  buildAgentsFromWorkflowRequirements() → LLM groups steps into agents
  ↓
  Agents stored (ready for execution)

If not ready:
  Show error modal with issues
```

### 6.4 Workflow Execution Flow

```
User toggles digital worker active (Screen2OrgChart)
  ↓
toggleNodeStatus() → Activates digital worker
  ↓
startWorkflowExecution(workflowId, workerName)
  ↓
executeWorkflowSteps() → Sequential loop
  ├─ For each step:
  │  ├─ executeAgentStep(step)
  │  │  ├─ Skip if human-assigned
  │  │  ├─ executeAgentAction() → Gemini decides actions
  │  │  ├─ Check for guidance requests → Pause if needed
  │  │  ├─ Check for approval required → Pause if decision step
  │  │  └─ Log step completion
  │  ├─ Increment currentStepIndex
  │  └─ 1-second delay before next step
  │
  └─ completeWorkflow() when done
  ↓
emitControlRoomUpdate() → Send events to Control Room
  ↓
Control Room receives event via window listener
  ↓
Screen4ControlRoom updates state accordingly
```

### 6.5 Human Review Flow

```
Agent requests guidance or action needs approval
  ↓
emitControlRoomUpdate(type: 'review_needed')
  ↓
Screen4ControlRoom receives event
  ↓
ReviewItem added to reviewItems array
  ↓
Display in "Needs Review" column
  ↓
User provides guidance (optional chat)
  ↓
User clicks Approve or Reject
  ↓
approveReviewItem() or rejectReviewItem()
  ↓
If approve: Continue execution from current step
  If reject: Log rejection, stay paused

If guidance was provided:
  Store in ReviewItem.chatHistory
  Pass to agent when resuming via executeAgentAction
```

### 6.6 Gmail Integration Flow

```
User clicks "Connect Gmail" (Screen1Consultant)
  ↓
initiateGmailAuth()
  ↓
Generate PKCE code_verifier and code_challenge
  ↓
Store verifier in sessionStorage
  ↓
Redirect to Google OAuth endpoint
  ↓
User authorizes app
  ↓
Redirect back to /auth/gmail/callback?code=...
  ↓
App.tsx detects callback
  ↓
handleGmailCallback(code)
  ↓
Exchange code for tokens
  ↓
saveGmailAuth() → Store tokens in localStorage
  ↓
Clean URL, redirect to /
  ↓
Screen1Consultant detects authenticated (periodic check)
  ↓
"Connect Gmail" button becomes "Gmail Connected"
```

---

## 7. EVENT SYSTEM

### 7.1 Custom Events

**Control Room Update Event**
- Event name: 'controlRoomUpdate'
- Dispatched by: workflowExecutionService.ts
- Listener: Screen4ControlRoom.tsx
- Payload type: CustomEvent<ControlRoomUpdate>
- Event types:
  - `workflow_update`: Step completed, workflow progressing
  - `review_needed`: Human review required
  - `completed`: Workflow finished

**Activity Log Update Event**
- Event name: 'digital_worker_log_update'
- Dispatched by: activityLogService.ts
- Listener: (Currently no listener, fires for real-time sync)
- Payload: LogEntry

### 7.2 Context Change Propagation

- WorkflowContext changes → All components using useWorkflows() re-render
- TeamContext changes → All components using useTeam() re-render
- AppContext changes → All components using useApp() re-render
- Storage updates trigger useEffect listeners watching context values

---

## 8. EXTERNAL API INTEGRATIONS

### 8.1 Google Gemini API

**Endpoint**: Not explicit (via GoogleGenerativeAI SDK)

**Model**: gemini-3-pro-preview

**Prompt Types**

1. **Workflow Consultant** - consultWorkflow()
   - Input: Conversation history
   - Analyzes user's workflow needs
   - Returns: Conversational response + completion flag
   - System prompt: 300+ lines covering platform features, interaction style, question limits

2. **Workflow Extraction** - extractWorkflowFromConversation()
   - Input: Conversation messages
   - Extracts: Steps, labels, types, assignments
   - Returns: Workflow JSON structure
   - Auto-classifies as trigger/action/decision/end
   - Auto-assigns to AI or human based on context

3. **Requirements Building** - buildAutomation()
   - Input: Step, conversation, Create-a-Task context
   - Extracts: greenList, redList, outstanding questions
   - Returns: Blueprint constraints
   - Iterative relationship with questions

4. **Requirements Conversation** - gatherRequirementsConversation()
   - Input: Step, conversation history, context
   - Outputs: Conversational response
   - Acknowledges user input
   - Natural follow-up questions

5. **Initial Requirements Message** - getInitialRequirementsMessage()
   - Input: Step, workflow name, context
   - Outputs: Friendly opening message for requirements mode

6. **Agent Grouping** - buildAgentsFromWorkflowRequirements()
   - Input: Complete workflow with all steps
   - Analyzes: Integration requirements, action types
   - Returns: Grouped agents with blueprints
   - Logs building start/complete with timing

7. **Agent Execution** - executeAgentAction()
   - Input: Step, blueprint, guidance context, integrations
   - LLM decides: Which actions to take
   - Validates against: green/red lists
   - Returns: Actions to execute, guidance requests
   - JSON response parsed and validated

8. **Agent Context** - extractAgentContext()
   - Input: Agent config, workflow
   - Returns: Agent context summary
   - Used for documentation/understanding

9. **People Extraction** - extractPeopleFromConversation()
   - Input: Conversation history
   - Returns: Array of extracted people (NodeData)
   - Auto-classifies as AI or human
   - Used for team org chart

### 8.2 Google Gmail API

**Base URL**: https://www.googleapis.com/gmail/v1

**Authentication**: OAuth 2.0 with PKCE

**Endpoints**

1. **OAuth Token Exchange**
   - URL: https://oauth2.googleapis.com/token
   - Method: POST
   - Payload: {client_id, client_secret, code, code_verifier, grant_type}
   - Returns: {access_token, refresh_token, expires_in, ...}

2. **OAuth Token Refresh**
   - URL: https://oauth2.googleapis.com/token
   - Method: POST
   - Payload: {client_id, refresh_token, grant_type: 'refresh_token'}
   - Returns: {access_token, expires_in, ...}

3. **Get Gmail Profile**
   - URL: /users/me/profile
   - Method: GET
   - Auth: Bearer token
   - Returns: {emailAddress, messagesTotal, threadsTotal, ...}

4. **Send Email**
   - URL: /users/me/messages/send
   - Method: POST
   - Auth: Bearer token
   - Payload: {raw: base64url-encoded message}
   - Message format: RFC 2822 (To, Subject, body)

5. **List Messages**
   - URL: /users/me/messages?maxResults={n}
   - Method: GET
   - Auth: Bearer token
   - Returns: {messages: [{id, threadId, labelIds}, ...]}
   - Note: Full message body requires separate request per message

**Scopes**
- https://www.googleapis.com/auth/gmail.send
- https://www.googleapis.com/auth/gmail.modify

**Error Handling**
- 400: Bad request (invalid_grant, redirect_uri_mismatch, invalid_client)
- 401: Unauthorized (invalid credentials)
- Other: Generic error with error_description

---

## 9. LOCALSTORAGE SCHEMA

### 9.1 Storage Structure

**Key: 'workflows'**
```json
[
  {
    "id": "workflow-${timestamp}",
    "name": "Workflow Name",
    "description": "...",
    "steps": [
      {
        "id": "step-1",
        "label": "Step Label",
        "type": "trigger|action|decision|end",
        "order": 0,
        "assignedTo": {"type": "ai|human", "agentName": "..."},
        "requirements": {
          "isComplete": true,
          "requirementsText": "...",
          "chatHistory": [...],
          "integrations": {"gmail": true},
          "customRequirements": [...],
          "blueprint": {
            "greenList": [...],
            "redList": [...],
            "outstandingQuestions": [...]
          }
        }
      }
    ],
    "assignedTo": {"stakeholderName": "...", "stakeholderType": "ai|human"},
    "status": "draft|active|paused",
    "createdAt": "2024-01-30T...",
    "updatedAt": "2024-01-30T..."
  }
]
```

**Key: 'conversations'**
```json
[
  {
    "id": "session-${timestamp}",
    "workflowId": "workflow-...",
    "messages": [
      {"sender": "user|system", "text": "...", "timestamp": "2024-01-30T..."}
    ],
    "createdAt": "2024-01-30T...",
    "updatedAt": "2024-01-30T..."
  }
]
```

**Key: 'team'**
```json
[
  {
    "name": "default",
    "type": "ai",
    "status": "active|inactive",
    "assignedWorkflows": ["workflow-id-1", "workflow-id-2"],
    "role": "Digital Worker Description",
    "children": []
  },
  {
    "name": "Human Name",
    "type": "human",
    "status": "active|inactive",
    "assignedWorkflows": [],
    "role": "CEO",
    "children": []
  }
]
```

**Key: 'gmail_auth'**
```json
{
  "authenticated": true,
  "account": "user@gmail.com",
  "accessToken": "ya29...",
  "refreshToken": "1//...",
  "expiresAt": 1706614800000
}
```

**Key: 'app_state'**
```json
{
  "activeTab": "create-task|workflows|team|control-room",
  "user": {
    "name": "Chitra M.",
    "title": "CEO, Treasure Blossom"
  }
}
```

**Key: 'digital_worker_activity_logs'** (activityLogService.ts)
```json
[
  {
    "id": "1706614800000-abc123def",
    "timestamp": "2024-01-30T...",
    "type": "digital_worker_activation|agent_building_start|...",
    "digitalWorkerName": "default",
    "workflowId": "workflow-...",
    "stepId": "step-...",
    "data": {
      "assignedWorkflows": [...],
      "agentNames": [...],
      ...
    },
    "metadata": {
      "duration": 1234,
      "error": "...",
      "agentsCreated": [...],
      "stepsProcessed": 5
    }
  }
]
```

---

## 10. ENVIRONMENT VARIABLES

**Required**
- `VITE_GEMINI_API_KEY`: Google Gemini API key (can be empty, shows warning)
- `VITE_GMAIL_CLIENT_ID`: Google OAuth client ID
- `VITE_GMAIL_CLIENT_SECRET`: Google OAuth client secret

**Validation**
- Gemini service warns if API key not set
- Gmail service throws error if client ID not configured
- Client secret used in token exchange (server-side security)

---

## 11. DEPENDENCIES & VERSIONS

**Core Framework**
- react: ^19.0.0
- react-dom: ^19.0.0

**UI/Styling**
- lucide-react: ^0.468.0 - Icons
- tailwindcss: ^3.4.17 - CSS framework
- clsx: ^2.1.1 - Class composition
- tailwind-merge: ^3.4.0 - Class conflict resolution

**Data/APIs**
- @google/generative-ai: ^0.21.0 - Gemini API SDK
- d3: ^7.8.5 - Visualization, org chart

**Build Tools**
- vite: ^6.0.5
- typescript: ^5.7.2
- eslint: ^8.57.1
- prettier: ^3.4.2

---

## 12. KEY ARCHITECTURAL PATTERNS

### 12.1 Context-Based State Management
- Three context providers: App, Workflow, Team
- Automatic localStorage sync on context changes
- No Redux/Zustand - using React's native context API

### 12.2 Service-Based Business Logic
- Services encapsulate API calls and complex logic
- LLM integration centralized in geminiService.ts
- External API calls isolated in dedicated services
- Activity logging as cross-cutting concern

### 12.3 Component Organization
- Screen components: Tab-level views (Screen1-4)
- Feature components: RequirementsGatherer, WorkflowFlowchart
- UI components: Reusable primitives (Button, Card, Input, Modal)
- Context hooks separate from component logic

### 12.4 Event-Driven Execution
- Custom events for Control Room updates
- Window event dispatching for real-time communication
- Asynchronous event listeners prevent blocking

### 12.5 Conversational AI Integration
- Two-phase LLM interaction: Discovery + Requirements
- Background extraction doesn't block UI
- Debouncing prevents excessive API calls
- Prompt engineering heavily documented in service files

### 12.6 Graceful Degradation
- Gmail optional - workflows work without Gmail
- Requirements optional - can activate with basic setup
- Digital worker optional - human steps can be used
- Error boundaries with user-friendly messages

---

## 13. CRITICAL IMPLEMENTATION DETAILS

### 13.1 PKCE OAuth Flow
- Code verifier: 32-byte random value (base64url encoded)
- Code challenge: SHA-256(verifier)
- Verifier stored in sessionStorage (not localStorage) for security
- Cleaned up after successful auth

### 13.2 Workflow State Machine
```
┌────────────────────────────────────────────┐
│ Draft (Initial)                            │
│ - Collecting requirements                  │
│ - Can add/edit steps                       │
│ - Cannot execute                           │
└────────────┬───────────────────────────────┘
             │ User clicks "Activate"
             │ (After validation)
             ▼
┌────────────────────────────────────────────┐
│ Active (Ready)                             │
│ - Can be executed                          │
│ - Cannot add/edit steps                    │
│ - Can pause                                │
└────────────┬───────────────────────────────┘
             │ Execution running
             ▼
┌────────────────────────────────────────────┐
│ Paused (During execution)                  │
│ - Waiting for human review                 │
│ - Waiting for guidance                     │
│ - Can resume with approval                 │
└────────────────────────────────────────────┘
```

### 13.3 Step Execution State Machine
```
Each step goes through:
1. Pending (waiting to execute)
2. Executing (LLM deciding actions)
3. Awaiting Guidance (if agent requests)
4. Awaiting Approval (if decision step)
5. Complete (successful)
6. Error (failed - can retry with guidance)
```

### 13.4 Debouncing Pattern
- Workflow extraction: 500ms debounce
- Prevents API call on every keystroke
- Clears previous timeout before setting new one
- Used in Screen1Consultant for real-time extraction

### 13.5 Question Count Tracking
- Incremented after each user message (unless consultant marks complete)
- Max 5 questions per GEMINI_CONFIG
- Input disabled when limit reached
- Consultant auto-wraps up at max

---

## 14. SECURITY CONSIDERATIONS

### 14.1 Token Management
- Access tokens: Stored in localStorage (necessary for client-side Gmail API)
- Refresh tokens: Also stored (needed for token refresh)
- Expiration tracking: expiresAt timestamp checked before use
- Auto-refresh: If expired, refreshGmailToken called automatically

### 14.2 PKCE Security
- Code verifier: 32-byte random, only in sessionStorage (cleared on redirect)
- Code challenge: Sent to auth endpoint, verifier never exposed
- Prevents authorization code interception attacks

### 14.3 API Key Management
- Gemini API key: Environment variable only (never in code)
- Gmail Client ID: Environment variable
- Gmail Client Secret: Environment variable (not exposed to client)

### 14.4 Input Validation
- Workflow names: Required, non-empty
- Step labels: Required strings
- Email parameters: Validated before sending
- Blueprint constraints: Validated against LLM responses

### 14.5 Data Storage
- localStorage used for persistence (client-side only)
- No server backend - all data local
- User responsible for browser security
- Can clear all data via storage.clearAll()

---

## 15. PERFORMANCE OPTIMIZATIONS

### 15.1 Debouncing
- Workflow extraction: 500ms debounce (extractWorkflowFromConversation)
- Prevents excessive Gemini API calls while typing

### 15.2 Parallel API Calls
- RequirementsGatherer: Calls gatherRequirementsConversation and buildAutomation in parallel
- Uses Promise.all for concurrent execution
- Improves perceived performance

### 15.3 Step Delays
- 1-second delay between workflow steps
- Prevents overwhelming system
- Allows for cancellation/intervention

### 15.4 Lazy Evaluation
- Org chart: Only renders when selected
- Requirements: Only load existing chat if reopening
- Components: Only render when needed based on activeTab

### 15.5 Event Deduplication
- ReviewItems: Checked for existing before adding
- Team nodes: Duplicate check before adding
- Workflows: Update if exists, otherwise add

---

## 16. ERROR HANDLING PATTERNS

### 16.1 Service-Level
- Try-catch blocks in all async functions
- Console logging for debugging
- User-friendly error messages
- Specific error detection (guidance requests, PKCE errors)

### 16.2 Component-Level
- Error states in UI (disabled buttons, error messages)
- Loading states (spinners, disabled inputs)
- Validation before operations
- Modal dialogs for error confirmation

### 16.3 Graceful Degradation
- Gmail optional features
- Requirements gathering optional
- Alternative paths if APIs fail
- Fallback values for LLM responses

### 16.4 User Feedback
- Alert dialogs for critical errors
- Error modals with detailed information
- Toast-style messages (future enhancement)
- Inline validation messages

---

## APPENDIX A: GLOSSARY

- **Agent**: An AI entity configured to execute workflow steps
- **Blueprint**: Constraints defining what actions an agent can/cannot take
- **Digital Worker**: An AI worker assigned workflows (e.g., "default" worker)
- **GreenList**: Allowed actions in agent blueprint
- **RedList**: Forbidden actions in agent blueprint
- **NodeData**: Team member (AI or human) in org chart
- **ReviewItem**: A workflow step awaiting human review/approval
- **Stakeholder**: Human or AI entity in the workflow
- **Step**: Individual unit of work in a workflow
- **Workflow**: Sequence of steps defining a business process

---

## APPENDIX B: KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| src/types.ts | All TypeScript interfaces |
| src/utils/constants.ts | Configuration and constants |
| src/utils/storage.ts | localStorage abstraction |
| src/utils/validation.ts | Validation helpers |
| src/services/geminiService.ts | Gemini API integration |
| src/services/gmailService.ts | Gmail OAuth & API |
| src/services/agentExecutionService.ts | Agent action execution |
| src/services/workflowExecutionService.ts | Workflow orchestration |
| src/services/activityLogService.ts | Activity logging |
| src/contexts/AppContext.tsx | Global app state |
| src/contexts/WorkflowContext.tsx | Workflow state management |
| src/contexts/TeamContext.tsx | Team org structure |
| src/App.tsx | Root component |
| src/components/Screen1Consultant.tsx | Workflow discovery |
| src/components/Screen2OrgChart.tsx | Team org chart |
| src/components/Screen3Workflows.tsx | Workflow management |
| src/components/Screen4ControlRoom.tsx | Execution monitoring |
| src/components/RequirementsGatherer.tsx | Step configuration |

---

**END OF TECHNICAL SPECIFICATION DOCUMENT**
