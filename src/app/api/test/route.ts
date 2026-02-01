/**
 * Test API Routes for E2E Testing
 *
 * IMPORTANT: These endpoints should only be available in test/development environments.
 * They provide seeding and cleanup utilities for E2E tests.
 *
 * In production, returns 404 to hide the endpoint's existence (S6 security fix).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Check if we're in a non-production environment.
 * Returns 404 in production to hide the endpoint (security through obscurity + actual protection).
 */
function checkTestEnvironment(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    // Return 404 instead of 403 to hide endpoint existence
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}

/**
 * POST /api/test/seed-workflow
 * Seed a test workflow
 */
export async function POST(request: NextRequest) {
  const envCheck = checkTestEnvironment()
  if (envCheck) return envCheck

  try {
    const supabase = await createClient()
    const body = await request.json()
    const { pathname } = new URL(request.url)

    // Handle different seed operations based on the request
    if (pathname.includes('seed-workflow')) {
      const { data: workflow, error } = await supabase
        .from('workflows')
        .insert({
          name: body.name || 'Test Workflow',
          description: body.description || 'Test workflow for E2E',
          status: body.status || 'draft',
          steps: body.steps || [],
          organization_id: body.organizationId || '00000000-0000-0000-0000-000000000001',
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(workflow)
    }

    if (pathname.includes('seed-review')) {
      const { data: review, error } = await supabase
        .from('review_requests')
        .insert({
          status: body.status || 'pending',
          review_type: body.reviewType || 'approval',
          worker_name: body.workerName || 'Test Agent',
          review_data: body.reviewData || { action: 'test_action' },
          execution_id: body.executionId || '00000000-0000-0000-0000-000000000001',
          step_id: body.stepId || 'step-1',
          step_index: body.stepIndex || 0,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(review)
    }

    if (pathname.includes('seed-execution')) {
      const { data: execution, error } = await supabase
        .from('executions')
        .insert({
          workflow_id: body.workflowId || '00000000-0000-0000-0000-000000000001',
          status: body.status || 'running',
          current_step_index: body.currentStepIndex || 0,
          trigger_type: body.triggerType || 'manual',
          error: body.error,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(execution)
    }

    if (pathname.includes('seed-template')) {
      const { data: template, error } = await supabase
        .from('workflow_templates')
        .insert({
          name: body.name || 'Test Template',
          description: body.description || 'Test template for E2E',
          category: body.category || 'general',
          is_public: body.isPublic ?? true,
          workflow_definition: body.workflowDefinition || { name: 'Test', steps: [] },
          organization_id: body.organizationId || '00000000-0000-0000-0000-000000000001',
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(template)
    }

    if (pathname.includes('trigger-activity')) {
      const { error } = await supabase.from('activity_logs').insert({
        type: body.type || 'workflow_step_execution',
        worker_name: body.workerName || 'Test Agent',
        data: body.data || {},
        organization_id: body.organizationId || '00000000-0000-0000-0000-000000000001',
      })

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (pathname.includes('trigger-execution-update')) {
      const { error } = await supabase
        .from('executions')
        .update({
          status: body.status || 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', body.executionId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 })
  } catch (error) {
    console.error('Test seed error:', error)
    return NextResponse.json({ error: 'Seed operation failed' }, { status: 500 })
  }
}

/**
 * DELETE /api/test/clear-*
 * Clear test data
 */
export async function DELETE(request: NextRequest) {
  const envCheck = checkTestEnvironment()
  if (envCheck) return envCheck

  try {
    const supabase = await createClient()
    const { pathname } = new URL(request.url)

    // Use a test organization ID to avoid deleting real data
    const testOrgId = '00000000-0000-0000-0000-000000000001'

    if (pathname.includes('clear-workflows')) {
      await supabase.from('workflows').delete().eq('organization_id', testOrgId)
    }

    if (pathname.includes('clear-reviews')) {
      await supabase.from('review_requests').delete().eq('status', 'pending')
    }

    if (pathname.includes('clear-executions')) {
      await supabase.from('executions').delete().eq('status', 'running')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Test cleanup error:', error)
    return NextResponse.json({ error: 'Cleanup operation failed' }, { status: 500 })
  }
}
