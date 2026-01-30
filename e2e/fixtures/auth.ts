/*
 * Auth Fixtures for E2E Tests
 * Uncomment when tests are enabled
 */

// import { test as base, expect } from '@playwright/test'
// import type { Page } from '@playwright/test'

// // Extend test with authenticated user fixture
// type AuthFixtures = {
//   authenticatedPage: Page
// }

// export const test = base.extend<AuthFixtures>({
//   authenticatedPage: async ({ page }, use) => {
//     // Navigate to login
//     await page.goto('/login')

//     // Fill in credentials
//     await page.fill('[data-testid="email-input"]', 'test@example.com')
//     await page.fill('[data-testid="password-input"]', 'testpassword123')

//     // Submit login
//     await page.click('[data-testid="login-btn"]')

//     // Wait for redirect to dashboard
//     await page.waitForURL('/create')

//     // Verify user is logged in
//     await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

//     // Use the authenticated page
//     await use(page)
//   },
// })

// export { expect }

// // Helper to create authenticated context
// export async function createAuthenticatedContext(browser: any) {
//   const context = await browser.newContext()
//   const page = await context.newPage()

//   await page.goto('/login')
//   await page.fill('[data-testid="email-input"]', 'test@example.com')
//   await page.fill('[data-testid="password-input"]', 'testpassword123')
//   await page.click('[data-testid="login-btn"]')
//   await page.waitForURL('/create')

//   // Save storage state for reuse
//   await context.storageState({ path: 'playwright/.auth/user.json' })

//   return { context, page }
// }

// // Storage state path for authenticated sessions
// export const STORAGE_STATE = 'playwright/.auth/user.json'

export {}
