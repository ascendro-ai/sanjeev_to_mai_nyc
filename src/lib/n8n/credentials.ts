/**
 * n8n Credential Management Utilities
 *
 * Handles credential storage, encryption, and syncing with n8n.
 * Uses AES-256-GCM for credential encryption (S4 security fix).
 */

import { createClient } from '@/lib/supabase/server'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1'
const N8N_API_KEY = process.env.N8N_API_KEY || ''
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY

/**
 * Get the encryption key, validating it exists in production.
 * Deferred validation to runtime to allow builds without the key set.
 */
function getSecureKey(): string {
  if (ENCRYPTION_KEY) {
    return ENCRYPTION_KEY
  }

  // Only warn/error at runtime when encryption is actually used
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY environment variable is required in production. ' +
      'Generate a 32-byte (64 hex character) key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }

  console.warn('WARNING: CREDENTIAL_ENCRYPTION_KEY not set. Using insecure default key for development only.')
  return 'dev-only-key-do-not-use-in-production!!'
}

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

/**
 * Encrypt sensitive data using AES-256-GCM.
 * Format: base64(iv + authTag + ciphertext)
 * - IV: 16 bytes (random for each encryption)
 * - Auth Tag: 16 bytes (for integrity verification)
 * - Ciphertext: variable length
 */
function encrypt(text: string): string {
  // Derive a 32-byte key from the configured key
  // In production, CREDENTIAL_ENCRYPTION_KEY should already be 32 bytes (64 hex chars)
  const secureKey = getSecureKey()
  const keyBuffer = Buffer.from(secureKey.padEnd(32, '0').slice(0, 32), 'utf8')

  // Generate random IV for this encryption
  const iv = randomBytes(16)

  // Create cipher
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)

  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ])

  // Get the authentication tag
  const authTag = cipher.getAuthTag()

  // Combine: IV + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])

  return combined.toString('base64')
}

/**
 * Decrypt data encrypted with AES-256-GCM.
 * Also supports legacy XOR encryption for backward compatibility.
 */
function decrypt(encoded: string): string {
  const secureKey = getSecureKey()
  const buffer = Buffer.from(encoded, 'base64')

  // Check if this is AES-256-GCM format (min 32 bytes: 16 IV + 16 authTag)
  if (buffer.length >= 32) {
    try {
      // Derive the same key
      const keyBuffer = Buffer.from(secureKey.padEnd(32, '0').slice(0, 32), 'utf8')

      // Extract components
      const iv = buffer.subarray(0, 16)
      const authTag = buffer.subarray(16, 32)
      const ciphertext = buffer.subarray(32)

      // Create decipher
      const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv)
      decipher.setAuthTag(authTag)

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ])

      return decrypted.toString('utf8')
    } catch {
      // Fall through to legacy decryption
    }
  }

  // Legacy XOR decryption for backward compatibility with existing data
  // Remove this after migrating all credentials to new format
  console.warn('Using legacy XOR decryption - credential should be re-encrypted')
  const text = buffer.toString()
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ secureKey.charCodeAt(i % secureKey.length))
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
