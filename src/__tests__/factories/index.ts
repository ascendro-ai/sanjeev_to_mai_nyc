/*
 * Test Data Factories
 * Uncomment and run `npm install -D @faker-js/faker` to enable
 */

// import { faker } from '@faker-js/faker'
// import type { Workflow, WorkflowStep, DigitalWorker, ReviewRequest, Execution } from '@/types'

// export function createWorkflow(overrides?: Partial<Workflow>): Workflow {
//   return {
//     id: faker.string.uuid(),
//     name: faker.company.catchPhrase(),
//     description: faker.lorem.sentence(),
//     steps: [createWorkflowStep({ type: 'trigger', order: 0 })],
//     status: 'draft',
//     isActive: false,
//     organizationId: faker.string.uuid(),
//     createdAt: faker.date.recent(),
//     updatedAt: faker.date.recent(),
//     ...overrides,
//   }
// }

// export function createWorkflowStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
//   return {
//     id: faker.string.uuid(),
//     label: faker.lorem.words(3),
//     type: 'action',
//     order: 0,
//     assignedTo: {
//       type: faker.helpers.arrayElement(['ai', 'human']),
//       agentName: faker.person.fullName(),
//     },
//     config: {},
//     ...overrides,
//   }
// }

// export function createDigitalWorker(overrides?: Partial<DigitalWorker>): DigitalWorker {
//   return {
//     id: faker.string.uuid(),
//     organizationId: faker.string.uuid(),
//     name: faker.person.fullName(),
//     description: faker.lorem.sentence(),
//     type: faker.helpers.arrayElement(['ai', 'human']),
//     status: 'inactive',
//     personality: { tone: 'professional', verbosity: 'concise' },
//     metadata: {},
//     createdAt: faker.date.recent(),
//     updatedAt: faker.date.recent(),
//     ...overrides,
//   }
// }

// export function createReviewRequest(overrides?: Partial<ReviewRequest>): ReviewRequest {
//   return {
//     id: faker.string.uuid(),
//     executionId: faker.string.uuid(),
//     stepId: faker.string.uuid(),
//     stepIndex: 0,
//     workerName: faker.person.fullName(),
//     status: 'pending',
//     reviewType: 'approval',
//     reviewData: {
//       action: 'send_email',
//       content: faker.lorem.paragraph(),
//       recipient: faker.internet.email(),
//     },
//     chatHistory: [],
//     createdAt: faker.date.recent(),
//     ...overrides,
//   }
// }

// export function createExecution(overrides?: Partial<Execution>): Execution {
//   return {
//     id: faker.string.uuid(),
//     workflowId: faker.string.uuid(),
//     workflowName: faker.company.catchPhrase(),
//     status: 'running',
//     currentStepIndex: 0,
//     triggerType: 'manual',
//     triggerData: {},
//     startedAt: faker.date.recent(),
//     createdAt: faker.date.recent(),
//     ...overrides,
//   }
// }

// export function createActivityLog(overrides?: Partial<any>): any {
//   return {
//     id: faker.string.uuid(),
//     eventType: faker.helpers.arrayElement(['workflow_started', 'step_completed', 'review_requested', 'workflow_completed']),
//     actorType: faker.helpers.arrayElement(['user', 'system', 'ai']),
//     actorId: faker.string.uuid(),
//     actorName: faker.person.fullName(),
//     metadata: {},
//     createdAt: faker.date.recent(),
//     ...overrides,
//   }
// }

// export function createConversationMessage(overrides?: Partial<any>): any {
//   return {
//     sender: faker.helpers.arrayElement(['user', 'system']),
//     text: faker.lorem.sentence(),
//     timestamp: faker.date.recent(),
//     ...overrides,
//   }
// }

// // Batch creators
// export function createWorkflows(count: number, overrides?: Partial<Workflow>): Workflow[] {
//   return Array.from({ length: count }, () => createWorkflow(overrides))
// }

// export function createWorkflowSteps(count: number, overrides?: Partial<WorkflowStep>): WorkflowStep[] {
//   return Array.from({ length: count }, (_, i) => createWorkflowStep({ order: i, ...overrides }))
// }

// export function createDigitalWorkers(count: number, overrides?: Partial<DigitalWorker>): DigitalWorker[] {
//   return Array.from({ length: count }, () => createDigitalWorker(overrides))
// }

// export function createReviewRequests(count: number, overrides?: Partial<ReviewRequest>): ReviewRequest[] {
//   return Array.from({ length: count }, () => createReviewRequest(overrides))
// }

export {}
