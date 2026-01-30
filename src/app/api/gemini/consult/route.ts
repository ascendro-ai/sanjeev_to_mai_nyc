import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getModel, MAX_QUESTIONS } from '@/lib/gemini/server'
import type { ConversationMessage } from '@/types'

/**
 * POST /api/gemini/consult
 *
 * Workflow consultant chat - asks questions to understand the user's workflow needs.
 * Keeps the Gemini API key secure on the server side.
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
    const { messages, questionCount = 0 } = body as {
      messages: ConversationMessage[]
      questionCount: number
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing or invalid messages array' },
        { status: 400 }
      )
    }

    const model = getModel()

    // Get the last user message
    const lastUserMessage = messages
      .filter((msg) => msg.sender === 'user')
      .pop()
    const userInput = lastUserMessage?.text || ''

    const conversationText = messages
      .map((msg) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n')

    const systemPrompt = buildConsultantPrompt(questionCount)

    // Detect completion signals
    const { isFinalConfirmation, isIntermediateAck, hasRecentSummary, lastMessageWasSummary } =
      detectConversationState(messages, userInput)

    const prompt = buildPrompt(
      systemPrompt,
      conversationText,
      userInput,
      questionCount,
      isFinalConfirmation,
      isIntermediateAck,
      hasRecentSummary,
      lastMessageWasSummary
    )

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    // Mark as complete if: reached max questions OR user indicated readiness
    const isComplete = questionCount >= MAX_QUESTIONS || isFinalConfirmation

    return NextResponse.json({
      response,
      isComplete,
    })
  } catch (error) {
    console.error('Error in consult:', error)
    return NextResponse.json(
      { error: 'Failed to get consultant response', details: String(error) },
      { status: 500 }
    )
  }
}

function buildConsultantPrompt(questionCount: number): string {
  return `You are a friendly workflow consultant helping someone automate their business tasks using an AI agent platform. Your role is to explore and discover their workflow together, not to conduct an interview.

PLATFORM CONTEXT - You should know about these features and their functions:

1. "Create a Task" tab (where you are now): This is the workspace where users can talk about issues they're facing and build workflows. As the consultant, you help users understand their business problems and map out workflows to solve them. The workflow steps, tasks, and process flow that you extract from the conversation will automatically appear in "Your Workflows" tab.

2. "Your Workflows" tab: This is where users can customize and build AI agents easily to solve those tasks. Each workflow shows the sequence of steps, and each step can be assigned to an AI agent (which users can build using the agent builder) or to a human.

3. "Your Team" tab: This is where users can manage their fleet of digital workers who run those workflows and have their humans collaborate with those digital workers.

4. "Control Room" tab: This is a dashboard where users can track progress and updates from all their active agents.

CRITICAL - ACKNOWLEDGE WHAT THE USER SAID:
- ALWAYS acknowledge or reference what the user just said before asking follow-up questions
- Show you're listening by referencing their specific words
- Build on what they said rather than asking them to repeat information

CONVERSATION STYLE - Be exploratory, not directive:
- Act as a collaborator exploring their process together, not an interviewer
- Use exploratory language: "Tell me more about...", "Walk me through...", "What happens when..."
- Be conversational and friendly - like you're brainstorming together

CRITICAL - QUESTION LIMIT: You have asked ${questionCount} questions so far. You have a MAXIMUM of 3-5 questions total to scope this workflow.

WHAT TO EXPLORE (through natural conversation, not direct questions):
- What kind of business/work they do
- Their current process flow
- Pain points and bottlenecks
- People involved
- Automation opportunities (infer from context)

IMPORTANT - DO NOT ask about:
- "Which steps should be automated" - infer from context
- "What needs to remain manual" - infer from context
- Agent granularity, architecture, or technical details

Keep it HIGH-LEVEL and FAST. Focus on understanding WHAT needs to be done, not HOW.

IMPORTANT - DO NOT include question counts or progress indicators in your responses.`
}

function detectConversationState(
  messages: ConversationMessage[],
  userInput: string
): {
  isFinalConfirmation: boolean
  isIntermediateAck: boolean
  hasRecentSummary: boolean
  lastMessageWasSummary: boolean
} {
  const userInputLower = userInput.toLowerCase().trim()

  const strongConfirmations = [
    'that works', "that's perfect", 'sounds perfect', 'sounds good',
    'looks good', 'perfect', 'great', 'exactly', 'correct',
    "that's correct", 'sounds right', "that's right", 'works for me'
  ]

  const readinessPhrases = [
    "let's build", 'ready to build', "let's get started", "let's go",
    "let's do it", 'ready', "i'm ready", 'ready to go',
    "let's move forward", 'move to workflows', 'go to workflows'
  ]

  const lastAssistantMessage = messages
    .filter(msg => msg.sender === 'system')
    .pop()

  const lastMessageWasSummary = !!(lastAssistantMessage && (
    lastAssistantMessage.text.toLowerCase().includes("here's what i understand") ||
    lastAssistantMessage.text.toLowerCase().includes("here's what we discussed") ||
    lastAssistantMessage.text.toLowerCase().includes('does that sound right') ||
    lastAssistantMessage.text.toLowerCase().includes('are you ready') ||
    lastAssistantMessage.text.toLowerCase().includes('workflow steps') ||
    lastAssistantMessage.text.toLowerCase().includes('your workflows')
  ))

  const recentMessages = messages.slice(-2)
  const hasRecentSummary = recentMessages.some(msg =>
    msg.sender === 'system' &&
    (msg.text.toLowerCase().includes("here's what i understand") ||
      msg.text.toLowerCase().includes("here's what we discussed") ||
      msg.text.toLowerCase().includes('workflow steps') ||
      msg.text.toLowerCase().includes('your workflows'))
  )

  const isReadinessSignal = readinessPhrases.some(phrase =>
    userInputLower.includes(phrase)
  )

  const isFinalConfirmation = isReadinessSignal || (
    strongConfirmations.some(phrase =>
      userInputLower.includes(phrase) || userInputLower === phrase.replace(/[!?.]/g, '')
    ) && lastMessageWasSummary
  )

  const isIntermediateAck = !isFinalConfirmation && !isReadinessSignal && (
    userInputLower === 'ok' ||
    userInputLower === 'okay' ||
    userInputLower === 'works' ||
    userInputLower === 'yep' ||
    userInputLower === 'yes' ||
    userInputLower === 'got it'
  )

  return {
    isFinalConfirmation,
    isIntermediateAck,
    hasRecentSummary,
    lastMessageWasSummary,
  }
}

function buildPrompt(
  systemPrompt: string,
  conversationText: string,
  userInput: string,
  questionCount: number,
  isFinalConfirmation: boolean,
  isIntermediateAck: boolean,
  hasRecentSummary: boolean,
  lastMessageWasSummary: boolean
): string {
  let instruction = ''

  if (isFinalConfirmation) {
    instruction = `The user has indicated they're ready to move forward and build. Give a brief, friendly acknowledgment (1-2 sentences MAX) and let them know they can check "Your Workflows" tab. Do NOT ask any questions. Do NOT summarize again.`
  } else if (isIntermediateAck) {
    instruction = `The user is acknowledging what you said. Simply acknowledge briefly and continue the conversation naturally. Do NOT summarize.`
  } else if (hasRecentSummary) {
    instruction = `Do NOT summarize again - we just did that. If they're asking a question, answer it. If they're providing more info, acknowledge it.`
  } else if (questionCount >= MAX_QUESTIONS) {
    instruction = `You have reached the maximum number of questions. Provide a helpful summary focusing on the workflow steps. Tell the user they can check "Your Workflows" tab. Do NOT ask if they're ready - just summarize.`
  } else if (questionCount >= 3) {
    instruction = `You have asked ${questionCount} questions. Provide a summary of what you understand about the workflow. Tell the user they can check "Your Workflows" tab.`
  } else {
    instruction = `Ask your next question to understand the workflow better. Focus on high-level workflow understanding.`
  }

  return `${systemPrompt}

Current conversation:
${conversationText}

The user just said: "${userInput}"

${instruction}`
}
