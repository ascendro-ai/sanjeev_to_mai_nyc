# Comprehensive Testing Plan: Enterprise Agent Collaboration Platform

## Executive Summary

This document provides a complete testing strategy for the Enterprise AI Workflow Automation Platform. The platform currently has **zero tests** - no unit tests, integration tests, or E2E tests exist. This plan establishes a production-grade testing infrastructure.

**Key Stats:**
- 17 database tables with RLS
- 8 custom React hooks
- 12+ API routes (Gemini AI, n8n, Gmail)
- 6 UI components
- 3 external integrations (Supabase, Gemini, n8n)

---

## 1. Testing Framework Stack

| Tool | Purpose | Rationale |
|------|---------|-----------|
| **Vitest** | Unit/Integration tests | Native ESM, faster than Jest, TypeScript support |
| **React Testing Library** | Component testing | User-centric testing approach |
| **Playwright** | E2E testing | Superior browser automation, real-time feature testing |
| **MSW** | API mocking | Network-level interception across all test types |

### Package.json Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:ci": "vitest run --coverage && playwright test"
  }
}
```

---

## 2. Unit Tests

### 2.1 Custom Hooks (`/src/hooks/`)

#### `useWorkflows.ts`
```typescript
describe('useWorkflows', () => {
  describe('useWorkflows()', () => {
    it('should fetch all workflows ordered by created_at desc')
    it('should return empty array when no workflows exist')
    it('should handle fetch errors gracefully')
    it('should transform DbWorkflow to Workflow correctly')
  })

  describe('useWorkflow(id)', () => {
    it('should fetch single workflow by ID')
    it('should return null when workflowId is undefined')
    it('should handle non-existent workflow')
  })

  describe('addWorkflow mutation', () => {
    it('should create workflow with correct db format')
    it('should invalidate workflows query on success')
    it('should handle validation errors')
  })

  describe('updateWorkflow mutation', () => {
    it('should update workflow and set updated_at')
    it('should invalidate both list and single workflow queries')
  })

  describe('updateStatus mutation', () => {
    it('should update status and is_active flag')
    it('should handle all valid status transitions: draft -> active -> paused -> archived')
  })

  describe('updateSteps mutation', () => {
    it('should correctly transform WorkflowStep[] to db format')
    it('should preserve step order via order_index')
  })
})
```

#### `useTeam.ts`
```typescript
describe('useTeam', () => {
  describe('workers query', () => {
    it('should fetch all digital workers')
    it('should transform DbDigitalWorker to DigitalWorker')
  })

  describe('toOrgChartData', () => {
    it('should build correct hierarchy from flat worker list')
    it('should handle workers without managers as root nodes')
    it('should correctly nest direct reports')
  })

  describe('activateWorker/deactivateWorker', () => {
    it('should toggle worker status correctly')
  })
})
```

#### `useReviewRequests.ts`
```typescript
describe('useReviewRequests', () => {
  describe('pendingReviews query', () => {
    it('should fetch only pending status reviews')
    it('should order by created_at ascending (oldest first)')
  })

  describe('approveReview mutation', () => {
    it('should set status to approved with reviewer info')
    it('should set reviewed_at timestamp')
  })

  describe('rejectReview mutation', () => {
    it('should require feedback for rejection')
    it('should set status to rejected')
  })

  describe('addChatMessage mutation', () => {
    it('should append to existing chat_history')
    it('should handle empty initial chat_history')
  })
})
```

#### `useExecutions.ts`
```typescript
describe('useExecutions', () => {
  describe('executions query', () => {
    it('should fetch all executions with workflow data')
    it('should order by started_at descending')
  })

  describe('executionSteps query', () => {
    it('should fetch steps for specific execution')
    it('should order by started_at ascending')
  })

  describe('startExecution mutation', () => {
    it('should create execution with running status')
    it('should set trigger type correctly')
  })

  describe('updateExecutionStatus mutation', () => {
    it('should update status and set completed_at when finished')
  })
})
```

#### `useActivityLogs.ts`
```typescript
describe('useActivityLogs', () => {
  describe('activityLogs query', () => {
    it('should fetch recent activity logs')
    it('should limit to specified count')
    it('should order by created_at descending')
  })

  describe('addActivityLog mutation', () => {
    it('should create log with correct event type')
    it('should include actor and metadata')
  })
})
```

#### `useConversations.ts`
```typescript
describe('useConversations', () => {
  describe('conversations query', () => {
    it('should fetch all conversations')
    it('should transform messages correctly')
  })

  describe('addMessage mutation', () => {
    it('should append message to existing conversation')
    it('should create new conversation if none exists')
  })

  describe('clearConversation mutation', () => {
    it('should delete conversation by ID')
  })
})
```

#### `useRealtime.ts`
```typescript
describe('useRealtime', () => {
  it('should subscribe to specified tables on mount')
  it('should unsubscribe on unmount')
  it('should invalidate correct query keys on change events')
  it('should call custom callbacks with payload')
})

describe('useControlRoomRealtime', () => {
  it('should subscribe to executions, execution_steps, review_requests, activity_logs')
})
```

### 2.2 Utility Functions (`/src/lib/`)

#### `gemini/server.ts`
```typescript
describe('getModel', () => {
  it('should throw error when GEMINI_API_KEY is not set')
  it('should return configured model with correct model name')
  it('should use GEMINI_MODEL env var or default to gemini-2.0-flash')
})
```

#### `n8n/client.ts`
```typescript
describe('n8nRequest', () => {
  it('should include X-N8N-API-KEY header')
  it('should throw on non-ok response with error details')
  it('should handle JSON responses correctly')
})

describe('convertToN8NWorkflow', () => {
  it('should create trigger node for first step')
  it('should create AI action nodes with correct HTTP request config')
  it('should create human review nodes for human-assigned steps')
  it('should build correct connections between nodes')
  it('should handle decision and end node types')
})

describe('createN8NNode', () => {
  it('should create manualTrigger for trigger type')
  it('should create httpRequest for AI actions')
  it('should include platformWebhookUrl in node parameters')
})
```

#### `supabase/middleware.ts`
```typescript
describe('updateSession', () => {
  it('should redirect unauthenticated users to /login')
  it('should allow access to /login, /signup, /auth routes without auth')
  it('should allow access to root path without auth')
  it('should pass through authenticated requests')
  it('should properly set cookies on response')
})
```

#### `utils/cn.ts`
```typescript
describe('cn utility', () => {
  it('should merge class names correctly')
  it('should handle conditional classes')
  it('should deduplicate Tailwind classes')
})
```

### 2.3 UI Components (`/src/components/ui/`)

```typescript
// Button.test.tsx
describe('Button', () => {
  it('should render children correctly')
  it('should apply variant styles: primary, secondary, ghost, danger')
  it('should apply size styles: sm, md, lg')
  it('should show loading spinner when isLoading=true')
  it('should be disabled when isLoading=true')
  it('should forward ref correctly')
  it('should merge custom className')
  it('should call onClick handler when clicked')
  it('should not call onClick when disabled')
})

// Modal.test.tsx
describe('Modal', () => {
  it('should not render when isOpen=false')
  it('should render content when isOpen=true')
  it('should call onClose when clicking overlay')
  it('should call onClose when pressing Escape')
  it('should apply correct size classes')
  it('should trap focus within modal')
  it('should render title correctly')
})

// Card.test.tsx
describe('Card', () => {
  it('should render with default variant')
  it('should apply outlined variant styles')
  it('should support onClick when provided')
  it('should render header, content, and footer slots')
})

// Input.test.tsx
describe('Input', () => {
  it('should render with label')
  it('should show error state')
  it('should forward ref correctly')
  it('should handle onChange events')
  it('should support disabled state')
  it('should render helper text')
})

// SlideOver.test.tsx
describe('SlideOver', () => {
  it('should animate in/out correctly')
  it('should call onClose when clicking backdrop')
  it('should render title and content')
  it('should support different sizes')
  it('should render close button')
})
```

### 2.4 Context Providers (`/src/providers/`)

```typescript
// AuthProvider.test.tsx
describe('AuthProvider', () => {
  it('should provide user context')
  it('should handle session refresh')
  it('should redirect on signOut')
  it('should expose signIn and signOut methods')
})

// QueryProvider.test.tsx
describe('QueryProvider', () => {
  it('should provide React Query client')
  it('should configure default options correctly')
})
```

---

## 3. Integration Tests for API Routes

### 3.1 Gemini API Routes

```typescript
// POST /api/gemini/consult
describe('POST /api/gemini/consult', () => {
  it('should return 401 when not authenticated')
  it('should return 400 when messages array is missing')
  it('should return consultant response with isComplete=false when under MAX_QUESTIONS')
  it('should return isComplete=true when questionCount >= MAX_QUESTIONS')
  it('should detect final confirmation signals correctly')
  it('should acknowledge intermediate responses appropriately')
  it('should handle Gemini API errors gracefully')
  it('should include conversation context in prompt')
})

// POST /api/gemini/extract
describe('POST /api/gemini/extract', () => {
  it('should return 401 when not authenticated')
  it('should extract workflow from conversation messages')
  it('should generate step IDs if not provided')
  it('should correctly classify step types: trigger, action, decision, end')
  it('should auto-assign human/ai based on conversation context')
  it('should handle malformed JSON from Gemini gracefully')
  it('should return workflow with name and description')
  it('should handle empty conversation')
})

// POST /api/gemini/extract-people
describe('POST /api/gemini/extract-people', () => {
  it('should extract stakeholders from workflow description')
  it('should identify roles and responsibilities')
  it('should return structured people data')
})

// POST /api/gemini/requirements
describe('POST /api/gemini/requirements', () => {
  it('should gather requirements for workflow step')
  it('should generate clarifying questions')
  it('should produce blueprint with greenList and redList')
})

// POST /api/gemini/build-agents
describe('POST /api/gemini/build-agents', () => {
  it('should create agent configurations for workflow steps')
  it('should generate appropriate blueprints (greenList/redList)')
  it('should assign personality traits')
})
```

### 3.2 n8n Integration Routes

```typescript
// POST /api/n8n/webhook/[workflowId]
describe('POST /api/n8n/webhook/[workflowId]', () => {
  it('should trigger workflow execution')
  it('should return 404 for non-existent workflow')
  it('should create execution record')
  it('should log activity')
})

// POST /api/n8n/ai-action
describe('POST /api/n8n/ai-action', () => {
  it('should execute AI action with context')
  it('should return action result')
  it('should handle errors gracefully')
})

// POST /api/n8n/execution-update
describe('POST /api/n8n/execution-update', () => {
  it('should update execution step status')
  it('should store step output data')
  it('should create activity log entry')
})

// POST /api/n8n/execution-complete
describe('POST /api/n8n/execution-complete', () => {
  it('should update execution status to completed')
  it('should store output data')
  it('should create activity log entry')
  it('should set completed_at timestamp')
})

// POST /api/n8n/review-request
describe('POST /api/n8n/review-request', () => {
  it('should return 400 when missing executionId or reviewType')
  it('should create review_request record in database')
  it('should create activity_log entry')
  it('should return reviewId and pending status')
  it('should include callback URL for n8n')
})

// GET /api/n8n/review-request
describe('GET /api/n8n/review-request', () => {
  it('should return 400 when missing review ID')
  it('should return 404 for non-existent review')
  it('should return review details with chat history')
})

// POST /api/n8n/review-response
describe('POST /api/n8n/review-response', () => {
  it('should update review status based on action')
  it('should call n8n callback URL with response')
  it('should handle approval with optional feedback')
  it('should handle rejection with required feedback')
  it('should update reviewed_at and reviewer_id')
})

// POST /api/n8n/sync
describe('POST /api/n8n/sync', () => {
  it('should sync workflow data with n8n')
  it('should update n8n_workflow_id on success')
})
```

### 3.3 Gmail Integration Routes

```typescript
// POST /api/gmail/auth
describe('POST /api/gmail/auth', () => {
  it('should initiate OAuth flow')
  it('should return authorization URL')
})

// GET /api/gmail/callback
describe('GET /api/gmail/callback', () => {
  it('should exchange code for tokens')
  it('should store encrypted tokens')
  it('should redirect to success page')
})

// POST /api/gmail/send
describe('POST /api/gmail/send', () => {
  it('should send email via Gmail API')
  it('should handle missing tokens')
  it('should refresh expired tokens')
})
```

### 3.4 Auth Callback Route

```typescript
// GET /auth/callback
describe('GET /auth/callback', () => {
  it('should exchange code for session')
  it('should redirect to dashboard on success')
  it('should handle OAuth errors gracefully')
  it('should create user record if new user')
  it('should handle missing code parameter')
})
```

---

## 4. E2E Tests for Critical User Flows

### 4.1 Authentication Flow
```typescript
// /e2e/auth.spec.ts
describe('Authentication', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/workflows')
    await expect(page).toHaveURL('/login')
  })

  test('should login with email/password', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-btn"]')
    await expect(page).toHaveURL('/create')
  })

  test('should login with Google OAuth', async ({ page }) => {
    await page.goto('/login')
    await page.click('[data-testid="google-login-btn"]')
    // Mock OAuth flow
    await expect(page).toHaveURL('/create')
  })

  test('should signup new user', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('[data-testid="email-input"]', 'new@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="signup-btn"]')
    await expect(page.locator('text=Check your email')).toBeVisible()
  })

  test('should logout and redirect to login', async ({ page }) => {
    await loginAsTestUser(page)
    await page.click('[data-testid="logout-btn"]')
    await expect(page).toHaveURL('/login')
  })

  test('should protect all dashboard routes', async ({ page }) => {
    const protectedRoutes = ['/create', '/workflows', '/team', '/control-room']
    for (const route of protectedRoutes) {
      await page.goto(route)
      await expect(page).toHaveURL('/login')
    }
  })
})
```

### 4.2 Workflow Builder Flow (Chat-based Discovery)
```typescript
// /e2e/workflow-builder.spec.ts
describe('Workflow Builder', () => {
  beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/create')
  })

  test('should display chat interface', async ({ page }) => {
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible()
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
  })

  test('should conduct consultant conversation', async ({ page }) => {
    const chatInput = page.locator('[data-testid="chat-input"]')
    const sendBtn = page.locator('[data-testid="send-btn"]')

    // User describes workflow
    await chatInput.fill('I need to automate email responses for customer inquiries')
    await sendBtn.click()

    // Wait for AI response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible()

    // Continue conversation
    await chatInput.fill('My worker reads the email and decides if it needs escalation')
    await sendBtn.click()

    // Verify workflow extraction
    await expect(page.locator('[data-testid="workflow-preview"]')).toBeVisible()
  })

  test('should show workflow steps as conversation progresses', async ({ page }) => {
    await completeWorkflowConversation(page, 'email automation')

    // Verify steps are displayed
    await expect(page.locator('[data-testid="workflow-step"]')).toHaveCount.greaterThan(0)
  })

  test('should extract and display workflow steps', async ({ page }) => {
    await completeWorkflowConversation(page, 'email automation')

    // Navigate to workflows
    await page.click('[data-testid="nav-workflows"]')

    // Verify workflow was created
    await expect(page.locator('[data-testid="workflow-card"]')).toBeVisible()
  })

  test('should handle conversation completion signals', async ({ page }) => {
    await completeWorkflowConversation(page, 'email automation')
    await page.locator('[data-testid="chat-input"]').fill("that's perfect, let's build")
    await page.click('[data-testid="send-btn"]')

    // Should show completion message or redirect
    await expect(page.locator('text=workflow')).toBeVisible()
  })

  test('should allow switching between n8n and Gemini chat modes', async ({ page }) => {
    await page.click('[data-testid="chat-mode-toggle"]')
    await expect(page.locator('[data-testid="chat-mode-gemini"]')).toBeVisible()
  })
})
```

### 4.3 Workflow Management Flow
```typescript
// /e2e/workflow-management.spec.ts
describe('Workflow Management', () => {
  beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await seedTestWorkflow()
    await page.goto('/workflows')
  })

  test('should display workflow list', async ({ page }) => {
    await expect(page.locator('[data-testid="workflow-card"]')).toHaveCount(1)
  })

  test('should show workflow details', async ({ page }) => {
    await expect(page.locator('[data-testid="workflow-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="workflow-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="workflow-step-count"]')).toBeVisible()
  })

  test('should navigate to workflow detail', async ({ page }) => {
    await page.click('[data-testid="workflow-card"]')
    await expect(page).toHaveURL(/\/workflows\/[a-f0-9-]+/)
  })

  test('should edit workflow name', async ({ page }) => {
    await page.click('[data-testid="workflow-card"]')
    await page.click('[data-testid="edit-name-btn"]')
    await page.fill('[data-testid="workflow-name-input"]', 'Updated Workflow Name')
    await page.click('[data-testid="save-name-btn"]')

    await expect(page.locator('text=Updated Workflow Name')).toBeVisible()
  })

  test('should edit workflow steps', async ({ page }) => {
    await page.click('[data-testid="workflow-card"]')
    await page.click('[data-testid="edit-step-btn"]')
    await page.fill('[data-testid="step-label-input"]', 'Updated Step Label')
    await page.click('[data-testid="save-step-btn"]')

    await expect(page.locator('text=Updated Step Label')).toBeVisible()
  })

  test('should activate workflow', async ({ page }) => {
    await page.click('[data-testid="workflow-card"]')
    await page.click('[data-testid="activate-btn"]')

    await expect(page.locator('[data-testid="status-badge"]')).toHaveText('active')
  })

  test('should pause active workflow', async ({ page }) => {
    await seedActiveWorkflow()
    await page.reload()
    await page.click('[data-testid="workflow-card"]')
    await page.click('[data-testid="pause-btn"]')

    await expect(page.locator('[data-testid="status-badge"]')).toHaveText('paused')
  })

  test('should delete workflow with confirmation', async ({ page }) => {
    await page.click('[data-testid="workflow-card"]')
    await page.click('[data-testid="delete-btn"]')

    // Confirmation modal
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible()
    await page.click('[data-testid="confirm-delete-btn"]')

    await expect(page.locator('[data-testid="workflow-card"]')).toHaveCount(0)
  })

  test('should filter workflows by status', async ({ page }) => {
    await seedMultipleWorkflows()
    await page.reload()

    await page.click('[data-testid="status-filter"]')
    await page.click('[data-testid="filter-active"]')

    await expect(page.locator('[data-testid="workflow-card"]')).toHaveCount(1)
  })
})
```

### 4.4 Control Room / Human-in-the-Loop Flow
```typescript
// /e2e/control-room.spec.ts
describe('Control Room', () => {
  beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await seedPendingReviewRequest()
    await page.goto('/control-room')
  })

  test('should display control room layout', async ({ page }) => {
    await expect(page.locator('[data-testid="pending-reviews-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible()
  })

  test('should display pending review requests', async ({ page }) => {
    await expect(page.locator('[data-testid="pending-review-card"]')).toBeVisible()
    await expect(page.locator('text=Pending Reviews (1)')).toBeVisible()
  })

  test('should show review request details', async ({ page }) => {
    await page.click('[data-testid="pending-review-card"]')

    await expect(page.locator('[data-testid="review-detail-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="action-data"]')).toBeVisible()
    await expect(page.locator('[data-testid="worker-name"]')).toBeVisible()
  })

  test('should approve review request', async ({ page }) => {
    await page.click('[data-testid="approve-btn"]')

    await expect(page.locator('text=All caught up!')).toBeVisible()
  })

  test('should approve with feedback', async ({ page }) => {
    await page.click('[data-testid="pending-review-card"]')
    await page.fill('[data-testid="feedback-input"]', 'Looks good!')
    await page.click('[data-testid="approve-with-feedback-btn"]')

    await expect(page.locator('text=All caught up!')).toBeVisible()
  })

  test('should reject review with required feedback', async ({ page }) => {
    await page.click('[data-testid="pending-review-card"]')
    await page.click('[data-testid="reject-btn"]')

    // Should show feedback required error
    await expect(page.locator('text=Feedback required')).toBeVisible()

    await page.fill('[data-testid="feedback-input"]', 'Please revise the email tone')
    await page.click('[data-testid="reject-btn"]')

    await expect(page.locator('text=All caught up!')).toBeVisible()
  })

  test('should chat with agent', async ({ page }) => {
    await page.click('[data-testid="pending-review-card"]')
    await page.fill('[data-testid="chat-input"]', 'Can you clarify the customer request?')
    await page.click('[data-testid="send-chat-btn"]')

    await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(1)
  })

  test('should show real-time activity feed', async ({ page }) => {
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible()

    // Trigger activity log via API
    await triggerActivityLog()

    // Verify real-time update (within reasonable timeout)
    await expect(page.locator('[data-testid="activity-item"]')).toBeVisible({ timeout: 10000 })
  })

  test('should show execution status updates in real-time', async ({ page }) => {
    await seedRunningExecution()
    await page.reload()

    // Trigger execution update
    await triggerExecutionUpdate()

    await expect(page.locator('[data-testid="execution-status"]')).toHaveText('completed')
  })
})
```

### 4.5 Digital Worker Management Flow
```typescript
// /e2e/team-management.spec.ts
describe('Team Management', () => {
  beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/team')
  })

  test('should display team page', async ({ page }) => {
    await expect(page.locator('[data-testid="team-header"]')).toBeVisible()
  })

  test('should display org chart', async ({ page }) => {
    await seedTestWorkers()
    await page.reload()

    await expect(page.locator('[data-testid="org-chart"]')).toBeVisible()
  })

  test('should show worker list', async ({ page }) => {
    await seedTestWorkers()
    await page.reload()

    await expect(page.locator('[data-testid="worker-card"]')).toHaveCount.greaterThan(0)
  })

  test('should create new AI worker', async ({ page }) => {
    await page.click('[data-testid="add-worker-btn"]')

    await expect(page.locator('[data-testid="add-worker-modal"]')).toBeVisible()

    await page.fill('[data-testid="worker-name"]', 'Email Assistant')
    await page.selectOption('[data-testid="worker-type"]', 'ai')
    await page.fill('[data-testid="worker-description"]', 'Handles email responses')
    await page.click('[data-testid="save-worker-btn"]')

    await expect(page.locator('text=Email Assistant')).toBeVisible()
  })

  test('should create new human worker', async ({ page }) => {
    await page.click('[data-testid="add-worker-btn"]')

    await page.fill('[data-testid="worker-name"]', 'John Doe')
    await page.selectOption('[data-testid="worker-type"]', 'human')
    await page.fill('[data-testid="worker-email"]', 'john@example.com')
    await page.click('[data-testid="save-worker-btn"]')

    await expect(page.locator('text=John Doe')).toBeVisible()
  })

  test('should view worker details', async ({ page }) => {
    await seedTestWorker()
    await page.reload()

    await page.click('[data-testid="worker-card"]')

    await expect(page.locator('[data-testid="worker-detail-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="worker-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="assigned-workflows"]')).toBeVisible()
  })

  test('should activate worker', async ({ page }) => {
    await seedTestWorker({ status: 'inactive' })
    await page.reload()

    await page.click('[data-testid="worker-card"]')
    await page.click('[data-testid="activate-worker-btn"]')

    await expect(page.locator('[data-testid="worker-status"]')).toHaveText('active')
  })

  test('should deactivate worker', async ({ page }) => {
    await seedTestWorker({ status: 'active' })
    await page.reload()

    await page.click('[data-testid="worker-card"]')
    await page.click('[data-testid="deactivate-worker-btn"]')

    await expect(page.locator('[data-testid="worker-status"]')).toHaveText('inactive')
  })

  test('should assign manager to worker', async ({ page }) => {
    await seedTestWorkers() // Creates multiple workers
    await page.reload()

    await page.click('[data-testid="worker-card"]')
    await page.click('[data-testid="assign-manager-btn"]')
    await page.selectOption('[data-testid="manager-select"]', 'manager-id')
    await page.click('[data-testid="save-manager-btn"]')

    await expect(page.locator('[data-testid="manager-name"]')).toBeVisible()
  })

  test('should delete worker with confirmation', async ({ page }) => {
    await seedTestWorker()
    await page.reload()

    await page.click('[data-testid="worker-card"]')
    await page.click('[data-testid="delete-worker-btn"]')

    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible()
    await page.click('[data-testid="confirm-delete-btn"]')

    await expect(page.locator('[data-testid="worker-card"]')).toHaveCount(0)
  })
})
```

---

## 5. Mocking Strategies

### 5.1 Supabase Mock
```typescript
// /src/__mocks__/supabase.ts
import { vi } from 'vitest'

const mockSession = {
  user: { id: 'user-123', email: 'test@example.com' },
  access_token: 'mock-token',
}

const mockUser = { id: 'user-123', email: 'test@example.com' }

export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://oauth.example.com' }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    }),
  },
  from: vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
}

export const createClient = vi.fn(() => mockSupabaseClient)
```

### 5.2 Gemini AI Mock
```typescript
// /src/__mocks__/gemini.ts
import { vi } from 'vitest'

export const mockGeminiResponse = {
  workflowName: 'Test Workflow',
  description: 'A test workflow for email automation',
  steps: [
    { id: 'step-1', label: 'Receive Email', type: 'trigger', order: 0, assignedTo: { type: 'ai', agentName: 'Email Bot' } },
    { id: 'step-2', label: 'Analyze Content', type: 'action', order: 1, assignedTo: { type: 'ai', agentName: 'AI Analyzer' } },
    { id: 'step-3', label: 'Review Response', type: 'action', order: 2, assignedTo: { type: 'human', agentName: 'Support Team' } },
    { id: 'step-4', label: 'Send Reply', type: 'end', order: 3, assignedTo: { type: 'ai', agentName: 'Email Bot' } },
  ]
}

export const mockConsultResponse = {
  response: 'Tell me more about your workflow requirements...',
  isComplete: false,
}

export const mockGeminiModel = {
  generateContent: vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify(mockGeminiResponse)
    }
  })
}

export const getModel = vi.fn(() => mockGeminiModel)

// Helper to mock specific responses
export function mockGeminiExtract(response: typeof mockGeminiResponse) {
  mockGeminiModel.generateContent.mockResolvedValueOnce({
    response: { text: () => JSON.stringify(response) }
  })
}

export function mockGeminiConsult(response: typeof mockConsultResponse) {
  mockGeminiModel.generateContent.mockResolvedValueOnce({
    response: { text: () => JSON.stringify(response) }
  })
}
```

### 5.3 n8n API Mock
```typescript
// /src/__mocks__/n8n.ts
import { vi } from 'vitest'

export const mockN8nWorkflow = {
  id: 'n8n-workflow-123',
  name: 'Test Workflow',
  active: false,
  nodes: [],
  connections: {},
}

export const mockN8nExecution = {
  id: 'exec-123',
  status: 'running',
  startedAt: new Date().toISOString(),
}

export const mockN8nClient = {
  createWorkflow: vi.fn().mockResolvedValue(mockN8nWorkflow),
  updateWorkflow: vi.fn().mockResolvedValue(mockN8nWorkflow),
  deleteWorkflow: vi.fn().mockResolvedValue({ success: true }),
  executeWorkflow: vi.fn().mockResolvedValue(mockN8nExecution),
  getExecution: vi.fn().mockResolvedValue({ ...mockN8nExecution, status: 'success' }),
  activateWorkflow: vi.fn().mockResolvedValue({ ...mockN8nWorkflow, active: true }),
  deactivateWorkflow: vi.fn().mockResolvedValue({ ...mockN8nWorkflow, active: false }),
}

export const n8nRequest = vi.fn()
export const convertToN8NWorkflow = vi.fn().mockReturnValue(mockN8nWorkflow)
```

### 5.4 MSW Handlers for E2E
```typescript
// /e2e/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Gemini API
  http.post('/api/gemini/consult', async () => {
    return HttpResponse.json({
      response: 'Tell me more about your workflow requirements...',
      isComplete: false,
    })
  }),

  http.post('/api/gemini/extract', async () => {
    return HttpResponse.json({
      workflow: {
        name: 'Customer Email Response',
        description: 'Automated email response workflow',
        steps: [
          { id: 'step-1', label: 'Receive Email', type: 'trigger', order: 0 },
          { id: 'step-2', label: 'Process', type: 'action', order: 1 },
          { id: 'step-3', label: 'Send Reply', type: 'end', order: 2 },
        ]
      },
      success: true,
    })
  }),

  http.post('/api/gemini/requirements', async () => {
    return HttpResponse.json({
      questions: ['What tone should the response have?'],
      blueprint: {
        greenList: ['professional tone', 'helpful'],
        redList: ['aggressive', 'informal'],
      }
    })
  }),

  // n8n webhooks
  http.post('/api/n8n/review-request', async () => {
    return HttpResponse.json({
      reviewId: 'review-123',
      status: 'pending',
    })
  }),

  http.post('/api/n8n/review-response', async () => {
    return HttpResponse.json({
      success: true,
    })
  }),

  http.post('/api/n8n/execution-complete', async () => {
    return HttpResponse.json({
      success: true,
    })
  }),

  // Supabase (if not using real test DB)
  http.get('*/rest/v1/workflows*', async () => {
    return HttpResponse.json([
      {
        id: 'workflow-1',
        name: 'Test Workflow',
        status: 'draft',
        steps: [],
        created_at: new Date().toISOString(),
      }
    ])
  }),
]
```

---

## 6. Test Data Factories

```typescript
// /src/__tests__/factories/index.ts
import { faker } from '@faker-js/faker'
import type { Workflow, WorkflowStep, DigitalWorker, ReviewRequest, Execution } from '@/types'

export function createWorkflow(overrides?: Partial<Workflow>): Workflow {
  return {
    id: faker.string.uuid(),
    name: faker.company.catchPhrase(),
    description: faker.lorem.sentence(),
    steps: [createWorkflowStep({ type: 'trigger', order: 0 })],
    status: 'draft',
    isActive: false,
    organizationId: faker.string.uuid(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

export function createWorkflowStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: faker.string.uuid(),
    label: faker.lorem.words(3),
    type: 'action',
    order: 0,
    assignedTo: {
      type: faker.helpers.arrayElement(['ai', 'human']),
      agentName: faker.person.fullName(),
    },
    config: {},
    ...overrides,
  }
}

export function createDigitalWorker(overrides?: Partial<DigitalWorker>): DigitalWorker {
  return {
    id: faker.string.uuid(),
    organizationId: faker.string.uuid(),
    name: faker.person.fullName(),
    description: faker.lorem.sentence(),
    type: faker.helpers.arrayElement(['ai', 'human']),
    status: 'inactive',
    personality: { tone: 'professional', verbosity: 'concise' },
    metadata: {},
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

export function createReviewRequest(overrides?: Partial<ReviewRequest>): ReviewRequest {
  return {
    id: faker.string.uuid(),
    executionId: faker.string.uuid(),
    stepId: faker.string.uuid(),
    stepIndex: 0,
    workerName: faker.person.fullName(),
    status: 'pending',
    reviewType: 'approval',
    reviewData: {
      action: 'send_email',
      content: faker.lorem.paragraph(),
      recipient: faker.internet.email(),
    },
    chatHistory: [],
    createdAt: faker.date.recent(),
    ...overrides,
  }
}

export function createExecution(overrides?: Partial<Execution>): Execution {
  return {
    id: faker.string.uuid(),
    workflowId: faker.string.uuid(),
    workflowName: faker.company.catchPhrase(),
    status: 'running',
    currentStepIndex: 0,
    triggerType: 'manual',
    triggerData: {},
    startedAt: faker.date.recent(),
    createdAt: faker.date.recent(),
    ...overrides,
  }
}

export function createActivityLog(overrides?: Partial<any>): any {
  return {
    id: faker.string.uuid(),
    eventType: faker.helpers.arrayElement(['workflow_started', 'step_completed', 'review_requested', 'workflow_completed']),
    actorType: faker.helpers.arrayElement(['user', 'system', 'ai']),
    actorId: faker.string.uuid(),
    actorName: faker.person.fullName(),
    metadata: {},
    createdAt: faker.date.recent(),
    ...overrides,
  }
}

export function createUser(overrides?: Partial<any>): any {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    ...overrides,
  }
}

// Batch creators
export function createWorkflows(count: number, overrides?: Partial<Workflow>): Workflow[] {
  return Array.from({ length: count }, () => createWorkflow(overrides))
}

export function createDigitalWorkers(count: number, overrides?: Partial<DigitalWorker>): DigitalWorker[] {
  return Array.from({ length: count }, () => createDigitalWorker(overrides))
}
```

### E2E Seed Functions
```typescript
// /e2e/seeds/index.ts
import { createClient } from '@supabase/supabase-js'
import { createWorkflow, createDigitalWorker, createReviewRequest, createExecution } from './factories'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function seedTestUser() {
  const { data: user } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'testpassword123',
    email_confirm: true,
  })
  return user
}

export async function seedTestOrganization(userId: string) {
  const { data: org } = await supabase.from('organizations').insert({
    name: 'Test Organization',
    slug: 'test-org',
  }).select().single()

  await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id: userId,
    role: 'owner',
  })

  return org
}

export async function seedTestWorkflow(orgId?: string, overrides?: Partial<any>) {
  const workflow = createWorkflow(overrides)
  const { data } = await supabase.from('workflows').insert({
    organization_id: orgId || 'default-org',
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    steps: workflow.steps,
  }).select().single()

  return data
}

export async function seedActiveWorkflow(orgId?: string) {
  return seedTestWorkflow(orgId, { status: 'active', isActive: true })
}

export async function seedMultipleWorkflows(orgId?: string, count = 3) {
  const workflows = []
  for (let i = 0; i < count; i++) {
    const status = i === 0 ? 'active' : i === 1 ? 'paused' : 'draft'
    const wf = await seedTestWorkflow(orgId, { status })
    workflows.push(wf)
  }
  return workflows
}

export async function seedTestWorker(orgId?: string, overrides?: Partial<any>) {
  const worker = createDigitalWorker(overrides)
  const { data } = await supabase.from('digital_workers').insert({
    organization_id: orgId || 'default-org',
    name: worker.name,
    type: worker.type,
    status: worker.status,
    description: worker.description,
    personality: worker.personality,
  }).select().single()

  return data
}

export async function seedTestWorkers(orgId?: string, count = 3) {
  const workers = []
  for (let i = 0; i < count; i++) {
    const worker = await seedTestWorker(orgId)
    workers.push(worker)
  }
  return workers
}

export async function seedPendingReviewRequest(executionId?: string) {
  const review = createReviewRequest({ status: 'pending' })
  const { data } = await supabase.from('review_requests').insert({
    execution_id: executionId || 'default-exec',
    step_id: review.stepId,
    step_index: review.stepIndex,
    worker_name: review.workerName,
    status: review.status,
    review_type: review.reviewType,
    review_data: review.reviewData,
    chat_history: [],
  }).select().single()

  return data
}

export async function seedRunningExecution(workflowId?: string) {
  const execution = createExecution({ status: 'running' })
  const { data } = await supabase.from('executions').insert({
    workflow_id: workflowId || 'default-workflow',
    status: execution.status,
    current_step_index: execution.currentStepIndex,
    trigger_type: execution.triggerType,
    trigger_data: execution.triggerData,
    started_at: execution.startedAt,
  }).select().single()

  return data
}

export async function cleanupTestData() {
  // Delete in correct order due to foreign keys
  await supabase.from('review_requests').delete().neq('id', '')
  await supabase.from('execution_steps').delete().neq('id', '')
  await supabase.from('executions').delete().neq('id', '')
  await supabase.from('activity_logs').delete().neq('id', '')
  await supabase.from('workflows').delete().neq('id', '')
  await supabase.from('digital_workers').delete().neq('id', '')
  await supabase.from('organization_members').delete().neq('id', '')
  await supabase.from('organizations').delete().neq('id', '')
}

// E2E helper functions
export async function triggerActivityLog() {
  await supabase.from('activity_logs').insert({
    event_type: 'test_event',
    actor_type: 'system',
    actor_name: 'Test System',
    metadata: { test: true },
  })
}

export async function triggerExecutionUpdate(executionId: string) {
  await supabase.from('executions').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', executionId)
}
```

---

## 7. CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  N8N_API_URL: ${{ secrets.N8N_API_URL }}
  N8N_API_KEY: ${{ secrets.N8N_API_KEY }}

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15.1.0.117
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run Supabase migrations
        run: npx supabase db push
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Build app
        run: npm run build
      - name: Start app
        run: npm run start &
      - name: Wait for app
        run: npx wait-on http://localhost:3000 --timeout 60000
      - name: Run E2E tests
        run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-screenshots
          path: test-results/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
```

### Pre-commit Hooks
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "vitest related --run"
    ],
    "*.{ts,tsx,json,md}": "prettier --write"
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:ci"
    }
  }
}
```

### Coverage Thresholds
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'e2e/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 80,
          statements: 80,
        },
        // Critical paths require higher coverage
        './src/hooks/': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        './src/app/api/': {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        './src/lib/': {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
})
```

---

## 8. Performance & Load Testing

### API Load Testing with k6
```javascript
// /load-tests/api-load.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Steady state
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '2m', target: 100 },  // Hold spike
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
}

export default function() {
  // Test workflow list endpoint
  const workflowsRes = http.get(`${BASE_URL}/api/workflows`, { headers })
  check(workflowsRes, {
    'workflows status 200': (r) => r.status === 200,
    'workflows response time < 200ms': (r) => r.timings.duration < 200,
  })

  sleep(1)

  // Test Gemini consult endpoint
  const consultRes = http.post(
    `${BASE_URL}/api/gemini/consult`,
    JSON.stringify({
      messages: [{ sender: 'user', text: 'I need to automate email responses' }],
      questionCount: 0,
    }),
    { headers }
  )
  check(consultRes, {
    'consult status 200': (r) => r.status === 200,
    'consult response time < 5s': (r) => r.timings.duration < 5000,
  })

  sleep(2)

  // Test control room endpoint
  const reviewsRes = http.get(`${BASE_URL}/api/reviews?status=pending`, { headers })
  check(reviewsRes, {
    'reviews status 200': (r) => r.status === 200,
    'reviews response time < 300ms': (r) => r.timings.duration < 300,
  })

  sleep(1)
}
```

### Realtime Subscription Load Test
```javascript
// /load-tests/realtime-load.js
import ws from 'k6/ws'
import { check } from 'k6'

export const options = {
  vus: 100,
  duration: '5m',
}

export default function() {
  const url = `wss://${__ENV.SUPABASE_PROJECT}.supabase.co/realtime/v1/websocket?apikey=${__ENV.SUPABASE_ANON_KEY}`

  const res = ws.connect(url, {}, function(socket) {
    socket.on('open', () => {
      // Subscribe to review_requests changes
      socket.send(JSON.stringify({
        topic: 'realtime:public:review_requests',
        event: 'phx_join',
        payload: { config: { broadcast: { self: true } } },
        ref: '1',
      }))
    })

    socket.on('message', (data) => {
      const msg = JSON.parse(data)
      check(msg, {
        'received message': (m) => m !== null,
      })
    })

    socket.setTimeout(function() {
      socket.close()
    }, 60000)
  })

  check(res, { 'websocket connected': (r) => r && r.status === 101 })
}
```

### Database Performance Indexes
```sql
-- /migrations/add_performance_indexes.sql
-- Add to Supabase for monitoring

-- Enable query logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = 100;

-- Indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_org_status
  ON workflows(organization_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_org_created
  ON workflows(organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_workflow_status
  ON executions(workflow_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_started
  ON executions(started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_requests_status_created
  ON review_requests(status, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_requests_execution
  ON review_requests(execution_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_org_created
  ON activity_logs(organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_digital_workers_org_status
  ON digital_workers(organization_id, status);

-- Partial indexes for frequently filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_requests_pending
  ON review_requests(created_at) WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_running
  ON executions(started_at) WHERE status = 'running';
```

---

## 9. Production Monitoring

### Health Check Endpoint
```typescript
// /src/app/api/health/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  services: {
    database: 'healthy' | 'unhealthy' | 'unknown'
    gemini: 'healthy' | 'unhealthy' | 'unknown'
    n8n: 'healthy' | 'unhealthy' | 'unknown'
  }
  latency: {
    database?: number
    gemini?: number
    n8n?: number
  }
}

export async function GET() {
  const checks: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    services: {
      database: 'unknown',
      gemini: 'unknown',
      n8n: 'unknown',
    },
    latency: {}
  }

  // Check Supabase
  try {
    const start = Date.now()
    const supabase = await createClient()
    await supabase.from('organizations').select('id').limit(1)
    checks.services.database = 'healthy'
    checks.latency.database = Date.now() - start
  } catch (error) {
    checks.services.database = 'unhealthy'
    checks.status = 'degraded'
    console.error('Database health check failed:', error)
  }

  // Check Gemini API
  try {
    const start = Date.now()
    const res = await fetch('https://generativelanguage.googleapis.com/v1/models', {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    })
    checks.services.gemini = res.ok ? 'healthy' : 'unhealthy'
    checks.latency.gemini = Date.now() - start
    if (!res.ok) checks.status = 'degraded'
  } catch (error) {
    checks.services.gemini = 'unhealthy'
    checks.status = 'degraded'
    console.error('Gemini health check failed:', error)
  }

  // Check n8n
  try {
    const start = Date.now()
    const res = await fetch(`${process.env.N8N_API_URL}/workflows?limit=1`, {
      headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY! },
    })
    checks.services.n8n = res.ok ? 'healthy' : 'unhealthy'
    checks.latency.n8n = Date.now() - start
    if (!res.ok) checks.status = 'degraded'
  } catch (error) {
    checks.services.n8n = 'unhealthy'
    checks.status = 'degraded'
    console.error('n8n health check failed:', error)
  }

  // Determine overall status
  const unhealthyCount = Object.values(checks.services).filter(s => s === 'unhealthy').length
  if (unhealthyCount >= 2) {
    checks.status = 'unhealthy'
  }

  return NextResponse.json(checks, {
    status: checks.status === 'healthy' ? 200 : checks.status === 'degraded' ? 200 : 503,
  })
}
```

### Application Monitoring Setup
```typescript
// /src/lib/monitoring/index.ts
import * as Sentry from '@sentry/nextjs'

// Initialize Sentry
export function initMonitoring() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  })
}

// Custom error boundary for API routes
export function withErrorHandling<T>(handler: (request: Request) => Promise<T>) {
  return async (request: Request): Promise<T | Response> => {
    try {
      return await handler(request)
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          url: request.url,
          method: request.method,
        },
      })
      console.error('API Error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ) as any
    }
  }
}

// Performance tracking
export function trackPerformance<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const start = performance.now()
    try {
      return await fn(...args)
    } finally {
      const duration = performance.now() - start
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `${name} completed`,
        data: { duration: `${duration.toFixed(2)}ms` },
        level: 'info',
      })

      // Log slow operations
      if (duration > 1000) {
        console.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`)
      }
    }
  }) as T
}

// Custom metrics
export function recordMetric(name: string, value: number, tags?: Record<string, string>) {
  Sentry.metrics.increment(name, value, { tags })
}
```

### Alert Configuration
| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Error Rate | error_rate > 1% for 5m | Critical | PagerDuty, Slack |
| Slow API Response | p95_latency > 2000ms for 10m | Warning | Slack |
| Database Connection Exhausted | connections >= 95% | Critical | PagerDuty |
| Review Request Backlog | pending_reviews > 50 for 30m | Warning | Slack, Email |
| Gemini API Failures | error_rate > 5% for 5m | High | Slack |
| n8n Execution Failures | failure_rate > 10% for 15m | High | Slack |
| Memory Usage High | memory > 85% for 5m | Warning | Slack |
| Health Check Degraded | status != healthy for 3m | High | Slack |

### Logging Strategy
```typescript
// /src/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['req.headers.authorization', 'password', 'token', 'apiKey'],
    censor: '[REDACTED]',
  },
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
})

// Usage examples:
// logger.info({ workflowId, userId }, 'Workflow created')
// logger.warn({ executionId, stepIndex }, 'Execution timeout approaching')
// logger.error({ error, context: { workflowId } }, 'Failed to execute workflow')
```

---

## 10. Test File Structure

```
/sanjeev_to_mai_nyc
├── src/
│   ├── __tests__/
│   │   ├── factories/
│   │   │   └── index.ts              # Data factories
│   │   └── utils/
│   │       ├── test-utils.tsx        # Custom render with providers
│   │       ├── mock-setup.ts         # Global mocks
│   │       └── test-helpers.ts       # Helper functions
│   ├── __mocks__/
│   │   ├── supabase.ts               # Supabase mock
│   │   ├── gemini.ts                 # Gemini AI mock
│   │   └── n8n.ts                    # n8n API mock
│   ├── hooks/
│   │   └── __tests__/
│   │       ├── useWorkflows.test.ts
│   │       ├── useTeam.test.ts
│   │       ├── useReviewRequests.test.ts
│   │       ├── useExecutions.test.ts
│   │       ├── useActivityLogs.test.ts
│   │       ├── useConversations.test.ts
│   │       └── useRealtime.test.ts
│   ├── components/
│   │   └── ui/
│   │       └── __tests__/
│   │           ├── Button.test.tsx
│   │           ├── Card.test.tsx
│   │           ├── Modal.test.tsx
│   │           ├── Input.test.tsx
│   │           └── SlideOver.test.tsx
│   ├── lib/
│   │   ├── gemini/
│   │   │   └── __tests__/
│   │   │       └── server.test.ts
│   │   ├── n8n/
│   │   │   └── __tests__/
│   │   │       └── client.test.ts
│   │   ├── supabase/
│   │   │   └── __tests__/
│   │   │       └── middleware.test.ts
│   │   └── utils/
│   │       └── __tests__/
│   │           └── cn.test.ts
│   ├── providers/
│   │   └── __tests__/
│   │       ├── AuthProvider.test.tsx
│   │       └── QueryProvider.test.tsx
│   └── app/
│       └── api/
│           ├── gemini/
│           │   └── __tests__/
│           │       ├── consult.test.ts
│           │       ├── extract.test.ts
│           │       ├── extract-people.test.ts
│           │       ├── requirements.test.ts
│           │       └── build-agents.test.ts
│           ├── n8n/
│           │   └── __tests__/
│           │       ├── webhook.test.ts
│           │       ├── ai-action.test.ts
│           │       ├── execution-update.test.ts
│           │       ├── execution-complete.test.ts
│           │       ├── review-request.test.ts
│           │       ├── review-response.test.ts
│           │       └── sync.test.ts
│           └── health/
│               └── __tests__/
│                   └── route.test.ts
├── e2e/
│   ├── auth.spec.ts
│   ├── workflow-builder.spec.ts
│   ├── workflow-management.spec.ts
│   ├── control-room.spec.ts
│   ├── team-management.spec.ts
│   ├── global-setup.ts
│   ├── global-teardown.ts
│   ├── fixtures/
│   │   └── auth.ts                   # Auth fixtures
│   ├── mocks/
│   │   └── handlers.ts               # MSW handlers
│   └── seeds/
│       └── index.ts                  # Database seeders
├── load-tests/
│   ├── api-load.js                   # k6 API load test
│   ├── realtime-load.js              # k6 WebSocket test
│   └── README.md
├── vitest.config.ts
├── vitest.setup.ts
├── playwright.config.ts
└── .github/
    └── workflows/
        └── test.yml                  # CI/CD pipeline
```

---

## 11. Critical Files to Test (Priority Order)

1. **`/src/hooks/useWorkflows.ts`**
   - Most complex hook with CRUD operations, step management, status transitions
   - Priority: **HIGHEST**
   - Estimated test count: 25+

2. **`/src/app/api/gemini/consult/route.ts`**
   - Core AI integration with conversation state detection logic
   - Priority: **HIGH**
   - Estimated test count: 10+

3. **`/src/lib/n8n/client.ts`**
   - Critical workflow conversion logic (`convertToN8NWorkflow`)
   - External API integration
   - Priority: **HIGH**
   - Estimated test count: 15+

4. **`/src/app/(dashboard)/control-room/page.tsx`**
   - Human-in-the-loop UI with real-time updates
   - Primary target for E2E testing
   - Priority: **HIGH**
   - Estimated test count: 8+ E2E scenarios

5. **`/src/hooks/useRealtime.ts`**
   - Real-time subscription management
   - Critical for Control Room reliability
   - Priority: **HIGH**
   - Estimated test count: 10+

6. **`/src/hooks/useReviewRequests.ts`**
   - Human review workflow
   - Priority: **MEDIUM-HIGH**
   - Estimated test count: 12+

7. **`/src/app/api/n8n/review-request/route.ts` & `/review-response/route.ts`**
   - Review request lifecycle
   - Priority: **MEDIUM-HIGH**
   - Estimated test count: 15+

8. **`/src/lib/supabase/middleware.ts`**
   - Authentication and route protection
   - Priority: **MEDIUM**
   - Estimated test count: 8+

---

## 12. Verification Checklist

After implementing tests, verify the following:

### Unit Tests
- [ ] All unit tests pass (`npm run test`)
- [ ] Coverage thresholds met (`npm run test:coverage`)
  - [ ] Global: 80% lines, 75% functions, 70% branches
  - [ ] Hooks: 90% lines, 90% functions, 85% branches
  - [ ] API Routes: 85% lines, 85% functions, 80% branches
- [ ] No flaky tests (run 3 times consecutively)

### Integration Tests
- [ ] All API route tests pass
- [ ] Database transactions work correctly
- [ ] External service mocks function properly

### E2E Tests
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Tests run in < 10 minutes
- [ ] Screenshots captured on failure
- [ ] Real-time features tested

### CI/CD
- [ ] CI pipeline passes on PR
- [ ] Pre-commit hooks working
- [ ] Coverage reports uploading to Codecov
- [ ] Artifacts saved on failure

### Performance
- [ ] Load tests show acceptable performance
- [ ] p95 latency < 500ms for API endpoints
- [ ] Error rate < 1% under load
- [ ] WebSocket connections stable

### Production Readiness
- [ ] Health endpoint returns healthy status
- [ ] Monitoring alerts configured
- [ ] Error tracking (Sentry) working
- [ ] Logging strategy implemented
- [ ] Database indexes created

---

## 13. Implementation Order

1. **Phase 1: Setup** (Day 1)
   - Install Vitest, React Testing Library, Playwright, MSW
   - Configure vitest.config.ts and playwright.config.ts
   - Create test utilities and factories
   - Set up mocks for Supabase, Gemini, n8n

2. **Phase 2: Unit Tests** (Days 2-4)
   - Test all hooks (priority: useWorkflows, useRealtime, useReviewRequests)
   - Test utility functions
   - Test UI components

3. **Phase 3: Integration Tests** (Days 5-6)
   - Test Gemini API routes
   - Test n8n API routes
   - Test auth flows

4. **Phase 4: E2E Tests** (Days 7-8)
   - Authentication flow
   - Workflow builder flow
   - Control room flow
   - Team management flow

5. **Phase 5: CI/CD & Monitoring** (Day 9)
   - Set up GitHub Actions
   - Configure coverage thresholds
   - Add health check endpoint
   - Set up Sentry/monitoring

6. **Phase 6: Load Testing** (Day 10)
   - Create k6 scripts
   - Run baseline tests
   - Add database indexes
   - Document performance baselines
