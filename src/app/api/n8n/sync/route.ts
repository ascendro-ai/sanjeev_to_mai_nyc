import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { n8nClient } from '@/lib/n8n/client'

/**
 * Workflow Sync endpoint
 * Syncs workflows between n8n and Supabase
 *
 * GET: Fetch all workflows from n8n
 * POST: Create/update workflow in n8n from platform data
 */

export async function GET() {
  try {
    // Fetch workflows from n8n
    const n8nWorkflows = await n8nClient.getWorkflows()

    // Map n8n workflows to platform format
    const mappedWorkflows = n8nWorkflows.map(workflow => ({
      n8nId: workflow.id,
      name: workflow.name,
      active: workflow.active,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      // Extract nodes to understand workflow structure
      nodes: workflow.nodes?.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
      })) || [],
    }))

    return NextResponse.json({
      workflows: mappedWorkflows,
      count: mappedWorkflows.length,
    })
  } catch (error) {
    console.error('Error fetching n8n workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows from n8n' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { action, workflowId, workflowData } = body

    if (action === 'import') {
      // Import workflow from n8n to platform
      if (!workflowId) {
        return NextResponse.json(
          { error: 'Missing workflowId for import' },
          { status: 400 }
        )
      }

      const n8nWorkflow = await n8nClient.getWorkflow(workflowId)

      // Convert n8n workflow to platform format
      const platformWorkflow = {
        name: n8nWorkflow.name,
        description: `Imported from n8n: ${n8nWorkflow.name}`,
        status: n8nWorkflow.active ? 'active' : 'draft',
        n8n_workflow_id: n8nWorkflow.id,
      }

      // Save to Supabase
      const { data: savedWorkflow, error } = await supabase
        .from('workflows')
        .insert(platformWorkflow)
        .select()
        .single()

      if (error) {
        console.error('Error saving imported workflow:', error)
        return NextResponse.json(
          { error: 'Failed to save workflow' },
          { status: 500 }
        )
      }

      // Also create workflow steps from n8n nodes
      const steps = n8nWorkflow.nodes
        ?.filter(node => !['n8n-nodes-base.start', 'n8n-nodes-base.trigger'].includes(node.type))
        .map((node, index) => ({
          workflow_id: savedWorkflow.id,
          label: node.name,
          type: node.type.includes('humanReview') ? 'review' : 'action',
          order_index: index,
          requirements: {
            n8nNodeId: node.id,
            n8nNodeType: node.type,
          },
        })) || []

      if (steps.length > 0) {
        await supabase.from('workflow_steps').insert(steps)
      }

      return NextResponse.json({
        success: true,
        workflow: savedWorkflow,
        message: 'Workflow imported successfully',
      })
    }

    if (action === 'export') {
      // Export workflow from platform to n8n
      if (!workflowData) {
        return NextResponse.json(
          { error: 'Missing workflowData for export' },
          { status: 400 }
        )
      }

      // Convert platform workflow to n8n format
      const n8nWorkflowData = {
        name: workflowData.name,
        nodes: workflowData.steps?.map((step: { id: string; label: string; type: string }, index: number) => ({
          id: step.id,
          name: step.label,
          type: step.type === 'review'
            ? 'n8n-nodes-platform.humanReview'
            : 'n8n-nodes-platform.aiAction',
          position: [250 + index * 200, 300],
          parameters: {},
        })) || [],
        connections: {},
      }

      const createdWorkflow = await n8nClient.createWorkflow(n8nWorkflowData)

      // Update platform workflow with n8n ID
      await supabase
        .from('workflows')
        .update({ n8n_workflow_id: createdWorkflow.id })
        .eq('id', workflowData.id)

      return NextResponse.json({
        success: true,
        n8nWorkflowId: createdWorkflow.id,
        message: 'Workflow exported to n8n successfully',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "import" or "export"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in sync POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
