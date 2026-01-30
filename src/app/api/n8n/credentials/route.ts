import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCredentialTypes,
  getCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential,
  getOAuthAuthorizationUrl,
} from '@/lib/n8n/credentials'

/**
 * GET /api/n8n/credentials
 *
 * List credentials for the current user's organization.
 * Query params:
 *   - types=true: Return available credential types instead
 *   - id=<id>: Return a single credential
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Return credential types if requested
    if (searchParams.get('types') === 'true') {
      const types = await getCredentialTypes()
      return NextResponse.json({ types })
    }

    // Return single credential if ID provided
    const credentialId = searchParams.get('id')
    if (credentialId) {
      const credential = await getCredential(credentialId)
      if (!credential) {
        return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
      }
      // Don't expose sensitive data
      return NextResponse.json({
        credential: {
          ...credential,
          config: undefined,
          oauthTokens: undefined,
          hasConfig: !!credential.config,
          hasOAuthTokens: !!credential.oauthTokens,
        },
      })
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    // Return all credentials for the organization
    const credentials = await getCredentials(userData.organization_id)

    // Don't expose sensitive data
    return NextResponse.json({
      credentials: credentials.map((c) => ({
        ...c,
        config: undefined,
        oauthTokens: undefined,
        hasConfig: !!c.config,
        hasOAuthTokens: !!c.oauthTokens,
      })),
    })
  } catch (error) {
    logger.error('Error fetching credentials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/n8n/credentials
 *
 * Create a new credential or get OAuth authorization URL.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, credentialType, credentialName, config } = body

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    // Handle OAuth authorization URL request
    if (action === 'getOAuthUrl') {
      const types = await getCredentialTypes()
      const type = types.find((t) => t.id === credentialType)

      if (!type) {
        return NextResponse.json({ error: 'Unknown credential type' }, { status: 400 })
      }

      if (type.authType !== 'oauth2') {
        return NextResponse.json({ error: 'Credential type does not support OAuth' }, { status: 400 })
      }

      // Generate state for CSRF protection
      const state = Buffer.from(JSON.stringify({
        userId: user.id,
        organizationId: userData.organization_id,
        credentialType,
        credentialName,
        timestamp: Date.now(),
      })).toString('base64')

      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/credentials/oauth/callback`
      const authUrl = getOAuthAuthorizationUrl(type, state, redirectUri)

      return NextResponse.json({ authUrl, state })
    }

    // Create API key or basic auth credential
    if (!credentialType || !credentialName) {
      return NextResponse.json(
        { error: 'Missing required fields: credentialType, credentialName' },
        { status: 400 }
      )
    }

    const types = await getCredentialTypes()
    const type = types.find((t) => t.id === credentialType)

    if (!type) {
      return NextResponse.json({ error: 'Unknown credential type' }, { status: 400 })
    }

    // For OAuth types, they should use the getOAuthUrl action
    if (type.authType === 'oauth2' && action !== 'createFromOAuth') {
      return NextResponse.json(
        { error: 'OAuth credentials must be created through the OAuth flow' },
        { status: 400 }
      )
    }

    // Validate required fields for non-OAuth credentials
    if (type.authType !== 'oauth2' && type.requiredFields.length > 0) {
      for (const field of type.requiredFields) {
        if (field.required && (!config || !config[field.name])) {
          return NextResponse.json(
            { error: `Missing required field: ${field.label}` },
            { status: 400 }
          )
        }
      }
    }

    const credential = await createCredential({
      organizationId: userData.organization_id,
      credentialType,
      credentialName,
      config,
      createdBy: user.id,
    })

    return NextResponse.json({
      credential: {
        ...credential,
        config: undefined,
        oauthTokens: undefined,
        hasConfig: !!credential.config,
        hasOAuthTokens: !!credential.oauthTokens,
      },
    })
  } catch (error) {
    logger.error('Error creating credential:', error)
    return NextResponse.json(
      { error: 'Failed to create credential' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/n8n/credentials
 *
 * Update an existing credential.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { credentialId, credentialName, config } = body

    if (!credentialId) {
      return NextResponse.json({ error: 'Missing credentialId' }, { status: 400 })
    }

    const credential = await updateCredential(credentialId, {
      credentialName,
      config,
    })

    return NextResponse.json({
      credential: {
        ...credential,
        config: undefined,
        oauthTokens: undefined,
        hasConfig: !!credential.config,
        hasOAuthTokens: !!credential.oauthTokens,
      },
    })
  } catch (error) {
    logger.error('Error updating credential:', error)
    return NextResponse.json(
      { error: 'Failed to update credential' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/n8n/credentials
 *
 * Delete a credential.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const credentialId = searchParams.get('id')

    if (!credentialId) {
      return NextResponse.json({ error: 'Missing credential ID' }, { status: 400 })
    }

    await deleteCredential(credentialId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting credential:', error)
    return NextResponse.json(
      { error: 'Failed to delete credential' },
      { status: 500 }
    )
  }
}
