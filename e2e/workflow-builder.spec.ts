/*
 * Workflow Builder E2E Tests
 * Uncomment when tests are enabled
 */

// import { test, expect } from '@playwright/test'
// import { loginAsTestUser, completeWorkflowConversation } from './seeds'

// test.describe('Workflow Builder', () => {
//   test.beforeEach(async ({ page }) => {
//     await loginAsTestUser(page)
//     await page.goto('/create')
//   })

//   test('should display chat interface', async ({ page }) => {
//     await expect(page.locator('[data-testid="chat-container"]')).toBeVisible()
//     await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
//   })

//   test('should conduct consultant conversation', async ({ page }) => {
//     const chatInput = page.locator('[data-testid="chat-input"]')
//     const sendBtn = page.locator('[data-testid="send-btn"]')

//     // User describes workflow
//     await chatInput.fill('I need to automate email responses for customer inquiries')
//     await sendBtn.click()

//     // Wait for AI response
//     await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible({ timeout: 30000 })

//     // Continue conversation
//     await chatInput.fill('My worker reads the email and decides if it needs escalation')
//     await sendBtn.click()

//     // Wait for another response
//     await expect(page.locator('[data-testid="assistant-message"]').nth(1)).toBeVisible({ timeout: 30000 })
//   })

//   test('should show workflow steps as conversation progresses', async ({ page }) => {
//     await completeWorkflowConversation(page, 'email automation')

//     // Verify steps are displayed
//     const steps = page.locator('[data-testid="workflow-step"]')
//     await expect(steps).toHaveCount.greaterThan(0)
//   })

//   test('should extract and display workflow steps', async ({ page }) => {
//     await completeWorkflowConversation(page, 'email automation')

//     // Verify workflow preview shows steps
//     await expect(page.locator('[data-testid="workflow-preview"]')).toBeVisible()
//     await expect(page.locator('[data-testid="step-trigger"]')).toBeVisible()
//   })

//   test('should handle conversation completion signals', async ({ page }) => {
//     await completeWorkflowConversation(page, 'email automation')

//     const chatInput = page.locator('[data-testid="chat-input"]')
//     await chatInput.fill("that's perfect, let's build")
//     await page.click('[data-testid="send-btn"]')

//     // Should show completion message or create workflow button
//     await expect(page.locator('[data-testid="create-workflow-btn"]')).toBeVisible({ timeout: 30000 })
//   })

//   test('should allow switching between n8n and Gemini chat modes', async ({ page }) => {
//     // Check for mode toggle
//     const modeToggle = page.locator('[data-testid="chat-mode-toggle"]')
//     if (await modeToggle.isVisible()) {
//       await modeToggle.click()
//       await expect(page.locator('[data-testid="chat-mode-n8n"]')).toBeVisible()
//     }
//   })

//   test('should save workflow after completion', async ({ page }) => {
//     await completeWorkflowConversation(page, 'email automation')

//     const chatInput = page.locator('[data-testid="chat-input"]')
//     await chatInput.fill("that's perfect, let's save this workflow")
//     await page.click('[data-testid="send-btn"]')

//     // Wait for save confirmation
//     await expect(page.locator('text=Workflow saved')).toBeVisible({ timeout: 30000 })
//   })

//   test('should allow editing workflow name', async ({ page }) => {
//     await completeWorkflowConversation(page, 'email automation')

//     // Click on workflow name to edit
//     await page.click('[data-testid="workflow-name"]')
//     await page.fill('[data-testid="workflow-name-input"]', 'My Custom Workflow')
//     await page.click('[data-testid="save-name-btn"]')

//     await expect(page.locator('text=My Custom Workflow')).toBeVisible()
//   })

//   test('should show typing indicator during AI response', async ({ page }) => {
//     const chatInput = page.locator('[data-testid="chat-input"]')
//     await chatInput.fill('I need to automate something')
//     await page.click('[data-testid="send-btn"]')

//     // Typing indicator should appear briefly
//     await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible()
//   })

//   test('should clear conversation on new workflow', async ({ page }) => {
//     await completeWorkflowConversation(page, 'email automation')

//     // Start new workflow
//     await page.click('[data-testid="new-workflow-btn"]')

//     // Confirm clear dialog
//     await page.click('[data-testid="confirm-clear-btn"]')

//     // Chat should be empty
//     await expect(page.locator('[data-testid="assistant-message"]')).toHaveCount(0)
//   })
// })

export {}
