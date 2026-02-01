import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type EventType =
  | 'execution_start'
  | 'node_start'
  | 'node_complete'
  | 'node_error'
  | 'review_request'
  | 'review_response'
  | 'execution_complete'
  | 'execution_failed'

interface AuditLogEntry {
  eventType: EventType
  workflowId?: string
  executionId?: string
  nodeName?: string
  nodeType?: string
  nodeIndex?: number
  inputData?: unknown
  outputSummary?: string
  errorMessage?: string
  errorStack?: string
  durationMs?: number
  actorType?: 'ai' | 'human' | 'system'
  actorId?: string
  actorName?: string
  metadata?: Record<string, unknown>
  retentionDays?: number
}

/**
 * POST /api/n8n/audit
 *
 * Record an audit log entry
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Allow both authenticated users and system calls (with API key)
    const apiKey = request.headers.get('x-api-key')
    const isSystemCall = apiKey === process.env.INTERNAL_API_KEY

    if (!user && !isSystemCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AuditLogEntry = await request.json()
    const {
      eventType,
      workflowId,
      executionId,
      nodeName,
      nodeType,
      nodeIndex,
      inputData,
      outputSummary,
      errorMessage,
      errorStack,
      durationMs,
      actorType,
      actorId,
      actorName,
      metadata,
      retentionDays = 90,
    } = body

    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
    }

    // Get organization ID
    let organizationId: string | null = null

    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      organizationId = userData?.organization_id || null
    } else if (workflowId) {
      // Try to get org from workflow
      const { data: workflow } = await supabase
        .from('workflows')
        .select('organization_id')
        .eq('id', workflowId)
        .single()
      organizationId = workflow?.organization_id || null
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Could not determine organization' }, { status: 400 })
    }

    // Hash sensitive input data if present
    let inputDataHash: string | null = null
    if (inputData) {
      const { data: hashResult } = await supabase.rpc('hash_sensitive_data', {
        data: JSON.stringify(inputData),
      })
      inputDataHash = hashResult
    }

    // Calculate retention date
    const retentionUntil = new Date()
    retentionUntil.setDate(retentionUntil.getDate() + retentionDays)

    // Insert audit log
    const { data: auditLog, error } = await supabase
      .from('execution_audit_logs')
      .insert({
        organization_id: organizationId,
        workflow_id: workflowId,
        execution_id: executionId,
        event_type: eventType,
        node_name: nodeName,
        node_type: nodeType,
        node_index: nodeIndex,
        input_data_hash: inputDataHash,
        output_summary: outputSummary,
        error_message: errorMessage,
        error_stack: errorStack,
        duration_ms: durationMs,
        actor_type: actorType,
        actor_id: actorId,
        actor_name: actorName,
        metadata,
        retention_until: retentionUntil.toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      auditLogId: auditLog.id,
    })
  } catch (error) {
    logger.error('Error recording audit log:', error)
    return NextResponse.json(
      { error: 'Failed to record audit log' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/n8n/audit
 *
 * Query audit logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')
    const executionId = searchParams.get('executionId')
    const eventType = searchParams.get('eventType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const actorType = searchParams.get('actorType')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100)
    const summary = searchParams.get('summary') === 'true'

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    // If summary requested, return compliance summary
    if (summary) {
      let summaryQuery = supabase
        .from('compliance_audit_summary')
        .select('*')
        .eq('organization_id', userData.organization_id)

      if (workflowId) {
        summaryQuery = summaryQuery.eq('workflow_id', workflowId)
      }

      if (startDate) {
        summaryQuery = summaryQuery.gte('audit_date', startDate)
      }

      if (endDate) {
        summaryQuery = summaryQuery.lte('audit_date', endDate)
      }

      const { data: summaryData, error: summaryError } = await summaryQuery
        .order('audit_date', { ascending: false })
        .limit(30)

      if (summaryError) throw summaryError

      return NextResponse.json({ summary: summaryData })
    }

    // Build query
    let query = supabase
      .from('execution_audit_logs')
      .select('*', { count: 'exact' })
      .eq('organization_id', userData.organization_id)
      .order('event_timestamp', { ascending: false })

    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }

    if (executionId) {
      query = query.eq('execution_id', executionId)
    }

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (actorType) {
      query = query.eq('actor_type', actorType)
    }

    if (startDate) {
      query = query.gte('event_timestamp', startDate)
    }

    if (endDate) {
      query = query.lte('event_timestamp', endDate)
    }

    // Pagination
    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data: logs, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    })
  } catch (error) {
    logger.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/n8n/audit
 *
 * Manually trigger cleanup of expired audit logs (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role (1.6 / S21 security fix)
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Call cleanup function
    const { data: deletedCount, error } = await supabase.rpc('cleanup_expired_audit_logs')

    if (error) throw error

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} expired audit log entries`,
    })
  } catch (error) {
    logger.error('Error cleaning up audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup audit logs' },
      { status: 500 }
    )
  }
}
