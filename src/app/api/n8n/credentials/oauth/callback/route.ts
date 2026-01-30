import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCredentialTypes,
  exchangeOAuthCode,
  createCredential,
} from '@/lib/n8n/credentials'

/**
 * GET /api/n8n/credentials/oauth/callback
 *
 * OAuth callback handler. Receives the authorization code from the OAuth provider,
 * exchanges it for tokens, and creates the credential.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth error
    if (error) {
      logger.error('OAuth error:', { error, errorDescription })
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${encodeURIComponent(errorDescription || error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=missing_params`
      )
    }

    // Decode and validate state
    let stateData: {
      userId: string
      organizationId: string
      credentialType: string
      credentialName: string
      timestamp: number
    }

    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      logger.error('Invalid OAuth state')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
      )
    }

    // Check state timestamp (expire after 10 minutes)
    const stateAge = Date.now() - stateData.timestamp
    if (stateAge > 10 * 60 * 1000) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=state_expired`
      )
    }

    // Get credential type
    const types = await getCredentialTypes()
    const credentialType = types.find((t) => t.id === stateData.credentialType)

    if (!credentialType) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=unknown_type`
      )
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/credentials/oauth/callback`
    const tokens = await exchangeOAuthCode(credentialType, code, redirectUri)

    // Create the credential
    const credential = await createCredential({
      organizationId: stateData.organizationId,
      credentialType: stateData.credentialType,
      credentialName: stateData.credentialName || `${credentialType.displayName} Connection`,
      oauthTokens: tokens,
      scopes: credentialType.oauthConfig?.scopes,
      createdBy: stateData.userId,
    })

    logger.info('OAuth credential created successfully', {
      credentialId: credential.id,
      credentialType: stateData.credentialType,
      organizationId: stateData.organizationId,
    })

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=true&credential=${credential.id}`
    )
  } catch (error) {
    logger.error('OAuth callback error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${encodeURIComponent(message)}`
    )
  }
}
