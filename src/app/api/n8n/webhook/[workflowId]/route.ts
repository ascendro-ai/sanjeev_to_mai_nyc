import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { executeWorkflow } from '@/lib/n8n/client'

/**
 * POST /api/n8n/webhook/[workflowId]
 *
 * Webhook endpoint for triggering workflows.
 * Can be called by external services or scheduled triggers.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params
    const body = await request.json().catch(() => ({}))

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Missing workflow ID' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify workflow exists and is active
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*, digital_workers(*)')
      .eq('id', workflowId)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    if (workflow.status !== 'active') {
      return NextResponse.json(
        { error: 'Workflow is not active' },
        { status: 400 }
      )
    }

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('executions')
      .insert({
        workflow_id: workflowId,
        worker_id: workflow.assigned_worker_id,
        status: 'running',
        trigger_type: 'webhook',
        trigger_data: body,
        input_data: body,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (execError) {
      console.error('Error creating execution:', execError)
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 }
      )
    }

    // Log the trigger
    await supabase.from('activity_logs').insert({
      type: 'workflow_execution_start',
      workflow_id: workflowId,
      data: {
        executionId: execution.id,
        triggerType: 'webhook',
        message: `Workflow triggered via webhook: ${workflow.name}`,
      },
    })

    // If workflow has an n8n workflow ID, trigger it in n8n
    if (workflow.n8n_workflow_id) {
      try {
        const n8nExecution = await executeWorkflow(workflow.n8n_workflow_id, {
          executionId: execution.id,
          workflowId,
          ...body,
        })

        // Update execution with n8n execution ID
        await supabase
          .from('executions')
          .update({ n8n_execution_id: n8nExecution.id })
          .eq('id', execution.id)

        return NextResponse.json({
          success: true,
          executionId: execution.id,
          n8nExecutionId: n8nExecution.id,
          message: 'Workflow triggered successfully',
        })
      } catch (n8nError) {
        console.error('Error triggering n8n workflow:', n8nError)

        // Update execution status to failed
        await supabase
          .from('executions')
          .update({
            status: 'failed',
            error: String(n8nError),
            completed_at: new Date().toISOString(),
          })
          .eq('id', execution.id)

        return NextResponse.json(
          { error: 'Failed to trigger n8n workflow', details: String(n8nError) },
          { status: 500 }
        )
      }
    }

    // No n8n workflow - just return the execution record
    return NextResponse.json({
      success: true,
      executionId: execution.id,
      message: 'Execution record created (no n8n workflow configured)',
    })
  } catch (error) {
    console.error('Error in webhook handler:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/n8n/webhook/[workflowId]
 *
 * Health check / info endpoint for webhooks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params

  const supabase = await createClient()

  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('id, name, status')
    .eq('id', workflowId)
    .single()

  if (error || !workflow) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    workflowId: workflow.id,
    name: workflow.name,
    status: workflow.status,
    webhookActive: workflow.status === 'active',
  })
}
