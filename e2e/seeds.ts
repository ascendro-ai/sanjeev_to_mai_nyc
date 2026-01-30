import { Page } from '@playwright/test'

// Test user credentials
const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com'
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'test-password-123'
const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:3000'

/**
 * Login as test user
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', TEST_USER_EMAIL)
  await page.fill('[data-testid="password-input"]', TEST_USER_PASSWORD)
  await page.click('[data-testid="login-btn"]')
  await page.waitForURL('/', { timeout: 10000 })
}

/**
 * Seed a test workflow
 */
export async function seedTestWorkflow(page?: Page): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/api/test/seed-workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Workflow',
      status: 'draft',
      steps: [
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        {
          id: 'step-2',
          label: 'AI Process',
          type: 'action',
          assignedTo: { type: 'ai', agentName: 'Test Agent' },
          order: 1,
        },
        { id: 'step-3', label: 'Complete', type: 'end', order: 2 },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to seed workflow')
  }

  return response.json()
}

/**
 * Seed an active workflow
 */
export async function seedActiveWorkflow(): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/api/test/seed-workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Active Test Workflow',
      status: 'active',
      steps: [
        { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
        { id: 'step-2', label: 'Process', type: 'action', assignedTo: { type: 'ai' }, order: 1 },
      ],
    }),
  })

  return response.json()
}

/**
 * Seed multiple workflows
 */
export async function seedMultipleWorkflows(): Promise<void> {
  await Promise.all([
    seedTestWorkflow(),
    seedActiveWorkflow(),
    fetch(`${API_BASE_URL}/api/test/seed-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email Automation',
        status: 'paused',
        steps: [{ id: 'step-1', label: 'Email Trigger', type: 'trigger', order: 0 }],
      }),
    }),
  ])
}

/**
 * Seed a pending review request
 */
export async function seedPendingReviewRequest(): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/api/test/seed-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'pending',
      reviewType: 'approval',
      workerName: 'Email Agent',
      reviewData: {
        action: 'send_email',
        to: 'customer@example.com',
        subject: 'Re: Your inquiry',
        body: 'Thank you for reaching out...',
      },
    }),
  })

  return response.json()
}

/**
 * Seed a running execution
 */
export async function seedRunningExecution(): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/api/test/seed-execution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'running',
      currentStepIndex: 1,
    }),
  })

  return response.json()
}

/**
 * Trigger an activity log entry
 */
export async function triggerActivityLog(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/test/trigger-activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'workflow_step_execution',
      workerName: 'Test Agent',
      data: { message: 'Processing step' },
    }),
  })
}

/**
 * Trigger an execution status update
 */
export async function triggerExecutionUpdate(executionId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/test/trigger-execution-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executionId,
      status: 'completed',
    }),
  })
}

/**
 * Complete a workflow conversation for testing
 */
export async function completeWorkflowConversation(
  page: Page,
  workflowType: 'email automation' | 'data sync' | 'custom'
): Promise<void> {
  const chatInput = page.locator('[data-testid="chat-input"]')
  const sendBtn = page.locator('[data-testid="send-btn"]')

  if (workflowType === 'email automation') {
    await chatInput.fill('I need to automate email responses for customer inquiries')
    await sendBtn.click()
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    await chatInput.fill('The AI should read emails and draft responses for me to approve')
    await sendBtn.click()
    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(2)', { timeout: 30000 })

    await chatInput.fill('I need Gmail integration and want to review before sending')
    await sendBtn.click()
    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(3)', { timeout: 30000 })
  } else if (workflowType === 'data sync') {
    await chatInput.fill('I need to sync data between my CRM and spreadsheet')
    await sendBtn.click()
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    await chatInput.fill('New contacts in CRM should be added to Google Sheets daily')
    await sendBtn.click()
    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(2)', { timeout: 30000 })
  }
}

/**
 * Seed a workflow template
 */
export async function seedWorkflowTemplate(): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/api/test/seed-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Template',
      category: 'communication',
      description: 'A test template',
      isPublic: true,
      workflowDefinition: {
        name: 'Test Template',
        steps: [
          { id: 'step-1', label: 'Start', type: 'trigger', order: 0 },
          { id: 'step-2', label: 'Process', type: 'action', order: 1 },
        ],
      },
    }),
  })

  return response.json()
}

/**
 * Clear all test data
 */
export async function clearTestData(): Promise<void> {
  await Promise.all([
    fetch(`${API_BASE_URL}/api/test/clear-workflows`, { method: 'DELETE' }),
    fetch(`${API_BASE_URL}/api/test/clear-reviews`, { method: 'DELETE' }),
    fetch(`${API_BASE_URL}/api/test/clear-executions`, { method: 'DELETE' }),
  ])
}
