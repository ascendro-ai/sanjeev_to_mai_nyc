// ============================================================================
// TESTING TYPES
// ============================================================================

/**
 * A test case defines a reusable test configuration for a workflow
 */
export interface TestCase {
  id: string
  organizationId: string
  workflowId: string
  name: string
  description?: string
  mockTriggerData: Record<string, unknown>
  mockStepInputs: Record<string, Record<string, unknown>>
  expectedOutputs: Record<string, unknown>
  assertions: TestAssertion[]
  tags?: string[]
  isActive: boolean
  lastRunAt?: Date
  lastRunStatus?: TestRunStatus
  createdBy?: string
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Status of a test run
 */
export type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'cancelled'

/**
 * Type of test run
 */
export type TestRunType = 'full_workflow' | 'single_step' | 'step_range'

/**
 * A test run represents a single execution of a test
 */
export interface TestRun {
  id: string
  organizationId: string
  testCaseId?: string
  workflowId: string
  executionId?: string
  runType: TestRunType
  targetStepIds?: string[]
  mockData: Record<string, unknown>
  status: TestRunStatus
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  totalAssertions: number
  passedAssertions: number
  failedAssertions: number
  assertionResults: AssertionResult[]
  errorMessage?: string
  errorStepId?: string
  createdBy?: string
  createdAt?: Date
}

/**
 * Status of a test step
 */
export type TestStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

/**
 * Results for a single step within a test run
 */
export interface TestStepResult {
  id: string
  testRunId: string
  stepId: string
  stepIndex: number
  stepName: string
  stepType: string
  status: TestStepStatus
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  expectedOutput?: Record<string, unknown>
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  assertionsPassed: number
  assertionsFailed: number
  assertionDetails: AssertionResult[]
  error?: string
  errorStack?: string
  createdAt?: Date
}

/**
 * Types of assertions supported
 */
export type AssertionType =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'isTrue'
  | 'isFalse'
  | 'isNull'
  | 'isNotNull'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'matches'
  | 'hasProperty'
  | 'hasLength'
  | 'custom'

/**
 * A test assertion definition
 */
export interface TestAssertion {
  id: string
  name: string
  description?: string
  stepId?: string // If null, applies to final output
  path: string // JSONPath or dot notation to the value
  type: AssertionType
  expectedValue?: unknown
  options?: {
    caseSensitive?: boolean
    regex?: string
    customFunction?: string
  }
}

/**
 * Result of evaluating an assertion
 */
export interface AssertionResult {
  assertionId: string
  assertionName: string
  stepId?: string
  passed: boolean
  actualValue?: unknown
  expectedValue?: unknown
  message?: string
  path?: string
}

/**
 * Options for creating a test run
 */
export interface CreateTestRunOptions {
  workflowId: string
  testCaseId?: string
  runType: TestRunType
  targetStepIds?: string[]
  mockTriggerData?: Record<string, unknown>
  mockStepInputs?: Record<string, Record<string, unknown>>
  assertions?: TestAssertion[]
}

/**
 * Options for creating a test case
 */
export interface CreateTestCaseInput {
  workflowId: string
  name: string
  description?: string
  mockTriggerData?: Record<string, unknown>
  mockStepInputs?: Record<string, Record<string, unknown>>
  expectedOutputs?: Record<string, unknown>
  assertions?: Omit<TestAssertion, 'id'>[]
  tags?: string[]
}

/**
 * Options for updating a test case
 */
export interface UpdateTestCaseInput {
  name?: string
  description?: string
  mockTriggerData?: Record<string, unknown>
  mockStepInputs?: Record<string, Record<string, unknown>>
  expectedOutputs?: Record<string, unknown>
  assertions?: Omit<TestAssertion, 'id'>[]
  tags?: string[]
  isActive?: boolean
}

/**
 * Filter options for listing test cases
 */
export interface TestCaseFilters {
  workflowId?: string
  status?: TestRunStatus
  tags?: string[]
  isActive?: boolean
}

/**
 * Filter options for listing test runs
 */
export interface TestRunFilters {
  workflowId?: string
  testCaseId?: string
  status?: TestRunStatus
  runType?: TestRunType
  startDate?: Date
  endDate?: Date
}

/**
 * Summary statistics for test runs
 */
export interface TestRunSummary {
  totalRuns: number
  passedRuns: number
  failedRuns: number
  errorRuns: number
  averageDurationMs: number
  passRate: number
}
