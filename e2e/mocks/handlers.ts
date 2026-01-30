/*
 * MSW Handlers for E2E Tests
 * Uncomment when tests are enabled
 */

// import { http, HttpResponse } from 'msw'

// export const handlers = [
//   // Gemini API handlers
//   http.post('/api/gemini/consult', async () => {
//     return HttpResponse.json({
//       response: 'Tell me more about your workflow requirements...',
//       isComplete: false,
//     })
//   }),

//   http.post('/api/gemini/extract', async () => {
//     return HttpResponse.json({
//       workflow: {
//         name: 'Customer Email Response',
//         description: 'Automated email response workflow',
//         steps: [
//           { id: 'step-1', label: 'Receive Email', type: 'trigger', order: 0, assignedTo: { type: 'ai', agentName: 'Email Bot' } },
//           { id: 'step-2', label: 'Analyze Content', type: 'action', order: 1, assignedTo: { type: 'ai', agentName: 'Analyzer' } },
//           { id: 'step-3', label: 'Review Response', type: 'action', order: 2, assignedTo: { type: 'human', agentName: 'Support' } },
//           { id: 'step-4', label: 'Send Reply', type: 'end', order: 3, assignedTo: { type: 'ai', agentName: 'Email Bot' } },
//         ]
//       },
//       success: true,
//     })
//   }),

//   http.post('/api/gemini/extract-people', async () => {
//     return HttpResponse.json({
//       people: [
//         { name: 'Email Bot', type: 'ai', role: 'Email Handler' },
//         { name: 'Support Team', type: 'human', role: 'Reviewer' },
//       ],
//       success: true,
//     })
//   }),

//   http.post('/api/gemini/requirements', async () => {
//     return HttpResponse.json({
//       questions: ['What tone should the response have?'],
//       blueprint: {
//         greenList: ['professional tone', 'helpful'],
//         redList: ['aggressive', 'informal'],
//       }
//     })
//   }),

//   http.post('/api/gemini/build-agents', async () => {
//     return HttpResponse.json({
//       agents: [
//         {
//           name: 'Email Bot',
//           type: 'ai',
//           personality: { tone: 'professional', verbosity: 'concise' },
//           blueprint: {
//             greenList: ['professional responses', 'timely replies'],
//             redList: ['informal language', 'delays'],
//           }
//         }
//       ],
//       success: true,
//     })
//   }),

//   // n8n API handlers
//   http.post('/api/n8n/review-request', async () => {
//     return HttpResponse.json({
//       reviewId: 'review-123',
//       status: 'pending',
//     })
//   }),

//   http.get('/api/n8n/review-request', async () => {
//     return HttpResponse.json({
//       id: 'review-123',
//       executionId: 'exec-123',
//       status: 'pending',
//       reviewType: 'approval',
//       reviewData: {
//         action: 'send_email',
//         content: 'Test email content',
//       },
//       chatHistory: [],
//     })
//   }),

//   http.post('/api/n8n/review-response', async () => {
//     return HttpResponse.json({
//       success: true,
//     })
//   }),

//   http.post('/api/n8n/execution-update', async () => {
//     return HttpResponse.json({
//       success: true,
//     })
//   }),

//   http.post('/api/n8n/execution-complete', async () => {
//     return HttpResponse.json({
//       success: true,
//     })
//   }),

//   http.post('/api/n8n/sync', async () => {
//     return HttpResponse.json({
//       success: true,
//       workflowId: 'n8n-workflow-123',
//     })
//   }),

//   // Supabase REST API handlers (if not using real test DB)
//   http.get('*/rest/v1/workflows*', async () => {
//     return HttpResponse.json([
//       {
//         id: 'workflow-1',
//         name: 'Test Workflow',
//         description: 'A test workflow',
//         status: 'draft',
//         is_active: false,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//       }
//     ])
//   }),

//   http.get('*/rest/v1/digital_workers*', async () => {
//     return HttpResponse.json([
//       {
//         id: 'worker-1',
//         name: 'Test Worker',
//         type: 'ai',
//         status: 'active',
//         description: 'A test worker',
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//       }
//     ])
//   }),

//   http.get('*/rest/v1/review_requests*', async () => {
//     return HttpResponse.json([
//       {
//         id: 'review-1',
//         execution_id: 'exec-1',
//         status: 'pending',
//         review_type: 'approval',
//         review_data: { action: 'send_email' },
//         chat_history: [],
//         created_at: new Date().toISOString(),
//       }
//     ])
//   }),

//   http.get('*/rest/v1/executions*', async () => {
//     return HttpResponse.json([
//       {
//         id: 'exec-1',
//         workflow_id: 'workflow-1',
//         status: 'running',
//         started_at: new Date().toISOString(),
//       }
//     ])
//   }),

//   http.get('*/rest/v1/activity_logs*', async () => {
//     return HttpResponse.json([
//       {
//         id: 'log-1',
//         event_type: 'workflow_started',
//         actor_type: 'user',
//         actor_name: 'Test User',
//         metadata: {},
//         created_at: new Date().toISOString(),
//       }
//     ])
//   }),

//   // Auth handlers
//   http.post('*/auth/v1/token*', async () => {
//     return HttpResponse.json({
//       access_token: 'mock-access-token',
//       refresh_token: 'mock-refresh-token',
//       user: {
//         id: 'user-123',
//         email: 'test@example.com',
//       }
//     })
//   }),
// ]

export {}
