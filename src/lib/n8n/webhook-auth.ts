import { createHmac } from 'crypto'

/**
 * Webhook authentication utilities for securing n8n callbacks.
 *
 * Implements HMAC-SHA256 signature verification to ensure webhook
 * requests are genuinely from n8n and haven't been tampered with.
 */

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

/**
 * Verify the signature of an incoming webhook request.
 *
 * @param body - The raw request body as a string
 * @param signature - The signature from the x-webhook-signature header
 * @returns true if the signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  // If no secret is configured, allow the request (for development)
  // In production, WEBHOOK_SECRET should always be set
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('WEBHOOK_SECRET not configured - rejecting webhook')
      return false
    }
    console.warn('WEBHOOK_SECRET not configured - allowing request in development')
    return true
  }

  if (!signature) {
    return false
  }

  const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  // Support both formats: raw hex and prefixed
  const normalizedSignature = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature

  // Use timing-safe comparison to prevent timing attacks
  if (expectedSignature.length !== normalizedSignature.length) {
    return false
  }

  // Simple timing-safe comparison
  let mismatch = 0
  for (let i = 0; i < expectedSignature.length; i++) {
    mismatch |= expectedSignature.charCodeAt(i) ^ normalizedSignature.charCodeAt(i)
  }

  return mismatch === 0
}

/**
 * Generate a webhook signature for testing or for outgoing webhooks.
 *
 * @param body - The request body to sign
 * @returns The signature with sha256= prefix
 */
export function generateWebhookSignature(body: string): string {
  if (!WEBHOOK_SECRET) {
    throw new Error('WEBHOOK_SECRET is not configured')
  }

  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  return `sha256=${signature}`
}

/**
 * Helper function to verify a webhook request and return an error response if invalid.
 * Use this in route handlers for cleaner code.
 *
 * @param request - The NextRequest object
 * @returns { valid: true, body: string } if valid, { valid: false, error: string } if invalid
 */
export async function validateWebhookRequest(
  request: Request
): Promise<{ valid: true; body: string } | { valid: false; error: string }> {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-webhook-signature')

    if (!verifyWebhookSignature(body, signature)) {
      return { valid: false, error: 'Invalid webhook signature' }
    }

    return { valid: true, body }
  } catch (error) {
    return { valid: false, error: 'Failed to read request body' }
  }
}
