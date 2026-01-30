/**
 * n8n Credential Management Utilities
 *
 * Handles credential storage, encryption, and syncing with n8n.
 */

import { createClient } from '@/lib/supabase/server'

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
const N8N_API_KEY = process.env.N8N_API_KEY || ''
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-dev-key-change-in-prod'

// Types
export interface CredentialType {
  id: string
  displayName: string
  description?: string
  authType: 'oauth2' | 'api_key' | 'basic' | 'custom'
  oauthConfig?: {
    authUrl: string
    tokenUrl: string
    scopes?: string[]
  }
  requiredFields: Array<{
    name: string
    label: string
    type: 'text' | 'password' | 'url'
    required: boolean
  }>
  n8nType: string
  category: string
}

export interface Credential {
  id: string
  organizationId: string
  credentialType: string
  credentialName: string
  n8nCredentialId?: string
  config?: Record<string, unknown>
  oauthTokens?: OAuthTokens
  scopes?: string[]
  expiresAt?: Date
  isValid: boolean
  lastUsedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
}

// Simple encryption (use proper encryption in production)
function encrypt(text: string): string {
  // In production, use proper encryption like AES-256-GCM
  // This is a placeholder that base64 encodes with a simple XOR
  const key = ENCRYPTION_KEY
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return Buffer.from(result).toString('base64')
}

function decrypt(encoded: string): string {
  const key = ENCRYPTION_KEY
  const text = Buffer.from(encoded, 'base64').toString()
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result
}

/**
 * Get all available credential types
 */
export async function getCredentialTypes(): Promise<CredentialType[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('credential_types')
    .select('*')
    .order('category', { ascending: true })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    description: row.description,
    authType: row.auth_type,
    oauthConfig: row.oauth_config,
    requiredFields: row.required_fields || [],
    n8nType: row.n8n_type,
    category: row.category,
  }))
}

/**
 * Get credentials for an organization
 */
export async function getCredentials(organizationId: string): Promise<Credential[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('n8n_credentials')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    credentialType: row.credential_type,
    credentialName: row.credential_name,
    n8nCredentialId: row.n8n_credential_id,
    config: row.config_encrypted ? JSON.parse(decrypt(row.config_encrypted)) : undefined,
    oauthTokens: row.oauth_tokens_encrypted ? JSON.parse(decrypt(row.oauth_tokens_encrypted)) : undefined,
    scopes: row.scopes,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    isValid: row.is_valid,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }))
}

/**
 * Get a single credential by ID
 */
export async function getCredential(credentialId: string): Promise<Credential | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('n8n_credentials')
    .select('*')
    .eq('id', credentialId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    credentialType: data.credential_type,
    credentialName: data.credential_name,
    n8nCredentialId: data.n8n_credential_id,
    config: data.config_encrypted ? JSON.parse(decrypt(data.config_encrypted)) : undefined,
    oauthTokens: data.oauth_tokens_encrypted ? JSON.parse(decrypt(data.oauth_tokens_encrypted)) : undefined,
    scopes: data.scopes,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    isValid: data.is_valid,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

/**
 * Create a new credential
 */
export async function createCredential(params: {
  organizationId: string
  credentialType: string
  credentialName: string
  config?: Record<string, unknown>
  oauthTokens?: OAuthTokens
  scopes?: string[]
  createdBy?: string
}): Promise<Credential> {
  const supabase = await createClient()

  // Get the credential type to determine n8n type
  const { data: credType } = await supabase
    .from('credential_types')
    .select('n8n_type')
    .eq('id', params.credentialType)
    .single()

  if (!credType) {
    throw new Error(`Unknown credential type: ${params.credentialType}`)
  }

  // Create credential in n8n first
  let n8nCredentialId: string | undefined
  if (N8N_API_KEY && (params.config || params.oauthTokens)) {
    try {
      const n8nCredential = await createN8NCredential({
        name: params.credentialName,
        type: credType.n8n_type,
        data: params.oauthTokens
          ? { ...params.oauthTokens }
          : params.config || {},
      })
      n8nCredentialId = n8nCredential.id
    } catch (error) {
      console.warn('Failed to create credential in n8n:', error)
      // Continue without n8n sync - can be synced later
    }
  }

  // Calculate expiry if OAuth tokens have expiry
  const expiresAt = params.oauthTokens?.expiresAt
    ? new Date(params.oauthTokens.expiresAt * 1000)
    : undefined

  // Store in Supabase
  const { data, error } = await supabase
    .from('n8n_credentials')
    .insert({
      organization_id: params.organizationId,
      credential_type: params.credentialType,
      credential_name: params.credentialName,
      n8n_credential_id: n8nCredentialId,
      config_encrypted: params.config ? encrypt(JSON.stringify(params.config)) : null,
      oauth_tokens_encrypted: params.oauthTokens ? encrypt(JSON.stringify(params.oauthTokens)) : null,
      scopes: params.scopes,
      expires_at: expiresAt?.toISOString(),
      created_by: params.createdBy,
    })
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    organizationId: data.organization_id,
    credentialType: data.credential_type,
    credentialName: data.credential_name,
    n8nCredentialId: data.n8n_credential_id,
    config: params.config,
    oauthTokens: params.oauthTokens,
    scopes: params.scopes,
    expiresAt,
    isValid: true,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

/**
 * Update a credential
 */
export async function updateCredential(
  credentialId: string,
  params: {
    credentialName?: string
    config?: Record<string, unknown>
    oauthTokens?: OAuthTokens
    scopes?: string[]
    isValid?: boolean
  }
): Promise<Credential> {
  const supabase = await createClient()

  // Get existing credential
  const existing = await getCredential(credentialId)
  if (!existing) {
    throw new Error('Credential not found')
  }

  // Update in n8n if we have an n8n credential ID
  if (existing.n8nCredentialId && N8N_API_KEY) {
    try {
      const credData = params.oauthTokens
        ? (params.oauthTokens as unknown as Record<string, unknown>)
        : params.config || existing.config || {}
      await updateN8NCredential(existing.n8nCredentialId, {
        name: params.credentialName || existing.credentialName,
        data: credData,
      })
    } catch (error) {
      console.warn('Failed to update credential in n8n:', error)
    }
  }

  // Calculate expiry
  const expiresAt = params.oauthTokens?.expiresAt
    ? new Date(params.oauthTokens.expiresAt * 1000)
    : existing.expiresAt

  // Update in Supabase
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (params.credentialName) updateData.credential_name = params.credentialName
  if (params.config) updateData.config_encrypted = encrypt(JSON.stringify(params.config))
  if (params.oauthTokens) updateData.oauth_tokens_encrypted = encrypt(JSON.stringify(params.oauthTokens))
  if (params.scopes) updateData.scopes = params.scopes
  if (params.isValid !== undefined) updateData.is_valid = params.isValid
  if (expiresAt) updateData.expires_at = expiresAt.toISOString()

  const { data, error } = await supabase
    .from('n8n_credentials')
    .update(updateData)
    .eq('id', credentialId)
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    organizationId: data.organization_id,
    credentialType: data.credential_type,
    credentialName: data.credential_name,
    n8nCredentialId: data.n8n_credential_id,
    config: data.config_encrypted ? JSON.parse(decrypt(data.config_encrypted)) : undefined,
    oauthTokens: data.oauth_tokens_encrypted ? JSON.parse(decrypt(data.oauth_tokens_encrypted)) : undefined,
    scopes: data.scopes,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    isValid: data.is_valid,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  }
}

/**
 * Delete a credential
 */
export async function deleteCredential(credentialId: string): Promise<void> {
  const supabase = await createClient()

  // Get existing credential
  const existing = await getCredential(credentialId)
  if (!existing) {
    throw new Error('Credential not found')
  }

  // Delete from n8n if we have an n8n credential ID
  if (existing.n8nCredentialId && N8N_API_KEY) {
    try {
      await deleteN8NCredential(existing.n8nCredentialId)
    } catch (error) {
      console.warn('Failed to delete credential from n8n:', error)
    }
  }

  // Delete from Supabase
  const { error } = await supabase
    .from('n8n_credentials')
    .delete()
    .eq('id', credentialId)

  if (error) throw error
}

/**
 * Mark credential as used (for tracking)
 */
export async function markCredentialUsed(credentialId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('n8n_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', credentialId)
}

/**
 * Refresh OAuth tokens if expired
 */
export async function refreshOAuthTokens(credentialId: string): Promise<Credential | null> {
  const credential = await getCredential(credentialId)
  if (!credential || !credential.oauthTokens?.refreshToken) {
    return null
  }

  // Get credential type for OAuth config
  const supabase = await createClient()
  const { data: credType } = await supabase
    .from('credential_types')
    .select('oauth_config')
    .eq('id', credential.credentialType)
    .single()

  if (!credType?.oauth_config?.tokenUrl) {
    return null
  }

  // Exchange refresh token for new access token
  const response = await fetch(credType.oauth_config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credential.oauthTokens.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  })

  if (!response.ok) {
    // Mark credential as invalid
    await updateCredential(credentialId, { isValid: false })
    return null
  }

  const tokens = await response.json()
  const newTokens: OAuthTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || credential.oauthTokens.refreshToken,
    expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
    tokenType: tokens.token_type,
    scope: tokens.scope,
  }

  return updateCredential(credentialId, {
    oauthTokens: newTokens,
    isValid: true,
  })
}

// ============================================================================
// N8N API FUNCTIONS
// ============================================================================

interface N8NCredentialResponse {
  id: string
  name: string
  type: string
  createdAt: string
  updatedAt: string
}

async function createN8NCredential(params: {
  name: string
  type: string
  data: Record<string, unknown>
}): Promise<N8NCredentialResponse> {
  const response = await fetch(`${N8N_API_URL}/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: JSON.stringify({
      name: params.name,
      type: params.type,
      data: params.data,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create n8n credential: ${response.status} - ${error}`)
  }

  return response.json()
}

async function updateN8NCredential(
  credentialId: string,
  params: { name?: string; data?: Record<string, unknown> }
): Promise<N8NCredentialResponse> {
  const response = await fetch(`${N8N_API_URL}/credentials/${credentialId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update n8n credential: ${response.status} - ${error}`)
  }

  return response.json()
}

async function deleteN8NCredential(credentialId: string): Promise<void> {
  const response = await fetch(`${N8N_API_URL}/credentials/${credentialId}`, {
    method: 'DELETE',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete n8n credential: ${response.status} - ${error}`)
  }
}

// ============================================================================
// OAUTH FLOW HELPERS
// ============================================================================

/**
 * Generate OAuth authorization URL
 */
export function getOAuthAuthorizationUrl(
  credentialType: CredentialType,
  state: string,
  redirectUri: string
): string {
  if (credentialType.authType !== 'oauth2' || !credentialType.oauthConfig) {
    throw new Error('Credential type does not support OAuth')
  }

  const params = new URLSearchParams({
    client_id: getClientId(credentialType.id),
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  if (credentialType.oauthConfig.scopes) {
    params.set('scope', credentialType.oauthConfig.scopes.join(' '))
  }

  return `${credentialType.oauthConfig.authUrl}?${params.toString()}`
}

/**
 * Exchange OAuth code for tokens
 */
export async function exchangeOAuthCode(
  credentialType: CredentialType,
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  if (credentialType.authType !== 'oauth2' || !credentialType.oauthConfig) {
    throw new Error('Credential type does not support OAuth')
  }

  const response = await fetch(credentialType.oauthConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: getClientId(credentialType.id),
      client_secret: getClientSecret(credentialType.id),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OAuth token exchange failed: ${response.status} - ${error}`)
  }

  const tokens = await response.json()

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
    tokenType: tokens.token_type,
    scope: tokens.scope,
  }
}

/**
 * Get OAuth client ID for a credential type
 */
function getClientId(credentialType: string): string {
  // Map credential types to environment variables
  const clientIdMap: Record<string, string | undefined> = {
    gmail: process.env.GOOGLE_CLIENT_ID,
    google_sheets: process.env.GOOGLE_CLIENT_ID,
    slack: process.env.SLACK_CLIENT_ID,
    notion: process.env.NOTION_CLIENT_ID,
  }

  return clientIdMap[credentialType] || ''
}

/**
 * Get OAuth client secret for a credential type
 */
function getClientSecret(credentialType: string): string {
  const clientSecretMap: Record<string, string | undefined> = {
    gmail: process.env.GOOGLE_CLIENT_SECRET,
    google_sheets: process.env.GOOGLE_CLIENT_SECRET,
    slack: process.env.SLACK_CLIENT_SECRET,
    notion: process.env.NOTION_CLIENT_SECRET,
  }

  return clientSecretMap[credentialType] || ''
}
