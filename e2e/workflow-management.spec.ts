/*
 * Workflow Management E2E Tests
 * Uncomment when tests are enabled
 */

// import { test, expect } from '@playwright/test'
// import { loginAsTestUser, seedTestWorkflow, seedActiveWorkflow, seedMultipleWorkflows } from './seeds'

// test.describe('Workflow Management', () => {
//   test.beforeEach(async ({ page }) => {
//     await loginAsTestUser(page)
//     await seedTestWorkflow()
//     await page.goto('/workflows')
//   })

//   test('should display workflow list', async ({ page }) => {
//     await expect(page.locator('[data-testid="workflow-card"]')).toHaveCount(1)
//   })

//   test('should show workflow details', async ({ page }) => {
//     await expect(page.locator('[data-testid="workflow-name"]')).toBeVisible()
//     await expect(page.locator('[data-testid="workflow-status"]')).toBeVisible()
//     await expect(page.locator('[data-testid="workflow-step-count"]')).toBeVisible()
//   })

//   test('should navigate to workflow detail', async ({ page }) => {
//     await page.click('[data-testid="workflow-card"]')
//     await expect(page).toHaveURL(/\/workflows\/[a-f0-9-]+/)
//   })

//   test('should edit workflow name', async ({ page }) => {
//     await page.click('[data-testid="workflow-card"]')
//     await page.click('[data-testid="edit-name-btn"]')
//     await page.fill('[data-testid="workflow-name-input"]', 'Updated Workflow Name')
//     await page.click('[data-testid="save-name-btn"]')

//     await expect(page.locator('text=Updated Workflow Name')).toBeVisible()
//   })

//   test('should edit workflow description', async ({ page }) => {
//     await page.click('[data-testid="workflow-card"]')
//     await page.click('[data-testid="edit-description-btn"]')
//     await page.fill('[data-testid="workflow-description-input"]', 'Updated description')
//     await page.click('[data-testid="save-description-btn"]')

//     await expect(page.locator('text=Updated description')).toBeVisible()
//   })

//   test('should edit workflow steps', async ({ page }) => {
//     await page.click('[data-testid="workflow-card"]')
//     await page.click('[data-testid="edit-step-btn"]')
//     await page.fill('[data-testid="step-label-input"]', 'Updated Step Label')
//     await page.click('[data-testid="save-step-btn"]')

//     await expect(page.locator('text=Updated Step Label')).toBeVisible()
//   })

//   test('should activate workflow', async ({ page }) => {
//     await page.click('[data-testid="workflow-card"]')
//     await page.click('[data-testid="activate-btn"]')

//     await expect(page.locator('[data-testid="status-badge"]')).toHaveText('active')
//   })

//   test('should pause active workflow', async ({ page }) => {
//     await seedActiveWorkflow()
//     await page.reload()
//     await page.click('[data-testid="workflow-card"]:has([data-testid="status-badge"]:text("active"))')
//     await page.click('[data-testid="pause-btn"]')

//     await expect(page.locator('[data-testid="status-badge"]')).toHaveText('paused')
//   })

//   test('should delete workflow with confirmation', async ({ page }) => {
//     await page.click('[data-testid="workflow-card"]')
//     await page.click('[data-testid="delete-btn"]')

//     // Confirmation modal
//     await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible()
//     await page.click('[data-testid="confirm-delete-btn"]')

//     await expect(page.locator('[data-testid="workflow-card"]')).toHaveCount(0)
//   })

//   test('should cancel workflow deletion', async ({ page }) => {
//     await page.click('[data-testid="workflow-card"]')
//     await page.click('[data-testid="delete-btn"]')

//     // Cancel in confirmation modal
//     await page.click('[data-testid="cancel-delete-btn"]')

//     // Should still be on detail page
//     await expect(page).toHaveURL(/\/workflows\/[a-f0-9-]+/)
//   })

//   test('should filter workflows by status', async ({ page }) => {
//     await seedMultipleWorkflows()
//     await page.reload()

//     await page.click('[data-testid="status-filter"]')
//     await page.click('[data-testid="filter-active"]')

//     // Only active workflows should be shown
//     const cards = page.locator('[data-testid="workflow-card"]')
//     for (const card of await cards.all()) {
//       await expect(card.locator('[data-testid="status-badge"]')).toHaveText('active')
//     }
//   })

//   test('should search workflows by name', async ({ page }) => {
//     await seedMultipleWorkflows()
//     await page.reload()

//     await page.fill('[data-testid="search-input"]', 'Email')

//     // Only matching workflows should be shown
//     await expect(page.locator('[data-testid="workflow-card"]')).toHaveCount.lessThan(3)
//   })

//   test('should sort workflows by date', async ({ page }) => {
//     await seedMultipleWorkflows()
//     await page.reload()

//     await page.click('[data-testid="sort-dropdown"]')
//     await page.click('[data-testid="sort-oldest"]')

//     // Verify sorting (first card should be oldest)
//     const firstCard = page.locator('[data-testid="workflow-card"]').first()
//     await expect(firstCard).toBeVisible()
//   })

//   test('should show empty state when no workflows', async ({ page }) => {
//     // Clear all workflows
//     await page.request.delete('/api/test/clear-workflows')
//     await page.reload()

//     await expect(page.locator('[data-testid="empty-state"]')).toBeVisible()
//     await expect(page.locator('text=No workflows yet')).toBeVisible()
//   })
// })

export {}
