/**
 * n8n Workflow Activation API
 *
 * Handles the full workflow activation flow:
 * 1. Fetch workflow from Supabase
 * 2. Convert to n8n format
 * 3. Create or update in n8n
 * 4. Activate/deactivate in n8n
 * 5. Update Supabase with n8n workflow ID and status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  n8nClient,
  convertToN8NWorkflow,
  type N8NWorkflow,
} from '@/lib/n8n/client'
import type { Workflow, WorkflowStep } from '@/types'

// Platform webhook URL for n8n to call back
const PLATFORM_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface ActivateRequest {
  workflowId: string
  action: 'activate' | 'deactivate'
}

interface DbWorkflow {
  id: string
  organization_id: string
  name: string
  description: string | null
  steps: Array<{
    id: string
    label: string
    type: string
    order_index: number
    assigned_to_type: string | null
    assigned_to_name: string | null
    requirements: Record<string, unknown> | null
  }> | null
  n8n_workflow_id: string | null
  status: string | null
}

function toWorkflow(db: DbWorkflow): Workflow {
  return {
    id: db.id,
    name: db.name,
    description: db.description || undefined,
    steps: (db.steps || []).map((step, index) => ({
      id: step.id,
      label: step.label,
      type: step.type as WorkflowStep['type'],
      order: step.order_index ?? index,
      assignedTo: step.assigned_to_type ? {
        type: step.assigned_to_type as 'ai' | 'human',
        agentName: step.assigned_to_name || undefined,
      } : undefined,
      requirements: step.requirements as unknown as WorkflowStep['requirements'],
    })),
    status: (db.status || 'draft') as Workflow['status'],
    n8nWorkflowId: db.n8n_workflow_id || undefined,
    organizationId: db.organization_id,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ActivateRequest = await request.json()
    const { workflowId, action } = body

    if (!workflowId || !action) {
      return NextResponse.json(
        { error: 'Missing workflowId or action' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Fetch workflow from Supabase
    const { data: dbWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single()

    if (fetchError || !dbWorkflow) {
      return NextResponse.json(
        { error: 'Workflow not found', details: fetchError?.message },
        { status: 404 }
      )
    }

    const workflow = toWorkflow(dbWorkflow as DbWorkflow)

    // Validate workflow has steps
    if (!workflow.steps || workflow.steps.length === 0) {
      return NextResponse.json(
        { error: 'Workflow has no steps to activate' },
        { status: 400 }
      )
    }

    let n8nWorkflowId = workflow.n8nWorkflowId
    let n8nWorkflow: N8NWorkflow | null = null

    if (action === 'activate') {
      // Convert workflow to n8n format
      const n8nWorkflowData = convertToN8NWorkflow(workflow, PLATFORM_URL)

      if (n8nWorkflowId) {
        // Update existing n8n workflow
        try {
          n8nWorkflow = await n8nClient.updateWorkflow(n8nWorkflowId, n8nWorkflowData)
          console.log(`Updated n8n workflow: ${n8nWorkflowId}`)
        } catch (updateError) {
          // If update fails (workflow might have been deleted), create new one
          console.warn(`Failed to update n8n workflow ${n8nWorkflowId}, creating new one`)
          n8nWorkflow = await n8nClient.createWorkflow(n8nWorkflowData)
          n8nWorkflowId = n8nWorkflow.id
        }
      } else {
        // Create new n8n workflow
        n8nWorkflow = await n8nClient.createWorkflow(n8nWorkflowData)
        n8nWorkflowId = n8nWorkflow.id
        console.log(`Created n8n workflow: ${n8nWorkflowId}`)
      }

      // Activate the workflow in n8n
      if (n8nWorkflowId) {
        await n8nClient.activateWorkflow(n8nWorkflowId)
        console.log(`Activated n8n workflow: ${n8nWorkflowId}`)
      }

      // Update Supabase with n8n workflow ID and active status
      const { data: updatedWorkflow, error: updateError } = await supabase
        .from('workflows')
        .update({
          n8n_workflow_id: n8nWorkflowId,
          status: 'active',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .select()
        .single()

      if (updateError) {
        // Try to rollback n8n activation
        if (n8nWorkflowId) {
          try {
            await n8nClient.deactivateWorkflow(n8nWorkflowId)
          } catch (e) {
            console.error('Failed to rollback n8n activation:', e)
          }
        }
        return NextResponse.json(
          { error: 'Failed to update workflow status', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        workflow: toWorkflow(updatedWorkflow as DbWorkflow),
        n8nWorkflowId,
        message: 'Workflow activated successfully',
      })

    } else if (action === 'deactivate') {
      // Deactivate in n8n if we have an n8n workflow ID
      if (n8nWorkflowId) {
        try {
          await n8nClient.deactivateWorkflow(n8nWorkflowId)
          console.log(`Deactivated n8n workflow: ${n8nWorkflowId}`)
        } catch (deactivateError) {
          console.warn(`Failed to deactivate n8n workflow ${n8nWorkflowId}:`, deactivateError)
          // Continue anyway - the workflow might already be deactivated or deleted
        }
      }

      // Update Supabase status to paused
      const { data: updatedWorkflow, error: updateError } = await supabase
        .from('workflows')
        .update({
          status: 'paused',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update workflow status', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        workflow: toWorkflow(updatedWorkflow as DbWorkflow),
        n8nWorkflowId,
        message: 'Workflow deactivated successfully',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in workflow activation:', error)

    // Check if it's an n8n connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isN8nError = errorMessage.includes('n8n') || errorMessage.includes('fetch')

    return NextResponse.json(
      {
        error: isN8nError
          ? 'Failed to connect to n8n. Please check that n8n is running and configured correctly.'
          : 'Failed to activate workflow',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
