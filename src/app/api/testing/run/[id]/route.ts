import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testExecutionService } from '@/lib/testing/execution-service'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/testing/run/[id]
 * Get a test run with its step results
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

    // Get the test run
    const testRun = await testExecutionService.getTestRun(id)

    if (!testRun) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
    }

    // Get step results
    const stepResults = await testExecutionService.getTestStepResults(id)

    // Get test case info if applicable
    let testCase = null
    if (testRun.testCaseId) {
      const { data } = await supabase
        .from('test_cases')
        .select('id, name, description')
        .eq('id', testRun.testCaseId)
        .single()
      testCase = data
    }

    // Get workflow info
    const { data: workflow } = await supabase
      .from('workflows')
      .select('id, name, description')
      .eq('id', testRun.workflowId)
      .single()

    return NextResponse.json({
      data: {
        ...testRun,
        testCase,
        workflow,
        stepResults,
      },
    })
  } catch (error) {
    console.error('Test run fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/testing/run/[id]
 * Cancel a running test or delete a completed test run
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

    // Get the test run
    const { data: testRun, error: fetchError } = await supabase
      .from('test_runs')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError || !testRun) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
    }

    // If running, cancel it
    if (testRun.status === 'running' || testRun.status === 'pending') {
      await testExecutionService.cancelTestRun(id)
      return NextResponse.json({ success: true, message: 'Test run cancelled' })
    }

    // Otherwise, delete the record
    const { error: deleteError } = await supabase
      .from('test_runs')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Test run deleted' })
  } catch (error) {
    console.error('Test run deletion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
