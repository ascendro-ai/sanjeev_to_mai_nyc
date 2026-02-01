/**
 * @fileoverview Request validation utilities using Zod schemas.
 *
 * This module provides Zod schemas for validating API request bodies.
 * Using schema validation helps:
 * - Prevent injection attacks (SQL, XSS, command injection)
 * - Ensure data integrity before database operations
 * - Provide clear error messages for invalid requests
 * - Enable TypeScript type inference from schemas
 *
 * @module lib/validation
 *
 * @example
 * ```typescript
 * import { validateBody, reviewResponseSchema } from '@/lib/validation';
 *
 * export async function POST(request: Request) {
 *   const body = await request.json();
 *   const result = validateBody(reviewResponseSchema, body);
 *
 *   if (!result.success) {
 *     return NextResponse.json({ error: result.error }, { status: 400 });
 *   }
 *
 *   // result.data is now typed correctly
 *   const { reviewId, status, feedback } = result.data;
 * }
 * ```
 */

import { z } from 'zod'

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * UUID v4 validation schema.
 * Used for all ID fields that reference database records.
 */
export const uuidSchema = z.string().uuid()

/**
 * Non-empty string validation.
 * Use for required text fields that cannot be blank.
 */
export const nonEmptyStringSchema = z.string().min(1)

// ============================================================================
// REVIEW REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new review request.
 * Used by POST /api/n8n/review-request endpoint.
 *
 * @property executionId - ID of the workflow execution
 * @property workflowId - Optional workflow UUID
 * @property stepId - ID of the step requiring review
 * @property workerName - Name of the worker requesting review
 * @property reviewType - Type of review: 'approval', 'edit', or 'decision'
 * @property stepLabel - Human-readable step name
 * @property data - Additional review data
 * @property callbackUrl - URL to call when review is complete
 * @property timeoutHours - Hours before review expires (1-168, max 7 days)
 */
export const reviewRequestSchema = z.object({
  executionId: z.string().min(1),
  workflowId: z.string().uuid().optional(),
  stepId: z.string().min(1),
  workerName: z.string().optional(),
  reviewType: z.enum(['approval', 'edit', 'decision']),
  stepLabel: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  callbackUrl: z.string().url().optional(),
  timeoutHours: z.number().min(1).max(168).optional(), // Max 7 days
})

/**
 * Schema for submitting a review response.
 * Used by POST /api/n8n/review-response endpoint.
 *
 * @property reviewId - UUID of the review request being responded to
 * @property status - Decision: approved, rejected, needs_changes, or edited
 * @property feedback - Optional text feedback (max 10,000 characters)
 * @property editedData - Modified data if status is 'edited'
 * @property reviewerId - UUID of the user who reviewed
 */
export const reviewResponseSchema = z.object({
  reviewId: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'needs_changes', 'edited']),
  feedback: z.string().max(10000).optional(),
  editedData: z.record(z.string(), z.unknown()).optional(),
  reviewerId: z.string().uuid().optional(),
})

// ============================================================================
// EXECUTION SCHEMAS
// ============================================================================

/**
 * Schema for workflow execution status updates.
 * Used by POST /api/n8n/execution-update endpoint (called by n8n).
 *
 * @property executionId - ID of the execution being updated
 * @property workflowId - Optional workflow UUID
 * @property workerId - Optional worker UUID
 * @property status - Current execution status
 * @property currentStepIndex - Zero-based index of current step
 * @property currentStepName - Human-readable step name
 * @property outputData - Output from the current step
 * @property error - Error message if status is 'failed'
 */
export const executionUpdateSchema = z.object({
  executionId: z.string().min(1),
  workflowId: z.string().uuid().optional(),
  workerId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'waiting_review', 'completed', 'failed', 'cancelled']),
  currentStepIndex: z.number().int().min(0).optional(),
  currentStepName: z.string().optional(),
  outputData: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(10000).optional(),
})

/**
 * Schema for workflow execution completion.
 * Used by POST /api/n8n/execution-complete endpoint.
 *
 * @property executionId - Optional execution ID (may be inferred)
 * @property workflowId - UUID of the completed workflow
 * @property workerId - Optional worker UUID
 * @property status - Final status: completed or failed
 * @property result - Final workflow output data
 * @property error - Error message if status is 'failed'
 * @property workerName - Name of worker that completed execution
 */
export const executionCompleteSchema = z.object({
  executionId: z.string().optional(),
  workflowId: z.string().uuid(),
  workerId: z.string().uuid().optional(),
  status: z.enum(['completed', 'failed']).optional().default('completed'),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(10000).optional(),
  workerName: z.string().optional(),
})

// ============================================================================
// WORKFLOW SCHEMAS
// ============================================================================

/**
 * Schema for workflow activation/deactivation.
 * Used by POST /api/n8n/activate endpoint.
 *
 * @property workflowId - UUID of the workflow to activate/deactivate
 * @property action - Whether to activate or deactivate
 */
export const workflowActivateSchema = z.object({
  workflowId: z.string().uuid(),
  action: z.enum(['activate', 'deactivate']),
})

/**
 * Schema for webhook trigger payloads.
 * Used by POST /api/n8n/webhook/[workflowId] endpoint.
 *
 * Webhook payloads can have any shape, but we validate common fields.
 *
 * @property data - Main payload data (any shape)
 * @property metadata - Optional metadata about the webhook call
 */
export const webhookTriggerSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ============================================================================
// CREDENTIAL SCHEMAS
// ============================================================================

/**
 * Schema for credential creation/OAuth initiation.
 * Used by POST /api/n8n/credentials endpoint.
 *
 * @property action - Optional action: 'getOAuthUrl' or 'createFromOAuth'
 * @property credentialType - Type of credential (e.g., 'gmail', 'slack')
 * @property credentialName - Human-readable name (max 100 chars)
 * @property config - Credential-specific configuration
 */
export const credentialCreateSchema = z.object({
  action: z.enum(['getOAuthUrl', 'createFromOAuth']).optional(),
  credentialType: z.string().min(1),
  credentialName: z.string().min(1).max(100),
  config: z.record(z.string(), z.unknown()).optional(),
})

// ============================================================================
// VALIDATION HELPER TYPES
// ============================================================================

/**
 * Discriminated union for validation results.
 * Enables type-safe error handling with narrowing.
 *
 * @template T - The validated data type
 *
 * @example
 * ```typescript
 * const result: ValidationResult<User> = validateBody(userSchema, body);
 *
 * if (result.success) {
 *   // TypeScript knows result.data is User
 *   console.log(result.data.email);
 * } else {
 *   // TypeScript knows result.error is string
 *   console.error(result.error);
 * }
 * ```
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a request body against a Zod schema.
 *
 * Returns a discriminated union for type-safe error handling.
 * On failure, formats all validation errors into a single string.
 *
 * @template T - The expected data type (inferred from schema)
 * @param schema - Zod schema to validate against
 * @param body - Request body to validate (typically from request.json())
 * @returns ValidationResult with either typed data or error string
 *
 * @example
 * ```typescript
 * const result = validateBody(reviewResponseSchema, await request.json());
 *
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 *
 * // result.data is now typed as z.infer<typeof reviewResponseSchema>
 * const { reviewId, status } = result.data;
 * ```
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): ValidationResult<T> {
  const result = schema.safeParse(body)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Format error messages for API response
  // Zod provides detailed path and message for each issue
  const errorMessage = result.error.issues
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ')

  return { success: false, error: errorMessage }
}

/**
 * Sanitizes user input to prevent XSS attacks.
 *
 * Escapes HTML special characters that could be used for script injection.
 * Use this for any user-provided strings that will be rendered in HTML.
 *
 * @param input - Raw user input string
 * @returns Sanitized string with HTML entities escaped
 *
 * @example
 * ```typescript
 * const userInput = '<script>alert("xss")</script>';
 * const safe = sanitizeString(userInput);
 * // safe = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Validates and sanitizes pagination parameters from URL search params.
 *
 * Ensures limit and offset are valid integers within bounds.
 * Provides safe defaults if parameters are missing or invalid.
 *
 * @param searchParams - URLSearchParams from request URL
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Object with validated limit and offset
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   const { searchParams } = new URL(request.url);
 *   const { limit, offset } = validatePagination(searchParams);
 *
 *   const data = await db.query()
 *     .limit(limit)
 *     .offset(offset);
 * }
 * ```
 */
export function validatePagination(
  searchParams: URLSearchParams,
  maxLimit = 100
): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get('limit') || '50', 10)),
    maxLimit
  )
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))

  return { limit, offset }
}
