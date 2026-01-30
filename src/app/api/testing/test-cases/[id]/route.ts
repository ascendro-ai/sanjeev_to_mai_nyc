import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TestCase, UpdateTestCaseInput } from '@/types/testing'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/testing/test-cases/[id]
 * Get a single test case
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('test_cases')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
      }
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

    return NextResponse.json({ data: testCase })
  } catch (error) {
    console.error('Test case fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/testing/test-cases/[id]
 * Update a test case
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdateTestCaseInput = await request.json()

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.mockTriggerData !== undefined) updates.mock_trigger_data = body.mockTriggerData
    if (body.mockStepInputs !== undefined) updates.mock_step_inputs = body.mockStepInputs
    if (body.expectedOutputs !== undefined) updates.expected_outputs = body.expectedOutputs
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.isActive !== undefined) updates.is_active = body.isActive

    // Handle assertions - generate IDs for new ones
    if (body.assertions !== undefined) {
      updates.assertions = body.assertions.map((assertion, index) => ({
        ...assertion,
        id: (assertion as Record<string, unknown>).id || `assertion_${Date.now()}_${index}`,
      }))
    }

    const { data, error } = await supabase
      .from('test_cases')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
      }
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

    return NextResponse.json({ data: testCase })
  } catch (error) {
    console.error('Test case update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/testing/test-cases/[id]
 * Delete a test case
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('test_cases')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Test case deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
