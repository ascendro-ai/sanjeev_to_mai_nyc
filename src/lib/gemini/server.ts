import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const MAX_QUESTIONS = 5

if (!GEMINI_API_KEY && process.env.NODE_ENV === 'production') {
  console.warn('GEMINI_API_KEY is not set')
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null

export function getModel() {
  if (!genAI) {
    throw new Error('Gemini API key is not configured')
  }
  return genAI.getGenerativeModel({ model: GEMINI_MODEL })
}

export { MAX_QUESTIONS }
