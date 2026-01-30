import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

/**
 * POST /api/n8n/blueprint
 *
 * Record feedback on an AI action for blueprint learning
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      stepId,
      workflowId,
      executionId,
      actionType,
      actionData,
      originalBlueprint,
      feedbackType,
      feedbackReason,
      editedResult,
    } = body

    if (!stepId || !originalBlueprint || !feedbackType) {
      return NextResponse.json(
        { error: 'Missing required fields: stepId, originalBlueprint, feedbackType' },
        { status: 400 }
      )
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    // Analyze the feedback to generate suggestions
    let suggestedAdditions = null
    let suggestedRemovals = null

    if (feedbackType === 'rejected' || feedbackType === 'edited') {
      const suggestions = await analyzeFeedbackForSuggestions({
        actionData,
        originalBlueprint,
        feedbackType,
        feedbackReason,
        editedResult,
      })
      suggestedAdditions = suggestions.additions
      suggestedRemovals = suggestions.removals
    }

    // Record the feedback
    const { data: feedback, error } = await supabase
      .from('blueprint_feedback')
      .insert({
        organization_id: userData.organization_id,
        workflow_id: workflowId,
        step_id: stepId,
        execution_id: executionId,
        action_type: actionType || 'ai_action',
        action_data: actionData,
        original_blueprint: originalBlueprint,
        feedback_type: feedbackType,
        feedback_reason: feedbackReason,
        edited_result: editedResult,
        suggested_additions: suggestedAdditions,
        suggested_removals: suggestedRemovals,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
      suggestions: {
        additions: suggestedAdditions,
        removals: suggestedRemovals,
      },
    })
  } catch (error) {
    logger.error('Error recording blueprint feedback:', error)
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/n8n/blueprint
 *
 * Get blueprint improvement suggestions for a step based on historical feedback
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stepId = searchParams.get('stepId')
    const workflowId = searchParams.get('workflowId')

    if (!stepId) {
      return NextResponse.json({ error: 'stepId is required' }, { status: 400 })
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    // Get aggregated feedback for this step
    const { data: feedback, error } = await supabase
      .from('blueprint_feedback')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .eq('step_id', stepId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    // Aggregate suggestions
    const stats = {
      totalFeedback: feedback?.length || 0,
      approvals: feedback?.filter((f) => f.feedback_type === 'approved').length || 0,
      rejections: feedback?.filter((f) => f.feedback_type === 'rejected').length || 0,
      edits: feedback?.filter((f) => f.feedback_type === 'edited').length || 0,
    }

    // Collect unique suggestions
    const additionsSet = new Set<string>()
    const removalsSet = new Set<string>()

    feedback?.forEach((f) => {
      if (f.suggested_additions) {
        (f.suggested_additions as string[]).forEach((item) => additionsSet.add(item))
      }
      if (f.suggested_removals) {
        (f.suggested_removals as string[]).forEach((item) => removalsSet.add(item))
      }
    })

    // Generate comprehensive suggestions using AI
    let aiSuggestions = null
    if (stats.totalFeedback >= 3) {
      aiSuggestions = await generateBlueprintSuggestions(feedback || [], stepId)
    }

    return NextResponse.json({
      stepId,
      stats,
      suggestions: {
        addToGreenList: Array.from(additionsSet),
        addToRedList: Array.from(removalsSet),
        aiSuggestions,
      },
      recentFeedback: feedback?.slice(0, 5).map((f) => ({
        type: f.feedback_type,
        reason: f.feedback_reason,
        createdAt: f.created_at,
      })),
    })
  } catch (error) {
    logger.error('Error fetching blueprint suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}

/**
 * Analyze feedback to generate blueprint suggestions
 */
async function analyzeFeedbackForSuggestions(params: {
  actionData: unknown
  originalBlueprint: { greenList: string[]; redList: string[] }
  feedbackType: string
  feedbackReason?: string
  editedResult?: unknown
}): Promise<{ additions: string[]; removals: string[] }> {
  if (!GEMINI_API_KEY) {
    return { additions: [], removals: [] }
  }

  try {
    const prompt = `Analyze this feedback on an AI action to suggest blueprint improvements.

Original Blueprint:
- Green List (Allowed): ${JSON.stringify(params.originalBlueprint.greenList)}
- Red List (Forbidden): ${JSON.stringify(params.originalBlueprint.redList)}

Action Data: ${JSON.stringify(params.actionData)}
Feedback Type: ${params.feedbackType}
Feedback Reason: ${params.feedbackReason || 'Not provided'}
${params.editedResult ? `Edited Result: ${JSON.stringify(params.editedResult)}` : ''}

Based on this feedback, suggest:
1. Items to ADD to the Green List (actions that should be allowed)
2. Items to ADD to the Red List (actions that should be forbidden)

Return JSON: {"additions": ["item1", "item2"], "removals": ["item1", "item2"]}
Keep suggestions concise and actionable.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) return { additions: [], removals: [] }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) return { additions: [], removals: [] }

    return JSON.parse(content)
  } catch {
    return { additions: [], removals: [] }
  }
}

/**
 * Generate comprehensive blueprint suggestions based on historical feedback
 */
async function generateBlueprintSuggestions(
  feedback: Array<{
    feedback_type: string
    feedback_reason: string
    action_data: unknown
    original_blueprint: { greenList: string[]; redList: string[] }
  }>,
  stepId: string
): Promise<{
  summary: string
  recommendedGreenList: string[]
  recommendedRedList: string[]
  confidence: number
}> {
  if (!GEMINI_API_KEY) {
    return {
      summary: 'AI suggestions not available',
      recommendedGreenList: [],
      recommendedRedList: [],
      confidence: 0,
    }
  }

  try {
    const prompt = `Analyze the following feedback history for a workflow step and recommend an optimized blueprint.

Step ID: ${stepId}
Total Feedback Records: ${feedback.length}

Feedback Summary:
${feedback.slice(0, 20).map((f, i) => `
${i + 1}. Type: ${f.feedback_type}
   Reason: ${f.feedback_reason || 'Not provided'}
   Original Blueprint: Green=${JSON.stringify(f.original_blueprint?.greenList || [])} Red=${JSON.stringify(f.original_blueprint?.redList || [])}
`).join('\n')}

Based on this feedback pattern, recommend:
1. An optimized Green List (allowed actions)
2. An optimized Red List (forbidden actions)
3. A brief summary of why these changes are recommended
4. A confidence score (0-100) for these recommendations

Return JSON:
{
  "summary": "Brief explanation of recommendations",
  "recommendedGreenList": ["action1", "action2"],
  "recommendedRedList": ["action1", "action2"],
  "confidence": 75
}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      return {
        summary: 'Failed to generate AI suggestions',
        recommendedGreenList: [],
        recommendedRedList: [],
        confidence: 0,
      }
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      return {
        summary: 'No suggestions available',
        recommendedGreenList: [],
        recommendedRedList: [],
        confidence: 0,
      }
    }

    return JSON.parse(content)
  } catch {
    return {
      summary: 'Error generating suggestions',
      recommendedGreenList: [],
      recommendedRedList: [],
      confidence: 0,
    }
  }
}
