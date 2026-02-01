import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { executeWorkflow } from '@/lib/n8n/client'
import { verifyWebhookSignature } from '@/lib/n8n/webhook-auth'

/**
 * POST /api/n8n/webhook/[workflowId]
 *
 * Webhook endpoint for triggering workflows.
 * Supports two authentication methods:
 * 1. Webhook signature (x-webhook-signature header) - for n8n callbacks
 * 2. API key (x-api-key header) - for external services
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params

    // Read body once for verification
    const bodyText = await request.text()

    // Verify authentication (S1 security fix)
    // Check webhook signature first, then fall back to API key
    const signature = request.headers.get('x-webhook-signature')
    const apiKey = request.headers.get('x-api-key')

    if (signature) {
      if (!verifyWebhookSignature(bodyText, signature)) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      }
    } else if (apiKey) {
      // Validate API key against expected value
      const expectedApiKey = process.env.WORKFLOW_TRIGGER_API_KEY
      if (!expectedApiKey || apiKey !== expectedApiKey) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        )
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, require authentication
      return NextResponse.json(
        { error: 'Authentication required: provide x-webhook-signature or x-api-key header' },
        { status: 401 }
      )
    }

    const body = bodyText ? JSON.parse(bodyText) : {}

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
      logger.error('Error creating execution:', execError)
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
        logger.error('Error triggering n8n workflow:', n8nError)

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
    logger.error('Error in webhook handler:', error)
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
