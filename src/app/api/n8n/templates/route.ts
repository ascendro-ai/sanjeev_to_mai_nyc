import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/n8n/templates
 *
 * List workflow templates. Includes public templates and organization-specific templates.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')
    const search = searchParams.get('search')
    const templateId = searchParams.get('id')

    // Get single template by ID
    if (templateId) {
      const { data: template, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (error) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      return NextResponse.json({ template })
    }

    // Build query
    let query = supabase
      .from('workflow_templates')
      .select('id, name, description, category, tags, is_public, is_featured, use_count, created_at')
      .order('use_count', { ascending: false })

    // Filter by category
    if (category) {
      query = query.eq('category', category)
    }

    // Filter featured
    if (featured === 'true') {
      query = query.eq('is_featured', true)
    }

    // Search by name/description
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // If user is authenticated, include their org's private templates
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (userData?.organization_id) {
        query = query.or(`is_public.eq.true,organization_id.eq.${userData.organization_id}`)
      } else {
        query = query.eq('is_public', true)
      }
    } else {
      query = query.eq('is_public', true)
    }

    const { data: templates, error } = await query.limit(50)

    if (error) throw error

    // Get unique categories for filtering
    const { data: categories } = await supabase
      .from('workflow_templates')
      .select('category')
      .eq('is_public', true)

    const uniqueCategories = [...new Set(categories?.map((c) => c.category) || [])]

    return NextResponse.json({
      templates,
      categories: uniqueCategories,
    })
  } catch (error) {
    logger.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/n8n/templates
 *
 * Create a new template or use an existing template to create a workflow.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    // Action: Use a template to create a new workflow
    if (action === 'useTemplate') {
      const { templateId, workflowName } = body

      if (!templateId) {
        return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
      }

      // Get the template
      const { data: template, error: templateError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (templateError || !template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      // Create a new workflow from the template
      const workflowDefinition = template.workflow_definition as {
        name: string
        steps: unknown[]
      }

      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          organization_id: userData.organization_id,
          name: workflowName || workflowDefinition.name,
          description: template.description,
          steps: workflowDefinition.steps,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single()

      if (workflowError) throw workflowError

      // Increment template use count
      const { error: rpcError } = await supabase.rpc('increment_template_use_count', { template_id: templateId })
      if (rpcError) {
        // Fallback if RPC doesn't exist
        await supabase
          .from('workflow_templates')
          .update({ use_count: template.use_count + 1 })
          .eq('id', templateId)
      }

      return NextResponse.json({
        success: true,
        workflow,
        message: 'Workflow created from template',
      })
    }

    // Action: Create a new template from a workflow
    if (action === 'createTemplate') {
      const { workflowId, name, description, category, tags, isPublic } = body

      if (!workflowId || !name || !category) {
        return NextResponse.json(
          { error: 'workflowId, name, and category are required' },
          { status: 400 }
        )
      }

      // Get the workflow
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('organization_id', userData.organization_id)
        .single()

      if (workflowError || !workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      // Create the template
      const { data: template, error: templateError } = await supabase
        .from('workflow_templates')
        .insert({
          organization_id: userData.organization_id,
          name,
          description: description || workflow.description,
          category,
          tags: tags || [],
          workflow_definition: {
            name: workflow.name,
            steps: workflow.steps,
          },
          is_public: isPublic || false,
          created_by: user.id,
        })
        .select()
        .single()

      if (templateError) throw templateError

      return NextResponse.json({
        success: true,
        template,
        message: 'Template created successfully',
      })
    }

    // Default: Create a template directly
    const { name, description, category, tags, workflowDefinition, isPublic } = body

    if (!name || !category || !workflowDefinition) {
      return NextResponse.json(
        { error: 'name, category, and workflowDefinition are required' },
        { status: 400 }
      )
    }

    const { data: template, error } = await supabase
      .from('workflow_templates')
      .insert({
        organization_id: userData.organization_id,
        name,
        description,
        category,
        tags: tags || [],
        workflow_definition: workflowDefinition,
        is_public: isPublic || false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      template,
    })
  } catch (error) {
    logger.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/n8n/templates
 *
 * Delete a template.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('id')

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('workflow_templates')
      .delete()
      .eq('id', templateId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
