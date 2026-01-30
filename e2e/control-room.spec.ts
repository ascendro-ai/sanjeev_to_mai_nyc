/*
 * Control Room E2E Tests
 * Uncomment when tests are enabled
 */

// import { test, expect } from '@playwright/test'
// import {
//   loginAsTestUser,
//   seedPendingReviewRequest,
//   seedRunningExecution,
//   triggerActivityLog,
//   triggerExecutionUpdate
// } from './seeds'

// test.describe('Control Room', () => {
//   test.beforeEach(async ({ page }) => {
//     await loginAsTestUser(page)
//     await seedPendingReviewRequest()
//     await page.goto('/control-room')
//   })

//   test('should display control room layout', async ({ page }) => {
//     await expect(page.locator('[data-testid="pending-reviews-section"]')).toBeVisible()
//     await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible()
//   })

//   test('should display pending review requests', async ({ page }) => {
//     await expect(page.locator('[data-testid="pending-review-card"]')).toBeVisible()
//     await expect(page.locator('text=Pending Reviews (1)')).toBeVisible()
//   })

//   test('should show review request details', async ({ page }) => {
//     await page.click('[data-testid="pending-review-card"]')

//     await expect(page.locator('[data-testid="review-detail-modal"]')).toBeVisible()
//     await expect(page.locator('[data-testid="action-data"]')).toBeVisible()
//     await expect(page.locator('[data-testid="worker-name"]')).toBeVisible()
//   })

//   test('should approve review request', async ({ page }) => {
//     await page.click('[data-testid="approve-btn"]')

//     await expect(page.locator('text=All caught up!')).toBeVisible()
//   })

//   test('should approve with feedback', async ({ page }) => {
//     await page.click('[data-testid="pending-review-card"]')
//     await page.fill('[data-testid="feedback-input"]', 'Looks good!')
//     await page.click('[data-testid="approve-with-feedback-btn"]')

//     await expect(page.locator('text=All caught up!')).toBeVisible()
//   })

//   test('should reject review with required feedback', async ({ page }) => {
//     await page.click('[data-testid="pending-review-card"]')
//     await page.click('[data-testid="reject-btn"]')

//     // Should show feedback required error
//     await expect(page.locator('text=Feedback required')).toBeVisible()

//     await page.fill('[data-testid="feedback-input"]', 'Please revise the email tone')
//     await page.click('[data-testid="reject-btn"]')

//     await expect(page.locator('text=All caught up!')).toBeVisible()
//   })

//   test('should chat with agent', async ({ page }) => {
//     await page.click('[data-testid="pending-review-card"]')
//     await page.fill('[data-testid="chat-input"]', 'Can you clarify the customer request?')
//     await page.click('[data-testid="send-chat-btn"]')

//     await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(1)
//   })

//   test('should show real-time activity feed', async ({ page }) => {
//     await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible()

//     // Trigger activity log via API
//     await triggerActivityLog()

//     // Verify real-time update (within reasonable timeout)
//     await expect(page.locator('[data-testid="activity-item"]')).toBeVisible({ timeout: 10000 })
//   })

//   test('should show execution status updates in real-time', async ({ page }) => {
//     const execution = await seedRunningExecution()
//     await page.reload()

//     // Trigger execution update
//     await triggerExecutionUpdate(execution.id)

//     await expect(page.locator('[data-testid="execution-status"]')).toHaveText('completed', { timeout: 10000 })
//   })

//   test('should display execution details', async ({ page }) => {
//     await seedRunningExecution()
//     await page.reload()

//     await page.click('[data-testid="execution-card"]')

//     await expect(page.locator('[data-testid="execution-detail-modal"]')).toBeVisible()
//     await expect(page.locator('[data-testid="execution-steps"]')).toBeVisible()
//   })

//   test('should filter activity by type', async ({ page }) => {
//     await page.click('[data-testid="activity-filter"]')
//     await page.click('[data-testid="filter-review-requested"]')

//     // Only review_requested events should be shown
//     const items = page.locator('[data-testid="activity-item"]')
//     for (const item of await items.all()) {
//       await expect(item).toContainText('review')
//     }
//   })

//   test('should show empty state when no pending reviews', async ({ page }) => {
//     // Clear all review requests
//     await page.request.delete('/api/test/clear-reviews')
//     await page.reload()

//     await expect(page.locator('text=All caught up!')).toBeVisible()
//   })

//   test('should handle multiple review requests', async ({ page }) => {
//     // Seed multiple review requests
//     await seedPendingReviewRequest()
//     await seedPendingReviewRequest()
//     await page.reload()

//     await expect(page.locator('[data-testid="pending-review-card"]')).toHaveCount(3)
//     await expect(page.locator('text=Pending Reviews (3)')).toBeVisible()
//   })

//   test('should navigate to workflow from review', async ({ page }) => {
//     await page.click('[data-testid="pending-review-card"]')
//     await page.click('[data-testid="view-workflow-btn"]')

//     await expect(page).toHaveURL(/\/workflows\/[a-f0-9-]+/)
//   })

//   test('should show review request age', async ({ page }) => {
//     await expect(page.locator('[data-testid="review-age"]')).toBeVisible()
//     await expect(page.locator('[data-testid="review-age"]')).toContainText(/\d+ (second|minute|hour|day)s? ago/)
//   })
// })

export {}
