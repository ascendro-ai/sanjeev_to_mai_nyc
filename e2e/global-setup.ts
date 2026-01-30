/*
 * Global Setup for E2E Tests
 * Uncomment when tests are enabled
 */

// import { chromium, FullConfig } from '@playwright/test'
// import { createClient } from '@supabase/supabase-js'

// async function globalSetup(config: FullConfig) {
//   console.log('Running global setup...')

//   // Initialize Supabase client for seeding
//   const supabase = createClient(
//     process.env.SUPABASE_URL!,
//     process.env.SUPABASE_SERVICE_ROLE_KEY!
//   )

//   // Create test user if it doesn't exist
//   const { data: existingUser } = await supabase.auth.admin.getUserByEmail('test@example.com')

//   if (!existingUser) {
//     console.log('Creating test user...')
//     const { data: user, error } = await supabase.auth.admin.createUser({
//       email: 'test@example.com',
//       password: 'testpassword123',
//       email_confirm: true,
//     })

//     if (error) {
//       console.error('Failed to create test user:', error)
//     } else {
//       // Create default organization for test user
//       const { data: org } = await supabase.from('organizations').insert({
//         name: 'Test Organization',
//         slug: 'test-org',
//       }).select().single()

//       if (org && user.user) {
//         await supabase.from('organization_members').insert({
//           organization_id: org.id,
//           user_id: user.user.id,
//           role: 'owner',
//         })
//       }
//     }
//   } else {
//     console.log('Test user already exists')
//   }

//   // Create authenticated state
//   const browser = await chromium.launch()
//   const context = await browser.newContext()
//   const page = await context.newPage()

//   try {
//     // Navigate to login and authenticate
//     await page.goto(`${config.projects[0].use.baseURL}/login`)
//     await page.fill('[data-testid="email-input"]', 'test@example.com')
//     await page.fill('[data-testid="password-input"]', 'testpassword123')
//     await page.click('[data-testid="login-btn"]')

//     // Wait for successful login
//     await page.waitForURL('**/create', { timeout: 10000 })

//     // Save storage state for authenticated tests
//     await context.storageState({ path: 'playwright/.auth/user.json' })
//     console.log('Authentication state saved')
//   } catch (error) {
//     console.error('Failed to authenticate test user:', error)
//   } finally {
//     await browser.close()
//   }

//   console.log('Global setup complete')
// }

// export default globalSetup

export {}
