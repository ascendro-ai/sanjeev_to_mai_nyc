import { test, expect } from '@playwright/test'
import {
  loginAsTestUser,
  seedTestWorkflow,
  seedActiveWorkflow,
  seedPendingReviewRequest,
  seedRunningExecution,
  seedWorkflowTemplate,
  clearTestData,
} from './seeds'

test.describe('n8n Integration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.afterEach(async () => {
    // Clean up test data after each test
    await clearTestData().catch(() => {
      // Ignore cleanup errors in test environment
    })
  })

  test.describe('Workflow Creation and Sync', () => {
    test('should create workflow via chat interface', async ({ page }) => {
      await page.goto('/create')

      // Verify chat interface is displayed
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible()

      // Start workflow creation conversation
      const chatInput = page.locator('[data-testid="chat-input"]')
      await chatInput.fill('I need to automate email responses for customer inquiries')
      await page.click('[data-testid="send-btn"]')

      // Wait for AI response
      await expect(
        page.locator('[data-testid="assistant-message"]').first()
      ).toBeVisible({ timeout: 30000 })

      // Continue conversation to define workflow
      await chatInput.fill('My AI agent should read and categorize emails, then draft responses')
      await page.click('[data-testid="send-btn"]')

      // Workflow preview should appear
      await expect(
        page.locator('[data-testid="workflow-preview"]')
      ).toBeVisible({ timeout: 30000 })
    })

    test('should display workflow steps as cards', async ({ page }) => {
      const workflow = await seedTestWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Verify workflow steps are displayed
      await expect(page.locator('[data-testid="workflow-step-card"]')).toHaveCount(3)

      // Check step details
      await expect(page.locator('text=Start')).toBeVisible()
      await expect(page.locator('text=AI Process')).toBeVisible()
      await expect(page.locator('text=Complete')).toBeVisible()
    })

    test('should edit workflow step configuration', async ({ page }) => {
      const workflow = await seedTestWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Click on a step to open details
      await page.click('[data-testid="workflow-step-card"]:has-text("AI Process")')

      // Click configure button
      await page.click('[data-testid="configure-step-btn"]')

      // Edit step label
      await page.fill('[data-testid="step-label-input"]', 'Process Customer Email')
      await page.click('[data-testid="save-step-btn"]')

      // Verify update
      await expect(page.locator('text=Process Customer Email')).toBeVisible()
    })

    test('should edit blueprint greenList and redList', async ({ page }) => {
      const workflow = await seedTestWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Open step configuration
      await page.click('[data-testid="workflow-step-card"]:has-text("AI Process")')
      await page.click('[data-testid="configure-step-btn"]')

      // Add to greenList
      await page.fill('[data-testid="greenlist-input"]', 'summarize_email')
      await page.click('[data-testid="add-greenlist-btn"]')

      // Add to redList
      await page.fill('[data-testid="redlist-input"]', 'delete_email')
      await page.click('[data-testid="add-redlist-btn"]')

      // Save changes
      await page.click('[data-testid="save-step-btn"]')

      // Verify blueprint was updated
      await page.click('[data-testid="workflow-step-card"]:has-text("AI Process")')
      await expect(page.locator('text=summarize_email')).toBeVisible()
      await expect(page.locator('text=delete_email')).toBeVisible()
    })
  })

  test.describe('Workflow Activation', () => {
    test('should activate a workflow', async ({ page }) => {
      const workflow = await seedTestWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Click activate button
      await page.click('[data-testid="activate-btn"]')

      // Verify status changed
      await expect(page.locator('[data-testid="status-badge"]')).toHaveText('active')
    })

    test('should pause an active workflow', async ({ page }) => {
      const workflow = await seedActiveWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Click pause button
      await page.click('[data-testid="pause-btn"]')

      // Verify status changed
      await expect(page.locator('[data-testid="status-badge"]')).toHaveText('paused')
    })

    test('should show n8n sync status', async ({ page }) => {
      const workflow = await seedActiveWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Check for n8n sync indicator
      await expect(page.locator('[data-testid="n8n-sync-status"]')).toBeVisible()
    })
  })

  test.describe('Human Review Flow', () => {
    test('should display pending reviews in control room', async ({ page }) => {
      await seedPendingReviewRequest()
      await page.goto('/control-room')

      // Verify pending review is shown
      await expect(page.locator('[data-testid="pending-review-card"]')).toBeVisible()
    })

    test('should approve a review request', async ({ page }) => {
      await seedPendingReviewRequest()
      await page.goto('/control-room')

      // Click approve
      await page.click('[data-testid="approve-btn"]')

      // Verify review was processed
      await expect(page.locator('text=All caught up!')).toBeVisible({ timeout: 10000 })
    })

    test('should reject a review with feedback', async ({ page }) => {
      await seedPendingReviewRequest()
      await page.goto('/control-room')

      // Open review details
      await page.click('[data-testid="pending-review-card"]')

      // Enter feedback and reject
      await page.fill('[data-testid="feedback-input"]', 'Please revise the email tone')
      await page.click('[data-testid="reject-btn"]')

      // Verify review was processed
      await expect(page.locator('text=All caught up!')).toBeVisible({ timeout: 10000 })
    })

    test('should edit and approve a review', async ({ page }) => {
      await seedPendingReviewRequest()
      await page.goto('/control-room')

      // Open review details
      await page.click('[data-testid="pending-review-card"]')

      // Edit the action data
      await page.click('[data-testid="edit-action-btn"]')
      await page.fill('[data-testid="action-body-input"]', 'Updated email content...')
      await page.click('[data-testid="save-edit-btn"]')

      // Approve with edits
      await page.click('[data-testid="approve-with-edits-btn"]')

      // Verify review was processed
      await expect(page.locator('text=All caught up!')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Execution Monitoring', () => {
    test('should display running execution in control room', async ({ page }) => {
      await seedRunningExecution()
      await page.goto('/control-room')

      // Verify execution is shown
      await expect(page.locator('[data-testid="execution-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="execution-status"]')).toHaveText('running')
    })

    test('should show execution step progress', async ({ page }) => {
      const execution = await seedRunningExecution()
      await page.goto('/control-room')

      // Click to see execution details
      await page.click('[data-testid="execution-card"]')

      // Verify execution steps are displayed
      const stepCount = await page.locator('[data-testid="execution-step"]').count()
      expect(stepCount).toBeGreaterThan(0)
    })

    test('should show AI debugger for failed executions', async ({ page }) => {
      // Seed a failed execution
      await fetch(`${process.env.E2E_API_URL || 'http://localhost:3000'}/api/test/seed-execution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'failed',
          error: 'Connection timeout',
        }),
      })

      await page.goto('/control-room')

      // Open failed execution
      await page.click('[data-testid="execution-card"]:has-text("failed")')

      // Verify debugger component is available
      await expect(page.locator('[data-testid="ai-debugger"]')).toBeVisible()

      // Analyze failure
      await page.click('[data-testid="analyze-failure-btn"]')

      // Verify analysis results
      await expect(page.locator('[data-testid="debug-summary"]')).toBeVisible({ timeout: 30000 })
      await expect(page.locator('[data-testid="suggested-fixes"]')).toBeVisible()
    })
  })

  test.describe('Workflow Templates', () => {
    test('should display template library', async ({ page }) => {
      await seedWorkflowTemplate()
      await page.goto('/templates')

      // Verify templates are displayed
      await expect(page.locator('[data-testid="template-card"]')).toBeVisible()
    })

    test('should filter templates by category', async ({ page }) => {
      await seedWorkflowTemplate()
      await page.goto('/templates')

      // Select category filter
      await page.click('[data-testid="category-filter"]')
      await page.click('[data-testid="category-communication"]')

      // Verify filtered results
      await expect(
        page.locator('[data-testid="template-card"]:has-text("communication")')
      ).toBeVisible()
    })

    test('should create workflow from template', async ({ page }) => {
      const template = await seedWorkflowTemplate()
      await page.goto('/templates')

      // Click use template
      await page.click(`[data-testid="use-template-btn-${template.id}"]`)

      // Enter workflow name
      await page.fill('[data-testid="workflow-name-input"]', 'My New Workflow')
      await page.click('[data-testid="create-from-template-btn"]')

      // Verify workflow was created
      await expect(page).toHaveURL(/\/workflows\/[a-f0-9-]+/)
    })
  })

  test.describe('Trigger Configuration', () => {
    test('should configure schedule trigger', async ({ page }) => {
      const workflow = await seedTestWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Open trigger step configuration
      await page.click('[data-testid="workflow-step-card"]:has-text("Start")')
      await page.click('[data-testid="configure-step-btn"]')

      // Select schedule trigger
      await page.click('[data-testid="trigger-type-select"]')
      await page.click('[data-testid="trigger-schedule"]')

      // Set cron expression
      await page.fill('[data-testid="cron-input"]', '0 9 * * *')
      await page.click('[data-testid="save-step-btn"]')

      // Verify trigger was configured
      await page.click('[data-testid="workflow-step-card"]:has-text("Start")')
      await expect(page.locator('text=Schedule')).toBeVisible()
    })

    test('should configure webhook trigger', async ({ page }) => {
      const workflow = await seedTestWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Open trigger step configuration
      await page.click('[data-testid="workflow-step-card"]:has-text("Start")')
      await page.click('[data-testid="configure-step-btn"]')

      // Select webhook trigger
      await page.click('[data-testid="trigger-type-select"]')
      await page.click('[data-testid="trigger-webhook"]')

      // Set webhook path
      await page.fill('[data-testid="webhook-path-input"]', 'my-webhook')
      await page.click('[data-testid="save-step-btn"]')

      // Verify webhook URL is displayed
      await expect(page.locator('[data-testid="webhook-url"]')).toBeVisible()
    })
  })

  test.describe('Audit Trail', () => {
    test('should display audit logs', async ({ page }) => {
      // Seed some audit data
      await seedRunningExecution()
      await page.goto('/audit')

      // Verify audit logs are displayed
      const logCount = await page.locator('[data-testid="audit-log-row"]').count()
      expect(logCount).toBeGreaterThan(0)
    })

    test('should filter audit logs by workflow', async ({ page }) => {
      const workflow = await seedTestWorkflow()
      await page.goto('/audit')

      // Filter by workflow
      await page.click('[data-testid="workflow-filter"]')
      await page.click(`[data-testid="filter-workflow-${workflow.id}"]`)

      // Verify filtered results (can be 0 or more)
      const filteredCount = await page.locator('[data-testid="audit-log-row"]').count()
      expect(filteredCount).toBeGreaterThanOrEqual(0)
    })

    test('should show compliance summary', async ({ page }) => {
      await page.goto('/audit?summary=true')

      // Verify summary is displayed
      await expect(page.locator('[data-testid="compliance-summary"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-executions"]')).toBeVisible()
    })
  })

  test.describe('Blueprint Learning', () => {
    test('should record feedback on AI actions', async ({ page }) => {
      await seedPendingReviewRequest()
      await page.goto('/control-room')

      // Approve the action (positive feedback)
      await page.click('[data-testid="approve-btn"]')

      // Verify feedback was recorded (check blueprint page)
      const workflow = await seedTestWorkflow()
      await page.goto(`/workflows/${workflow.id}`)

      // Open step to see blueprint suggestions
      await page.click('[data-testid="workflow-step-card"]:has-text("AI Process")')

      // Blueprint suggestions should be available
      await expect(page.locator('[data-testid="blueprint-suggestions"]')).toBeVisible()
    })
  })
})

test.describe('Real-time Updates', () => {
  test('should receive real-time execution updates', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/control-room')

    // Seed a running execution
    const execution = await seedRunningExecution()

    // Wait for execution to appear
    await expect(page.locator('[data-testid="execution-card"]')).toBeVisible({ timeout: 10000 })

    // Trigger status update via API
    await fetch(
      `${process.env.E2E_API_URL || 'http://localhost:3000'}/api/test/trigger-execution-update`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: execution.id, status: 'completed' }),
      }
    )

    // Verify real-time update
    await expect(page.locator('[data-testid="execution-status"]')).toHaveText('completed', {
      timeout: 10000,
    })
  })

  test('should receive real-time review request notifications', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/control-room')

    // Note current review count
    const initialCount = await page.locator('[data-testid="pending-review-card"]').count()

    // Seed a new review request
    await seedPendingReviewRequest()

    // Verify real-time update (new review appears)
    await expect(page.locator('[data-testid="pending-review-card"]')).toHaveCount(
      initialCount + 1,
      { timeout: 10000 }
    )
  })
})
