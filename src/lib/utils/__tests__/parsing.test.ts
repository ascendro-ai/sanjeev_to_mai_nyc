/**
 * Parsing Utilities Tests
 * Tests for parsing utility functions
 */

import { describe, it, expect } from 'vitest'

describe('Parsing Utilities', () => {
  describe('extractJSON', () => {
    it('should extract JSON object from text', async () => {
      const { extractJSON } = await import('../parsing')
      const text = 'Here is the result: {"name": "test", "value": 123}'

      const result = extractJSON<{ name: string; value: number }>(text)

      expect(result).toEqual({ name: 'test', value: 123 })
    })

    it('should extract JSON array from text', async () => {
      const { extractJSON } = await import('../parsing')
      const text = 'The items are: [1, 2, 3, 4, 5]'

      const result = extractJSON<number[]>(text)

      expect(result).toEqual([1, 2, 3, 4, 5])
    })

    it('should extract JSON from markdown code block', async () => {
      const { extractJSON } = await import('../parsing')
      const text = `Here's the data:
\`\`\`json
{"status": "success", "count": 42}
\`\`\``

      const result = extractJSON<{ status: string; count: number }>(text)

      expect(result).toEqual({ status: 'success', count: 42 })
    })

    it('should handle nested JSON objects', async () => {
      const { extractJSON } = await import('../parsing')
      const text = 'Result: {"user": {"name": "John", "age": 30}, "active": true}'

      const result = extractJSON<{ user: { name: string; age: number }; active: boolean }>(text)

      expect(result.user.name).toBe('John')
      expect(result.user.age).toBe(30)
      expect(result.active).toBe(true)
    })

    it('should throw error for invalid JSON', async () => {
      const { extractJSON } = await import('../parsing')
      const text = 'No JSON here, just plain text'

      expect(() => extractJSON(text)).toThrow()
    })

    it('should use custom error message', async () => {
      const { extractJSON } = await import('../parsing')
      const text = 'Invalid content'

      expect(() => extractJSON(text, 'Custom error')).toThrow('Custom error')
    })

    it('should handle JSON with whitespace', async () => {
      const { extractJSON } = await import('../parsing')
      const text = `{
        "key": "value",
        "number": 100
      }`

      const result = extractJSON<{ key: string; number: number }>(text)

      expect(result.key).toBe('value')
      expect(result.number).toBe(100)
    })
  })

  describe('safeParseJSON', () => {
    it('should parse valid JSON', async () => {
      const { safeParseJSON } = await import('../parsing')

      const result = safeParseJSON('{"key": "value"}', {})

      expect(result).toEqual({ key: 'value' })
    })

    it('should return fallback for invalid JSON', async () => {
      const { safeParseJSON } = await import('../parsing')

      const result = safeParseJSON('not json', { default: true })

      expect(result).toEqual({ default: true })
    })

    it('should return fallback for empty string', async () => {
      const { safeParseJSON } = await import('../parsing')

      const result = safeParseJSON('', [])

      expect(result).toEqual([])
    })

    it('should parse JSON arrays', async () => {
      const { safeParseJSON } = await import('../parsing')

      const result = safeParseJSON('[1, 2, 3]', [])

      expect(result).toEqual([1, 2, 3])
    })

    it('should parse JSON primitives', async () => {
      const { safeParseJSON } = await import('../parsing')

      expect(safeParseJSON('null', 'fallback')).toBeNull()
      expect(safeParseJSON('true', false)).toBe(true)
      expect(safeParseJSON('123', 0)).toBe(123)
      expect(safeParseJSON('"hello"', '')).toBe('hello')
    })

    it('should handle malformed JSON gracefully', async () => {
      const { safeParseJSON } = await import('../parsing')

      const result = safeParseJSON('{"incomplete": ', { error: true })

      expect(result).toEqual({ error: true })
    })
  })

  describe('extractCodeBlock', () => {
    it('should extract code from markdown code block', async () => {
      const { extractCodeBlock } = await import('../parsing')
      const text = `Here's some code:
\`\`\`javascript
function hello() {
  console.log("Hello!");
}
\`\`\``

      const result = extractCodeBlock(text)

      expect(result).toContain('function hello()')
      expect(result).toContain('console.log')
    })

    it('should extract specific language code block', async () => {
      const { extractCodeBlock } = await import('../parsing')
      const text = `\`\`\`python
def greet():
    print("Hello")
\`\`\`

\`\`\`javascript
console.log("Hi");
\`\`\``

      const result = extractCodeBlock(text, 'python')

      expect(result).toContain('def greet()')
      expect(result).not.toContain('console.log')
    })

    it('should return null if no code block found', async () => {
      const { extractCodeBlock } = await import('../parsing')
      const text = 'Just plain text without any code blocks'

      const result = extractCodeBlock(text)

      expect(result).toBeNull()
    })

    it('should handle code block without language specifier', async () => {
      const { extractCodeBlock } = await import('../parsing')
      const text = `\`\`\`
some code here
\`\`\``

      const result = extractCodeBlock(text)

      expect(result).toBe('some code here')
    })

    it('should trim whitespace from extracted code', async () => {
      const { extractCodeBlock } = await import('../parsing')
      const text = `\`\`\`

  const x = 1;

\`\`\``

      const result = extractCodeBlock(text)

      expect(result).toBe('const x = 1;')
    })

    it('should return null when looking for non-existent language', async () => {
      const { extractCodeBlock } = await import('../parsing')
      const text = `\`\`\`javascript
code here
\`\`\``

      const result = extractCodeBlock(text, 'python')

      expect(result).toBeNull()
    })

    it('should handle multiple code blocks and return first match', async () => {
      const { extractCodeBlock } = await import('../parsing')
      const text = `\`\`\`
first block
\`\`\`

\`\`\`
second block
\`\`\``

      const result = extractCodeBlock(text)

      expect(result).toBe('first block')
    })
  })
})
