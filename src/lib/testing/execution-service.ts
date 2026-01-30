import { createClient } from '@/lib/supabase/client'
import { n8nClient } from '@/lib/n8n/client'
import { evaluateAllAssertions } from './assertion-engine'
import type {
  TestRun,
  TestStepResult,
  CreateTestRunOptions,
  TestAssertion,
  TestRunStatus,
} from '@/types/testing'

/**
 * Service for executing and managing test runs
 */
export class TestExecutionService {
  private supabase = createClient()

  /**
   * Create and start a new test run
   */
  async createTestRun(
    organizationId: string,
    options: CreateTestRunOptions,
    userId?: string
  ): Promise<TestRun> {
    // Get the workflow to validate
    const { data: workflow, error: workflowError } = await this.supabase
      .from('workflows')
      .select('*, workflow_steps(*)')
      .eq('id', options.workflowId)
      .single()

    if (workflowError || !workflow) {
      throw new Error(`Workflow not found: ${options.workflowId}`)
    }

    // Get test case if provided
    let testCase = null
    if (options.testCaseId) {
      const { data, error } = await this.supabase
        .from('test_cases')
        .select('*')
        .eq('id', options.testCaseId)
        .single()

      if (error || !data) {
        throw new Error(`Test case not found: ${options.testCaseId}`)
      }
      testCase = data
    }

    // Merge mock data from test case and options
    const mockData = {
      triggerData: options.mockTriggerData || testCase?.mock_trigger_data || {},
      stepInputs: options.mockStepInputs || testCase?.mock_step_inputs || {},
    }

    // Get assertions from test case or options
    const assertions: TestAssertion[] = options.assertions ||
      (testCase?.assertions as TestAssertion[]) || []

    // Create the test run record
    const { data: testRun, error: createError } = await this.supabase
      .from('test_runs')
      .insert({
        organization_id: organizationId,
        test_case_id: options.testCaseId,
        workflow_id: options.workflowId,
        run_type: options.runType,
        target_step_ids: options.targetStepIds,
        mock_data: mockData,
        status: 'pending',
        total_assertions: assertions.length,
        created_by: userId,
      })
      .select()
      .single()

    if (createError || !testRun) {
      throw new Error(`Failed to create test run: ${createError?.message}`)
    }

    // Start execution asynchronously
    this.executeTestRun(testRun.id, workflow, mockData, assertions).catch(error => {
      console.error('Test execution error:', error)
      this.updateTestRunStatus(testRun.id, 'error', error.message)
    })

    return this.mapTestRun(testRun)
  }

  /**
   * Execute a test run
   */
  private async executeTestRun(
    testRunId: string,
    workflow: Record<string, unknown>,
    mockData: { triggerData: Record<string, unknown>; stepInputs: Record<string, Record<string, unknown>> },
    assertions: TestAssertion[]
  ): Promise<void> {
    const startTime = Date.now()

    // Update status to running
    await this.updateTestRunStatus(testRunId, 'running')
    await this.supabase
      .from('test_runs')
      .update({ started_at: new Date().toISOString() })
      .eq('id', testRunId)

    try {
      // Create an execution record marked as test
      const { data: execution, error: execError } = await this.supabase
        .from('executions')
        .insert({
          workflow_id: workflow.id,
          status: 'pending',
          trigger_type: 'test',
          trigger_data: mockData.triggerData,
          input_data: mockData.triggerData,
          is_test_run: true,
          test_run_id: testRunId,
        })
        .select()
        .single()

      if (execError || !execution) {
        throw new Error(`Failed to create execution: ${execError?.message}`)
      }

      // Update test run with execution ID
      await this.supabase
        .from('test_runs')
        .update({ execution_id: execution.id })
        .eq('id', testRunId)

      // Get workflow steps
      const steps = Array.isArray(workflow.steps)
        ? workflow.steps as Array<{ id: string; label: string; type: string }>
        : []

      // Create step result records
      const stepResults: Record<string, unknown> = {}

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]

        // Create step result record
        const { data: stepResult, error: stepError } = await this.supabase
          .from('test_step_results')
          .insert({
            test_run_id: testRunId,
            step_id: step.id,
            step_index: i,
            step_name: step.label,
            step_type: step.type,
            status: 'pending',
            input_data: mockData.stepInputs[step.id] || {},
          })
          .select()
          .single()

        if (stepError) {
          console.error(`Failed to create step result: ${stepError.message}`)
          continue
        }

        // Update step to running
        const stepStartTime = Date.now()
        await this.supabase
          .from('test_step_results')
          .update({ status: 'running', started_at: new Date().toISOString() })
          .eq('id', stepResult.id)

        try {
          // Simulate step execution with mock data
          // In production, this would call n8n to execute the step
          const stepOutput = await this.simulateStepExecution(
            step,
            mockData.stepInputs[step.id] || {},
            stepResults
          )

          stepResults[step.id] = stepOutput

          // Update step result with output
          const stepDuration = Date.now() - stepStartTime
          await this.supabase
            .from('test_step_results')
            .update({
              status: 'completed',
              output_data: stepOutput,
              completed_at: new Date().toISOString(),
              duration_ms: stepDuration,
            })
            .eq('id', stepResult.id)

        } catch (stepExecError) {
          const stepDuration = Date.now() - stepStartTime
          await this.supabase
            .from('test_step_results')
            .update({
              status: 'failed',
              error: stepExecError instanceof Error ? stepExecError.message : 'Unknown error',
              completed_at: new Date().toISOString(),
              duration_ms: stepDuration,
            })
            .eq('id', stepResult.id)

          throw stepExecError
        }
      }

      // Evaluate assertions
      const assertionResults = evaluateAllAssertions(
        assertions,
        stepResults,
        stepResults
      )

      // Determine final status
      const finalStatus: TestRunStatus = assertionResults.failed > 0 ? 'failed' : 'passed'
      const durationMs = Date.now() - startTime

      // Update test run with results
      await this.supabase
        .from('test_runs')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          passed_assertions: assertionResults.passed,
          failed_assertions: assertionResults.failed,
          assertion_results: assertionResults.results,
        })
        .eq('id', testRunId)

      // Update execution status
      await this.supabase
        .from('executions')
        .update({
          status: 'completed',
          output_data: stepResults,
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', execution.id)

      // Update test case last run status if applicable
      const { data: testRun } = await this.supabase
        .from('test_runs')
        .select('test_case_id')
        .eq('id', testRunId)
        .single()

      if (testRun?.test_case_id) {
        await this.supabase
          .from('test_cases')
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: finalStatus,
          })
          .eq('id', testRun.test_case_id)
      }

    } catch (error) {
      const durationMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.supabase
        .from('test_runs')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_message: errorMessage,
        })
        .eq('id', testRunId)

      throw error
    }
  }

  /**
   * Simulate step execution (placeholder for n8n integration)
   */
  private async simulateStepExecution(
    step: { id: string; label: string; type: string },
    inputData: Record<string, unknown>,
    previousOutputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // In a real implementation, this would:
    // 1. Convert the step to n8n node format
    // 2. Execute through n8n with mock data
    // 3. Capture and return the output

    // For now, return mock output based on step type
    await new Promise(resolve => setTimeout(resolve, 100)) // Simulate execution time

    return {
      success: true,
      stepId: step.id,
      stepType: step.type,
      input: inputData,
      output: {
        message: `Step "${step.label}" executed successfully`,
        timestamp: new Date().toISOString(),
        ...inputData,
      },
    }
  }

  /**
   * Update test run status
   */
  private async updateTestRunStatus(
    testRunId: string,
    status: TestRunStatus,
    errorMessage?: string
  ): Promise<void> {
    const update: Record<string, unknown> = { status }
    if (errorMessage) {
      update.error_message = errorMessage
    }

    await this.supabase
      .from('test_runs')
      .update(update)
      .eq('id', testRunId)
  }

  /**
   * Get a test run by ID
   */
  async getTestRun(testRunId: string): Promise<TestRun | null> {
    const { data, error } = await this.supabase
      .from('test_runs')
      .select('*')
      .eq('id', testRunId)
      .single()

    if (error || !data) return null
    return this.mapTestRun(data)
  }

  /**
   * Get test runs for a workflow
   */
  async getTestRuns(
    workflowId: string,
    options?: { limit?: number; offset?: number; status?: TestRunStatus }
  ): Promise<{ data: TestRun[]; total: number }> {
    let query = this.supabase
      .from('test_runs')
      .select('*', { count: 'exact' })
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: (data || []).map(this.mapTestRun),
      total: count || 0,
    }
  }

  /**
   * Get step results for a test run
   */
  async getTestStepResults(testRunId: string): Promise<TestStepResult[]> {
    const { data, error } = await this.supabase
      .from('test_step_results')
      .select('*')
      .eq('test_run_id', testRunId)
      .order('step_index', { ascending: true })

    if (error) throw error

    return (data || []).map(this.mapTestStepResult)
  }

  /**
   * Cancel a running test
   */
  async cancelTestRun(testRunId: string): Promise<void> {
    const { data: testRun } = await this.supabase
      .from('test_runs')
      .select('status, execution_id')
      .eq('id', testRunId)
      .single()

    if (!testRun || testRun.status !== 'running') {
      throw new Error('Test run is not running')
    }

    // Update status to cancelled
    await this.supabase
      .from('test_runs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', testRunId)

    // Cancel the execution if exists
    if (testRun.execution_id) {
      await this.supabase
        .from('executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', testRun.execution_id)
    }
  }

  /**
   * Map database row to TestRun type
   */
  private mapTestRun(row: Record<string, unknown>): TestRun {
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      testCaseId: row.test_case_id as string | undefined,
      workflowId: row.workflow_id as string,
      executionId: row.execution_id as string | undefined,
      runType: row.run_type as TestRun['runType'],
      targetStepIds: row.target_step_ids as string[] | undefined,
      mockData: row.mock_data as Record<string, unknown>,
      status: row.status as TestRun['status'],
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      durationMs: row.duration_ms as number | undefined,
      totalAssertions: row.total_assertions as number,
      passedAssertions: row.passed_assertions as number,
      failedAssertions: row.failed_assertions as number,
      assertionResults: row.assertion_results as TestRun['assertionResults'],
      errorMessage: row.error_message as string | undefined,
      errorStepId: row.error_step_id as string | undefined,
      createdBy: row.created_by as string | undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    }
  }

  /**
   * Map database row to TestStepResult type
   */
  private mapTestStepResult(row: Record<string, unknown>): TestStepResult {
    return {
      id: row.id as string,
      testRunId: row.test_run_id as string,
      stepId: row.step_id as string,
      stepIndex: row.step_index as number,
      stepName: row.step_name as string,
      stepType: row.step_type as string,
      status: row.status as TestStepResult['status'],
      inputData: row.input_data as Record<string, unknown> | undefined,
      outputData: row.output_data as Record<string, unknown> | undefined,
      expectedOutput: row.expected_output as Record<string, unknown> | undefined,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      durationMs: row.duration_ms as number | undefined,
      assertionsPassed: row.assertions_passed as number,
      assertionsFailed: row.assertions_failed as number,
      assertionDetails: row.assertion_details as TestStepResult['assertionDetails'],
      error: row.error as string | undefined,
      errorStack: row.error_stack as string | undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    }
  }
}

// Export singleton instance
export const testExecutionService = new TestExecutionService()
