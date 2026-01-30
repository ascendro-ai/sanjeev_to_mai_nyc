import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getModel } from '@/lib/gemini/server'
import type { ConversationMessage, NodeData } from '@/types'

/**
 * POST /api/gemini/extract-people
 *
 * Extracts people/stakeholders mentioned in a conversation.
 * Used to populate the team/org chart.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messages } = body as {
      messages: ConversationMessage[]
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid messages array' },
        { status: 400 }
      )
    }

    const model = getModel()

    const conversationText = messages
      .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n')

    const prompt = `Extract people/stakeholders mentioned in this conversation.
Return ONLY a valid JSON array:
[
  {
    "name": "Person name",
    "type": "ai|human",
    "role": "Role/title"
  }
]

If no people are mentioned, return an empty array.

Conversation:
${conversationText}`

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({
        people: [],
        success: true,
      })
    }

    const peopleData = JSON.parse(jsonMatch[0])
    const people: NodeData[] = peopleData.map((person: { name: string; type?: string; role?: string }) => ({
      name: person.name,
      type: (person.type || 'human') as 'ai' | 'human',
      role: person.role,
      status: 'inactive' as const,
      assignedWorkflows: [],
    }))

    return NextResponse.json({
      people,
      success: true,
    })
  } catch (error) {
    console.error('Error in extract-people:', error)
    return NextResponse.json(
      { error: 'Failed to extract people', details: String(error) },
      { status: 500 }
    )
  }
}
