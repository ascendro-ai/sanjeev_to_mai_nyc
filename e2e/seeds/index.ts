/*
 * E2E Test Seed Functions
 * Uncomment when tests are enabled
 */

// import { createClient } from '@supabase/supabase-js'
// import type { Page } from '@playwright/test'

// const supabase = createClient(
//   process.env.SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// )

// // Authentication helpers
// export async function loginAsTestUser(page: Page) {
//   await page.goto('/login')
//   await page.fill('[data-testid="email-input"]', 'test@example.com')
//   await page.fill('[data-testid="password-input"]', 'testpassword123')
//   await page.click('[data-testid="login-btn"]')
//   await page.waitForURL('/create')
// }

// export async function seedTestUser() {
//   const { data: user } = await supabase.auth.admin.createUser({
//     email: 'test@example.com',
//     password: 'testpassword123',
//     email_confirm: true,
//   })
//   return user
// }

// // Organization helpers
// export async function seedTestOrganization(userId: string) {
//   const { data: org } = await supabase.from('organizations').insert({
//     name: 'Test Organization',
//     slug: 'test-org',
//   }).select().single()

//   await supabase.from('organization_members').insert({
//     organization_id: org.id,
//     user_id: userId,
//     role: 'owner',
//   })

//   return org
// }

// // Workflow helpers
// export async function seedTestWorkflow(orgId?: string, overrides?: Partial<any>) {
//   const { data } = await supabase.from('workflows').insert({
//     organization_id: orgId || 'default-org',
//     name: overrides?.name || 'Test Workflow',
//     description: overrides?.description || 'A test workflow',
//     status: overrides?.status || 'draft',
//     is_active: overrides?.isActive || false,
//   }).select().single()

//   return data
// }

// export async function seedActiveWorkflow(orgId?: string) {
//   return seedTestWorkflow(orgId, { status: 'active', isActive: true })
// }

// export async function seedMultipleWorkflows(orgId?: string, count = 3) {
//   const workflows = []
//   for (let i = 0; i < count; i++) {
//     const status = i === 0 ? 'active' : i === 1 ? 'paused' : 'draft'
//     const wf = await seedTestWorkflow(orgId, {
//       name: `Workflow ${i + 1}`,
//       status
//     })
//     workflows.push(wf)
//   }
//   return workflows
// }

// // Worker helpers
// export async function seedTestWorker(orgId?: string, overrides?: Partial<any>) {
//   const { data } = await supabase.from('digital_workers').insert({
//     organization_id: orgId || 'default-org',
//     name: overrides?.name || 'Test Worker',
//     type: overrides?.type || 'ai',
//     status: overrides?.status || 'inactive',
//     description: overrides?.description || 'A test worker',
//     personality: overrides?.personality || { tone: 'professional', verbosity: 'concise' },
//   }).select().single()

//   return data
// }

// export async function seedTestWorkers(orgId?: string, count = 3) {
//   const workers = []
//   for (let i = 0; i < count; i++) {
//     const worker = await seedTestWorker(orgId, {
//       name: `Worker ${i + 1}`,
//       type: i % 2 === 0 ? 'ai' : 'human',
//       status: i % 2 === 0 ? 'active' : 'inactive',
//     })
//     workers.push(worker)
//   }
//   return workers
// }

// // Review request helpers
// export async function seedPendingReviewRequest(executionId?: string) {
//   const { data } = await supabase.from('review_requests').insert({
//     execution_id: executionId || 'default-exec',
//     step_id: 'step-123',
//     step_index: 0,
//     worker_name: 'Test Worker',
//     status: 'pending',
//     review_type: 'approval',
//     review_data: {
//       action: 'send_email',
//       content: 'Test email content',
//       recipient: 'customer@example.com',
//     },
//     chat_history: [],
//   }).select().single()

//   return data
// }

// // Execution helpers
// export async function seedRunningExecution(workflowId?: string) {
//   const { data } = await supabase.from('executions').insert({
//     workflow_id: workflowId || 'default-workflow',
//     status: 'running',
//     current_step_index: 0,
//     trigger_type: 'manual',
//     trigger_data: {},
//     started_at: new Date().toISOString(),
//   }).select().single()

//   return data
// }

// // Activity log helpers
// export async function triggerActivityLog() {
//   await supabase.from('activity_logs').insert({
//     event_type: 'test_event',
//     actor_type: 'system',
//     actor_name: 'Test System',
//     metadata: { test: true },
//   })
// }

// export async function triggerExecutionUpdate(executionId: string) {
//   await supabase.from('executions').update({
//     status: 'completed',
//     completed_at: new Date().toISOString(),
//   }).eq('id', executionId)
// }

// // Conversation helpers
// export async function completeWorkflowConversation(page: Page, topic: string) {
//   const messages = [
//     `I need to automate ${topic}`,
//     'My worker should handle incoming requests',
//     'They should analyze and categorize the request',
//     'Then route to the appropriate team member',
//     'Finally send a confirmation',
//   ]

//   for (const message of messages) {
//     await page.fill('[data-testid="chat-input"]', message)
//     await page.click('[data-testid="send-btn"]')
//     await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })
//   }
// }

// // Cleanup helpers
// export async function cleanupTestData() {
//   // Delete in correct order due to foreign keys
//   await supabase.from('review_requests').delete().neq('id', '')
//   await supabase.from('execution_steps').delete().neq('id', '')
//   await supabase.from('executions').delete().neq('id', '')
//   await supabase.from('activity_logs').delete().neq('id', '')
//   await supabase.from('workflow_steps').delete().neq('id', '')
//   await supabase.from('workflows').delete().neq('id', '')
//   await supabase.from('digital_workers').delete().neq('id', '')
//   await supabase.from('organization_members').delete().neq('id', '')
//   await supabase.from('organizations').delete().neq('id', '')
// }

export {}
