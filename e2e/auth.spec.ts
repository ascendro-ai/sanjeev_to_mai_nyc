/*
 * Authentication E2E Tests
 * Uncomment when tests are enabled
 */

// import { test, expect } from '@playwright/test'
// import { loginAsTestUser, seedTestUser } from './seeds'

// test.describe('Authentication', () => {
//   test.beforeEach(async ({ page }) => {
//     // Clear any existing session
//     await page.context().clearCookies()
//   })

//   test('should display login page for unauthenticated users', async ({ page }) => {
//     await page.goto('/workflows')
//     await expect(page).toHaveURL('/login')
//   })

//   test('should login with email/password', async ({ page }) => {
//     await page.goto('/login')
//     await page.fill('[data-testid="email-input"]', 'test@example.com')
//     await page.fill('[data-testid="password-input"]', 'password123')
//     await page.click('[data-testid="login-btn"]')
//     await expect(page).toHaveURL('/create')
//   })

//   test('should show error for invalid credentials', async ({ page }) => {
//     await page.goto('/login')
//     await page.fill('[data-testid="email-input"]', 'wrong@example.com')
//     await page.fill('[data-testid="password-input"]', 'wrongpassword')
//     await page.click('[data-testid="login-btn"]')
//     await expect(page.locator('text=Invalid credentials')).toBeVisible()
//   })

//   test('should login with Google OAuth', async ({ page }) => {
//     await page.goto('/login')
//     await page.click('[data-testid="google-login-btn"]')
//     // Mock OAuth flow would redirect back
//     await expect(page).toHaveURL('/create')
//   })

//   test('should signup new user', async ({ page }) => {
//     await page.goto('/signup')
//     await page.fill('[data-testid="email-input"]', 'new@example.com')
//     await page.fill('[data-testid="password-input"]', 'password123')
//     await page.fill('[data-testid="confirm-password-input"]', 'password123')
//     await page.click('[data-testid="signup-btn"]')
//     await expect(page.locator('text=Check your email')).toBeVisible()
//   })

//   test('should show password mismatch error', async ({ page }) => {
//     await page.goto('/signup')
//     await page.fill('[data-testid="email-input"]', 'new@example.com')
//     await page.fill('[data-testid="password-input"]', 'password123')
//     await page.fill('[data-testid="confirm-password-input"]', 'different123')
//     await page.click('[data-testid="signup-btn"]')
//     await expect(page.locator('text=Passwords do not match')).toBeVisible()
//   })

//   test('should logout and redirect to login', async ({ page }) => {
//     await loginAsTestUser(page)
//     await page.click('[data-testid="user-menu"]')
//     await page.click('[data-testid="logout-btn"]')
//     await expect(page).toHaveURL('/login')
//   })

//   test('should protect all dashboard routes', async ({ page }) => {
//     const protectedRoutes = ['/create', '/workflows', '/team', '/control-room']
//     for (const route of protectedRoutes) {
//       await page.goto(route)
//       await expect(page).toHaveURL('/login')
//     }
//   })

//   test('should redirect to intended page after login', async ({ page }) => {
//     await page.goto('/workflows')
//     // Should redirect to login
//     await expect(page).toHaveURL('/login?redirect=/workflows')

//     // Login
//     await page.fill('[data-testid="email-input"]', 'test@example.com')
//     await page.fill('[data-testid="password-input"]', 'password123')
//     await page.click('[data-testid="login-btn"]')

//     // Should redirect back to intended page
//     await expect(page).toHaveURL('/workflows')
//   })

//   test('should persist session across page refreshes', async ({ page }) => {
//     await loginAsTestUser(page)
//     await page.goto('/create')
//     await page.reload()
//     await expect(page).toHaveURL('/create')
//   })

//   test('should handle session expiry gracefully', async ({ page }) => {
//     await loginAsTestUser(page)
//     // Clear cookies to simulate expiry
//     await page.context().clearCookies()
//     await page.goto('/workflows')
//     await expect(page).toHaveURL('/login')
//   })
// })

export {}
