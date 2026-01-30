import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getModel } from '@/lib/gemini/server'
import type { ConversationMessage, WorkflowStep } from '@/types'

/**
 * POST /api/gemini/requirements
 *
 * Handles requirements gathering for workflow steps.
 * Supports both:
 * - Getting initial message (action: 'init')
 * - Conversational requirements gathering (action: 'chat')
 * - Building automation requirements (action: 'build')
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
    const {
      action,
      step,
      workflowName,
      messages,
      createTaskConversation,
    } = body as {
      action: 'init' | 'chat' | 'build'
      step: WorkflowStep
      workflowName?: string
      messages?: ConversationMessage[]
      createTaskConversation?: ConversationMessage[]
    }

    if (!step) {
      return NextResponse.json(
        { error: 'Missing step data' },
        { status: 400 }
      )
    }

    const model = getModel()

    switch (action) {
      case 'init':
        return handleInit(model, step, workflowName, createTaskConversation)
      case 'chat':
        if (!messages) {
          return NextResponse.json(
            { error: 'Missing messages for chat action' },
            { status: 400 }
          )
        }
        return handleChat(model, step, messages, createTaskConversation)
      case 'build':
        if (!messages) {
          return NextResponse.json(
            { error: 'Missing messages for build action' },
            { status: 400 }
          )
        }
        return handleBuild(model, step, messages, createTaskConversation)
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: init, chat, or build' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in requirements:', error)
    return NextResponse.json(
      { error: 'Failed to process requirements request', details: String(error) },
      { status: 500 }
    )
  }
}

async function handleInit(
  model: ReturnType<typeof getModel>,
  step: WorkflowStep,
  workflowName?: string,
  createTaskConversation?: ConversationMessage[]
) {
  const createTaskContext = createTaskConversation
    ? `\n\nCONTEXT FROM INITIAL WORKFLOW CONVERSATION:\n${createTaskConversation
        .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
        .join('\n')}`
    : ''

  const prompt = `You are a requirements gathering specialist. A user is about to configure requirements for a workflow step.

WORKFLOW: ${workflowName || 'Unknown'}
STEP: "${step.label}"
STEP TYPE: ${step.type}
ASSIGNED TO: ${step.assignedTo?.type === 'ai' ? 'AI Agent' : 'Human'}

${createTaskContext}

Generate a friendly, conversational initial message to start gathering requirements for this step. The message should:
- Welcome them to requirements gathering
- Reference the workflow context if available
- Ask an initial exploratory question to understand what this step needs to accomplish
- Be conversational and friendly, not directive

Return ONLY the message text, no JSON, no quotes.`

  try {
    const result = await model.generateContent(prompt)
    const message = result.response.text().trim()

    return NextResponse.json({
      message,
      success: true,
    })
  } catch (error) {
    console.error('Error generating initial message:', error)
    return NextResponse.json({
      message: `Hi! I'm here to help you configure requirements for "${step.label}". What does this step need to accomplish?`,
      success: true,
    })
  }
}

async function handleChat(
  model: ReturnType<typeof getModel>,
  step: WorkflowStep,
  messages: ConversationMessage[],
  createTaskConversation?: ConversationMessage[]
) {
  const conversationText = messages
    .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
    .join('\n')

  const createTaskContext = createTaskConversation
    ? `\n\nCONTEXT FROM INITIAL WORKFLOW CONVERSATION:\n${createTaskConversation
        .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
        .join('\n')}`
    : ''

  const prompt = `You are a friendly requirements gathering specialist helping configure an AI agent for a specific workflow step.

WORKFLOW STEP: "${step.label}"
STEP TYPE: ${step.type}
ASSIGNED TO: ${step.assignedTo?.type === 'ai' ? 'AI Agent' : 'Human'}

${createTaskContext}

CONVERSATION STYLE:
- Be friendly, conversational, and helpful
- Acknowledge what the user just said before responding
- Ask one question at a time when you need clarification
- Reference the workflow context when relevant
- Focus on understanding the specific requirements for this step
- Be exploratory and collaborative, not directive
- When you have enough information, acknowledge it naturally

IMPORTANT:
- Respond conversationally to what the user just said
- If they answered a question, acknowledge their answer
- If they provided information, acknowledge it and ask a follow-up if needed
- Keep responses concise and focused (2-4 sentences typically)

Conversation so far:
${conversationText}

Generate a conversational response to the user's last message. Return ONLY the response text, no JSON, no quotes.`

  try {
    const result = await model.generateContent(prompt)
    const response = result.response.text().trim()

    return NextResponse.json({
      response,
      success: true,
    })
  } catch (error) {
    console.error('Error generating chat response:', error)
    throw new Error('Failed to generate requirements conversation')
  }
}

async function handleBuild(
  model: ReturnType<typeof getModel>,
  step: WorkflowStep,
  messages: ConversationMessage[],
  createTaskConversation?: ConversationMessage[]
) {
  const conversationText = messages
    .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
    .join('\n')

  const createTaskContext = createTaskConversation
    ? `\n\nCONTEXT FROM INITIAL WORKFLOW CONVERSATION:\n${createTaskConversation
        .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
        .join('\n')}`
    : ''

  const prompt = `You are helping gather requirements for a workflow step: "${step.label}"

${createTaskContext}

STRATEGIC APPROACH:
1. Analyze what information you have vs. what you need
2. Generate outstanding questions (what you still need to discover)
3. Based on answers so far, infer greenList (allowed actions) and redList (forbidden actions)
4. Use outstanding questions to identify gaps in greenList/redList

RELATIONSHIP BETWEEN QUESTIONS AND CONSTRAINTS:
- Outstanding questions help discover what should go in greenList/redList
- As questions are answered, you can infer more specific constraints
- GreenList/redList might reveal new questions

Based on the conversation, extract:
1. Requirements text (what needs to be done)
2. Outstanding questions - strategic questions you need answered
3. GreenList - allowed actions/behaviors
4. RedList - forbidden actions/behaviors
5. Custom requirements array

Return ONLY a valid JSON object:
{
  "requirementsText": "Description of requirements",
  "blueprint": {
    "greenList": ["allowed action 1", "allowed action 2"],
    "redList": ["forbidden action 1", "forbidden action 2"],
    "outstandingQuestions": ["question 1", "question 2"]
  },
  "customRequirements": ["requirement 1", "requirement 2"]
}

Conversation:
${conversationText}`

  try {
    const result = await model.generateContent(prompt)
    const response = result.response.text()

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse requirements')
    }

    const data = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      requirementsText: data.requirementsText || '',
      blueprint: {
        greenList: data.blueprint?.greenList || [],
        redList: data.blueprint?.redList || [],
        outstandingQuestions: data.blueprint?.outstandingQuestions || [],
      },
      customRequirements: data.customRequirements || [],
      success: true,
    })
  } catch (error) {
    console.error('Error building requirements:', error)
    throw new Error('Failed to build automation requirements')
  }
}
