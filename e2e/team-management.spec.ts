/*
 * Team Management E2E Tests
 * Uncomment when tests are enabled
 */

// import { test, expect } from '@playwright/test'
// import { loginAsTestUser, seedTestWorker, seedTestWorkers } from './seeds'

// test.describe('Team Management', () => {
//   test.beforeEach(async ({ page }) => {
//     await loginAsTestUser(page)
//     await page.goto('/team')
//   })

//   test('should display team page', async ({ page }) => {
//     await expect(page.locator('[data-testid="team-header"]')).toBeVisible()
//   })

//   test('should display org chart', async ({ page }) => {
//     await seedTestWorkers()
//     await page.reload()

//     await expect(page.locator('[data-testid="org-chart"]')).toBeVisible()
//   })

//   test('should show worker list', async ({ page }) => {
//     await seedTestWorkers()
//     await page.reload()

//     const cards = page.locator('[data-testid="worker-card"]')
//     await expect(cards).toHaveCount.greaterThan(0)
//   })

//   test('should create new AI worker', async ({ page }) => {
//     await page.click('[data-testid="add-worker-btn"]')

//     await expect(page.locator('[data-testid="add-worker-modal"]')).toBeVisible()

//     await page.fill('[data-testid="worker-name"]', 'Email Assistant')
//     await page.selectOption('[data-testid="worker-type"]', 'ai')
//     await page.fill('[data-testid="worker-description"]', 'Handles email responses')
//     await page.click('[data-testid="save-worker-btn"]')

//     await expect(page.locator('text=Email Assistant')).toBeVisible()
//   })

//   test('should create new human worker', async ({ page }) => {
//     await page.click('[data-testid="add-worker-btn"]')

//     await page.fill('[data-testid="worker-name"]', 'John Doe')
//     await page.selectOption('[data-testid="worker-type"]', 'human')
//     await page.fill('[data-testid="worker-email"]', 'john@example.com')
//     await page.click('[data-testid="save-worker-btn"]')

//     await expect(page.locator('text=John Doe')).toBeVisible()
//   })

//   test('should validate required fields when creating worker', async ({ page }) => {
//     await page.click('[data-testid="add-worker-btn"]')
//     await page.click('[data-testid="save-worker-btn"]')

//     await expect(page.locator('text=Name is required')).toBeVisible()
//   })

//   test('should view worker details', async ({ page }) => {
//     await seedTestWorker()
//     await page.reload()

//     await page.click('[data-testid="worker-card"]')

//     await expect(page.locator('[data-testid="worker-detail-modal"]')).toBeVisible()
//     await expect(page.locator('[data-testid="worker-status"]')).toBeVisible()
//     await expect(page.locator('[data-testid="assigned-workflows"]')).toBeVisible()
//   })

//   test('should activate worker', async ({ page }) => {
//     await seedTestWorker({ status: 'inactive' })
//     await page.reload()

//     await page.click('[data-testid="worker-card"]')
//     await page.click('[data-testid="activate-worker-btn"]')

//     await expect(page.locator('[data-testid="worker-status"]')).toHaveText('active')
//   })

//   test('should deactivate worker', async ({ page }) => {
//     await seedTestWorker({ status: 'active' })
//     await page.reload()

//     await page.click('[data-testid="worker-card"]')
//     await page.click('[data-testid="deactivate-worker-btn"]')

//     await expect(page.locator('[data-testid="worker-status"]')).toHaveText('inactive')
//   })

//   test('should edit worker details', async ({ page }) => {
//     await seedTestWorker()
//     await page.reload()

//     await page.click('[data-testid="worker-card"]')
//     await page.click('[data-testid="edit-worker-btn"]')
//     await page.fill('[data-testid="worker-name"]', 'Updated Worker Name')
//     await page.click('[data-testid="save-worker-btn"]')

//     await expect(page.locator('text=Updated Worker Name')).toBeVisible()
//   })

//   test('should assign manager to worker', async ({ page }) => {
//     await seedTestWorkers() // Creates multiple workers
//     await page.reload()

//     await page.click('[data-testid="worker-card"]')
//     await page.click('[data-testid="assign-manager-btn"]')
//     await page.selectOption('[data-testid="manager-select"]', { index: 1 })
//     await page.click('[data-testid="save-manager-btn"]')

//     await expect(page.locator('[data-testid="manager-name"]')).toBeVisible()
//   })

//   test('should delete worker with confirmation', async ({ page }) => {
//     await seedTestWorker()
//     await page.reload()

//     const initialCount = await page.locator('[data-testid="worker-card"]').count()

//     await page.click('[data-testid="worker-card"]')
//     await page.click('[data-testid="delete-worker-btn"]')

//     await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible()
//     await page.click('[data-testid="confirm-delete-btn"]')

//     await expect(page.locator('[data-testid="worker-card"]')).toHaveCount(initialCount - 1)
//   })

//   test('should filter workers by type', async ({ page }) => {
//     await seedTestWorkers()
//     await page.reload()

//     await page.click('[data-testid="type-filter"]')
//     await page.click('[data-testid="filter-ai"]')

//     // Only AI workers should be shown
//     const cards = page.locator('[data-testid="worker-card"]')
//     for (const card of await cards.all()) {
//       await expect(card.locator('[data-testid="worker-type"]')).toHaveText('ai')
//     }
//   })

//   test('should filter workers by status', async ({ page }) => {
//     await seedTestWorkers()
//     await page.reload()

//     await page.click('[data-testid="status-filter"]')
//     await page.click('[data-testid="filter-active"]')

//     // Only active workers should be shown
//     const cards = page.locator('[data-testid="worker-card"]')
//     for (const card of await cards.all()) {
//       await expect(card.locator('[data-testid="worker-status"]')).toHaveText('active')
//     }
//   })

//   test('should search workers by name', async ({ page }) => {
//     await seedTestWorkers()
//     await page.reload()

//     await page.fill('[data-testid="search-input"]', 'Email')

//     // Only matching workers should be shown
//     const cards = page.locator('[data-testid="worker-card"]')
//     await expect(cards).toHaveCount.lessThan(3)
//   })

//   test('should show empty state when no workers', async ({ page }) => {
//     await expect(page.locator('[data-testid="empty-state"]')).toBeVisible()
//     await expect(page.locator('text=No team members yet')).toBeVisible()
//   })

//   test('should show worker performance metrics', async ({ page }) => {
//     await seedTestWorker({ status: 'active' })
//     await page.reload()

//     await page.click('[data-testid="worker-card"]')

//     await expect(page.locator('[data-testid="tasks-completed"]')).toBeVisible()
//     await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible()
//   })
// })

export {}
