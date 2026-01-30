import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TestCase, CreateTestCaseInput } from '@/types/testing'

/**
 * GET /api/testing/test-cases
 * List test cases with optional filters
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
    const status = searchParams.get('status')
    const isActive = searchParams.get('isActive')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('test_cases')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }

    if (status) {
      query = query.eq('last_run_status', status)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Failed to fetch test cases:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const testCases: TestCase[] = (data || []).map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      workflowId: row.workflow_id,
      name: row.name,
      description: row.description,
      mockTriggerData: row.mock_trigger_data || {},
      mockStepInputs: row.mock_step_inputs || {},
      expectedOutputs: row.expected_outputs || {},
      assertions: row.assertions || [],
      tags: row.tags || [],
      isActive: row.is_active,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      lastRunStatus: row.last_run_status,
      createdBy: row.created_by,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    }))

    return NextResponse.json({
      data: testCases,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Test cases list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/testing/test-cases
 * Create a new test case
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

    const body: CreateTestCaseInput = await request.json()

    // Validate required fields
    if (!body.workflowId || !body.name) {
      return NextResponse.json(
        { error: 'workflowId and name are required' },
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

    // Generate IDs for assertions
    const assertionsWithIds = (body.assertions || []).map((assertion, index) => ({
      ...assertion,
      id: `assertion_${Date.now()}_${index}`,
    }))

    // Create the test case
    const { data, error } = await supabase
      .from('test_cases')
      .insert({
        organization_id: organizationId,
        workflow_id: body.workflowId,
        name: body.name,
        description: body.description,
        mock_trigger_data: body.mockTriggerData || {},
        mock_step_inputs: body.mockStepInputs || {},
        expected_outputs: body.expectedOutputs || {},
        assertions: assertionsWithIds,
        tags: body.tags || [],
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create test case:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const testCase: TestCase = {
      id: data.id,
      organizationId: data.organization_id,
      workflowId: data.workflow_id,
      name: data.name,
      description: data.description,
      mockTriggerData: data.mock_trigger_data || {},
      mockStepInputs: data.mock_step_inputs || {},
      expectedOutputs: data.expected_outputs || {},
      assertions: data.assertions || [],
      tags: data.tags || [],
      isActive: data.is_active,
      lastRunAt: data.last_run_at ? new Date(data.last_run_at) : undefined,
      lastRunStatus: data.last_run_status,
      createdBy: data.created_by,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    }

    return NextResponse.json({ data: testCase }, { status: 201 })
  } catch (error) {
    console.error('Test case creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
