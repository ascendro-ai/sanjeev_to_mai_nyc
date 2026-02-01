/**
 * @fileoverview PII (Personally Identifiable Information) filter for data sanitization.
 *
 * This module provides functions to detect and redact sensitive personal data
 * before it is sent to external services like AI models, logging systems, or
 * third-party APIs.
 *
 * Protected Data Types:
 * - Email addresses
 * - Phone numbers (various formats)
 * - Credit card numbers
 * - Social Security Numbers (SSN)
 * - IP addresses
 * - API keys and tokens
 * - Passwords and secrets
 * - Financial account numbers
 * - Personal identification numbers
 *
 * @module lib/pii-filter
 *
 * @example
 * ```typescript
 * import { filterPII, warnIfSensitiveData } from '@/lib/pii-filter'
 *
 * // Before sending to Gemini AI
 * const userInput = {
 *   message: "Call me at 555-123-4567",
 *   email: "user@example.com"
 * }
 *
 * // Check and warn
 * warnIfSensitiveData(userInput, 'AI prompt', logger)
 *
 * // Filter the data
 * const safe = filterPII(userInput)
 * // Result: { message: "Call me at [REDACTED]", email: "[REDACTED]" }
 * ```
 *
 * @security This module helps comply with:
 * - GDPR (General Data Protection Regulation)
 * - CCPA (California Consumer Privacy Act)
 * - PCI DSS (for credit card data)
 * - HIPAA (when extended for healthcare data)
 */

// -----------------------------------------------------------------------------
// Sensitive Key Detection
// -----------------------------------------------------------------------------

/**
 * Keys that likely contain sensitive data.
 *
 * These keys will be automatically redacted regardless of their value.
 * The comparison is case-insensitive and uses substring matching.
 *
 * @example
 * - "userEmail" matches "email"
 * - "API_KEY" matches "api_key"
 * - "socialSecurityNumber" matches "social_security"
 */
const SENSITIVE_KEYS = [
  // Authentication
  'email',
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'apiKey',

  // Government IDs
  'ssn',
  'social_security',
  'socialSecurity',
  'drivers_license',
  'driversLicense',
  'passport',
  'national_id',
  'nationalId',
  'tax_id',
  'taxId',
  'ein',

  // Financial
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'bank_account',
  'bankAccount',
  'routing_number',
  'routingNumber',
  'iban',
  'swift',

  // Contact Information
  'phone',
  'telephone',
  'mobile',
  'address',
  'street',
  'zipcode',
  'zip_code',
  'postalCode',
  'postal_code',

  // Personal
  'dob',
  'date_of_birth',
  'dateOfBirth',
  'birthdate',

  // Tokens and Keys
  'private_key',
  'privateKey',
  'refresh_token',
  'refreshToken',
  'access_token',
  'accessToken',
  'bearer',
  'authorization',
  'auth_token',
  'authToken',
  'session_id',
  'sessionId',
  'cookie',
]

// -----------------------------------------------------------------------------
// Sensitive Value Patterns
// -----------------------------------------------------------------------------

/**
 * Regular expressions that match sensitive value formats.
 *
 * These patterns are applied to string values to detect and redact
 * sensitive data even when the key name doesn't indicate sensitivity.
 *
 * Note: Patterns use the global flag for replace operations.
 */
const SENSITIVE_PATTERNS = [
  // Email addresses
  // Matches: user@example.com, user.name+tag@sub.example.co.uk
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Phone numbers (various formats)
  // Matches: +1-555-123-4567, (555) 123-4567, 555.123.4567
  /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,

  // Credit card numbers
  // Matches: 4111-1111-1111-1111, 4111 1111 1111 1111
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

  // Social Security Numbers
  // Matches: 123-45-6789, 123 45 6789
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

  // IP addresses
  // Matches: 192.168.1.1, 10.0.0.1
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
]

// -----------------------------------------------------------------------------
// Detection Functions
// -----------------------------------------------------------------------------

/**
 * Checks if a key name indicates sensitive data.
 *
 * Uses case-insensitive substring matching against the SENSITIVE_KEYS list.
 *
 * @param key - The object key name to check
 * @returns true if the key likely contains sensitive data
 *
 * @example
 * ```typescript
 * isSensitiveKey('userEmail')      // true (contains 'email')
 * isSensitiveKey('API_KEY')        // true (contains 'api_key')
 * isSensitiveKey('username')       // false
 * isSensitiveKey('description')    // false
 * ```
 *
 * @internal
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_KEYS.some(sensitiveKey =>
    lowerKey.includes(sensitiveKey.toLowerCase())
  )
}

/**
 * Redacts sensitive patterns from a string value.
 *
 * Applies all SENSITIVE_PATTERNS regex patterns and replaces
 * matches with '[REDACTED]'.
 *
 * @param value - The string to redact
 * @returns The string with sensitive patterns replaced
 *
 * @example
 * ```typescript
 * redactPatterns('Email me at user@example.com')
 * // Returns: 'Email me at [REDACTED]'
 *
 * redactPatterns('Call 555-123-4567 today')
 * // Returns: 'Call [REDACTED] today'
 * ```
 *
 * @internal
 */
function redactPatterns(value: string): string {
  let redacted = value
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]')
  }
  return redacted
}

// -----------------------------------------------------------------------------
// Main Filter Function
// -----------------------------------------------------------------------------

/**
 * Recursively filters PII from any data structure.
 *
 * Handles:
 * - Primitive values (strings with pattern matching)
 * - Objects (key checking + recursive value filtering)
 * - Arrays (recursive element filtering)
 * - Nested structures (up to maxDepth levels)
 *
 * @param data - The data to filter (any type)
 * @param maxDepth - Maximum recursion depth to prevent stack overflow
 * @returns A new object/array with PII redacted
 *
 * @example
 * ```typescript
 * const userData = {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   phone: '555-123-4567',
 *   address: {
 *     street: '123 Main St',
 *     city: 'Anytown'
 *   },
 *   message: 'Contact me at john@example.com'
 * }
 *
 * const safe = filterPII(userData)
 * // Result:
 * // {
 * //   name: 'John Doe',
 * //   email: '[REDACTED]',
 * //   phone: '[REDACTED]',
 * //   address: '[REDACTED]',
 * //   message: 'Contact me at [REDACTED]'
 * // }
 * ```
 */
export function filterPII(data: unknown, maxDepth = 10): unknown {
  // Prevent infinite recursion on deeply nested structures
  if (maxDepth <= 0) return '[MAX_DEPTH_EXCEEDED]'

  // Handle null/undefined
  if (data === null || data === undefined) return data

  // Handle strings - apply pattern redaction
  if (typeof data === 'string') {
    return redactPatterns(data)
  }

  // Handle numbers and booleans - return as-is
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data
  }

  // Handle arrays - recursively filter each element
  if (Array.isArray(data)) {
    return data.map(item => filterPII(item, maxDepth - 1))
  }

  // Handle objects - check keys and recursively filter values
  if (typeof data === 'object') {
    const filtered: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        // Sensitive key - redact entire value
        filtered[key] = '[REDACTED]'
      } else if (typeof value === 'string') {
        // String value - apply pattern redaction
        filtered[key] = redactPatterns(value)
      } else if (typeof value === 'object') {
        // Nested object/array - recurse
        filtered[key] = filterPII(value, maxDepth - 1)
      } else {
        // Other types (number, boolean) - keep as-is
        filtered[key] = value
      }
    }

    return filtered
  }

  // Unknown types - return as-is
  return data
}

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

/**
 * Creates a safe copy of data for sending to AI services.
 *
 * This is a type-safe wrapper around filterPII that preserves
 * the input type signature (useful for TypeScript projects).
 *
 * @param data - The data to make safe
 * @returns A new copy with PII redacted
 *
 * @example
 * ```typescript
 * interface UserMessage {
 *   content: string
 *   metadata: Record<string, unknown>
 * }
 *
 * const message: UserMessage = { ... }
 * const safeMessage = createSafeDataForAI(message) // Still typed as UserMessage
 * ```
 */
export function createSafeDataForAI<T>(data: T): T {
  return filterPII(data) as T
}

/**
 * Checks if data contains any potentially sensitive information.
 *
 * Unlike filterPII, this function only checks for the presence of
 * sensitive data without modifying it. Useful for conditional logic.
 *
 * @param data - The data to check
 * @returns true if any sensitive data is detected
 *
 * @example
 * ```typescript
 * if (containsSensitiveData(userInput)) {
 *   // Log warning, show confirmation, etc.
 *   console.warn('User input contains PII')
 * }
 * ```
 */
export function containsSensitiveData(data: unknown): boolean {
  if (data === null || data === undefined) return false

  // Check string values against patterns
  if (typeof data === 'string') {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(data))
  }

  // Check array elements
  if (Array.isArray(data)) {
    return data.some(item => containsSensitiveData(item))
  }

  // Check object keys and values
  if (typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) return true
      if (containsSensitiveData(value)) return true
    }
  }

  return false
}

/**
 * Logs a warning if sensitive data is detected in the input.
 *
 * Use this before sending data to external services to ensure
 * PII is being handled properly. The warning includes the context
 * to help identify where the sensitive data came from.
 *
 * @param data - The data to check
 * @param context - Description of where this data is being used
 * @param logger - Optional logger instance (defaults to console)
 *
 * @example
 * ```typescript
 * // Before calling Gemini
 * warnIfSensitiveData(inputData, 'ai-action input', logger)
 *
 * // Before logging
 * warnIfSensitiveData(requestBody, 'incoming request', logger)
 * ```
 */
export function warnIfSensitiveData(
  data: unknown,
  context: string,
  logger?: { warn: (msg: string, data?: unknown) => void }
): void {
  if (containsSensitiveData(data)) {
    const message = `Potential PII detected in ${context}. Data will be filtered.`
    if (logger) {
      logger.warn(message)
    } else {
      console.warn(message)
    }
  }
}
