/**
 * Parsing utilities for extracting structured data from AI responses
 */

/**
 * Extract JSON from a string that may contain markdown or other text
 */
export function extractJSON<T>(response: string, errorMsg = 'Failed to parse JSON from response'): T {
  // Try to find JSON object
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T
    } catch {
      // Fall through to array check
    }
  }

  // Try to find JSON array
  const arrayMatch = response.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T
    } catch {
      throw new Error(errorMsg)
    }
  }

  throw new Error(errorMsg)
}

/**
 * Safely parse JSON with a fallback value
 */
export function safeParseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * Extract code blocks from markdown response
 */
export function extractCodeBlock(response: string, language?: string): string | null {
  const pattern = language
    ? new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``)
    : /```\w*\s*([\s\S]*?)```/

  const match = response.match(pattern)
  return match ? match[1].trim() : null
}
