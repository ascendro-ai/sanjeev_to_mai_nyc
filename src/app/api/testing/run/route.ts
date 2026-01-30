import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testExecutionService } from '@/lib/testing/execution-service'
import type { CreateTestRunOptions } from '@/types/testing'

/**
 * POST /api/testing/run
 * Start a new test run
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id:organization_members(organization_id)')
      .eq('id', user.id)
      .single()

    const organizationId = (userData?.organization_id as { organization_id: string }[])?.[0]?.organization_id

    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body: CreateTestRunOptions = await request.json()

    // Validate required fields
    if (!body.workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      )
    }

    if (!body.runType) {
      return NextResponse.json(
        { error: 'runType is required' },
        { status: 400 }
      )
    }

    // Verify workflow exists and belongs to the organization
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('id')
      .eq('id', body.workflowId)
      .eq('organization_id', organizationId)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // If test case ID provided, verify it exists
    if (body.testCaseId) {
      const { data: testCase, error: testCaseError } = await supabase
        .from('test_cases')
        .select('id')
        .eq('id', body.testCaseId)
        .single()

      if (testCaseError || !testCase) {
        return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
      }
    }

    // Create and start the test run
    const testRun = await testExecutionService.createTestRun(
      organizationId,
      body,
      user.id
    )

    return NextResponse.json({ data: testRun }, { status: 201 })
  } catch (error) {
    console.error('Test run creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/testing/run
 * List test runs (alias for /api/testing/runs)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams
    const workflowId = searchParams.get('workflowId')
    const testCaseId = searchParams.get('testCaseId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('test_runs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }

    if (testCaseId) {
      query = query.eq('test_case_id', testCaseId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Failed to fetch test runs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const testRuns = (data || []).map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      testCaseId: row.test_case_id,
      workflowId: row.workflow_id,
      executionId: row.execution_id,
      runType: row.run_type,
      targetStepIds: row.target_step_ids,
      mockData: row.mock_data || {},
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      durationMs: row.duration_ms,
      totalAssertions: row.total_assertions || 0,
      passedAssertions: row.passed_assertions || 0,
      failedAssertions: row.failed_assertions || 0,
      assertionResults: row.assertion_results || [],
      errorMessage: row.error_message,
      errorStepId: row.error_step_id,
      createdBy: row.created_by,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
    }))

    return NextResponse.json({
      data: testRuns,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Test runs list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
