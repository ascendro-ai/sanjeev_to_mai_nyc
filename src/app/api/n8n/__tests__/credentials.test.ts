import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST, PATCH, DELETE } from '../credentials/route'

// Mock dependencies
const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockOrganizationId = 'org-123'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { organization_id: mockOrganizationId },
        error: null,
      }),
    })),
  })),
}))

vi.mock('@/lib/n8n/credentials', () => ({
  getCredentialTypes: vi.fn().mockResolvedValue([
    {
      id: 'oauth2',
      name: 'OAuth2',
      authType: 'oauth2',
      requiredFields: [],
    },
    {
      id: 'apiKey',
      name: 'API Key',
      authType: 'api_key',
      requiredFields: [{ name: 'apiKey', label: 'API Key', required: true }],
    },
  ]),
  getCredentials: vi.fn().mockResolvedValue([
    { id: 'cred-1', name: 'Test Cred', type: 'apiKey', config: { key: 'secret' } },
  ]),
  getCredential: vi.fn(),
  createCredential: vi.fn(),
  updateCredential: vi.fn(),
  deleteCredential: vi.fn(),
  getOAuthAuthorizationUrl: vi.fn().mockReturnValue('https://oauth.example.com/auth'),
}))

vi.mock('@/lib/rate-limit', () => ({
  strictRateLimiter: {
    check: vi.fn().mockReturnValue({ allowed: true, remaining: 19, resetIn: 60000 }),
    apply: vi.fn().mockReturnValue(null),
  },
  applyRateLimit: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { createClient } from '@/lib/supabase/server'
import {
  getCredentialTypes,
  getCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential,
} from '@/lib/n8n/credentials'
import { applyRateLimit } from '@/lib/rate-limit'

function createMockGetRequest(searchParams?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/n8n/credentials')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function createMockPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/n8n/credentials', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createMockPatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/n8n/credentials', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createMockDeleteRequest(credentialId: string): NextRequest {
  return new NextRequest(`http://localhost/api/n8n/credentials?id=${credentialId}`, {
    method: 'DELETE',
  })
}

describe('/api/n8n/credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should list all credentials for organization', async () => {
      const request = createMockGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.credentials).toBeDefined()
      expect(getCredentials).toHaveBeenCalledWith(mockOrganizationId)
    })

    it('should return credential types when types=true', async () => {
      const request = createMockGetRequest({ types: 'true' })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.types).toBeDefined()
      expect(getCredentialTypes).toHaveBeenCalled()
    })

    it('should return single credential by ID', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-1',
        name: 'Test Cred',
        type: 'apiKey',
        organizationId: mockOrganizationId,
        config: { key: 'secret' },
      })

      const request = createMockGetRequest({ id: 'cred-1' })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.credential.id).toBe('cred-1')
      expect(getCredential).toHaveBeenCalledWith('cred-1')
    })

    it('should not expose credential secrets', async () => {
      vi.mocked(getCredentials).mockResolvedValueOnce([
        {
          id: 'cred-1',
          name: 'Test',
          type: 'apiKey',
          config: { apiKey: 'super-secret-key' },
          oauthTokens: { access_token: 'token123' },
        },
      ])

      const request = createMockGetRequest()
      const response = await GET(request)

      const body = await response.json()
      expect(body.credentials[0].config).toBeUndefined()
      expect(body.credentials[0].oauthTokens).toBeUndefined()
      expect(body.credentials[0].hasConfig).toBe(true)
    })

    it('should require authentication', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as any)

      const request = createMockGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should return 404 for credential from different organization', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-other',
        name: 'Other Cred',
        type: 'apiKey',
        organizationId: 'different-org',
      })

      const request = createMockGetRequest({ id: 'cred-other' })
      const response = await GET(request)

      expect(response.status).toBe(404)
    })

    it('should return 404 for non-existent credential', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce(null)

      const request = createMockGetRequest({ id: 'non-existent' })
      const response = await GET(request)

      expect(response.status).toBe(404)
    })

    it('should return 400 if user has no organization', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      } as any)

      const request = createMockGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('organization')
    })
  })

  describe('POST', () => {
    it('should create new credential', async () => {
      vi.mocked(createCredential).mockResolvedValueOnce({
        id: 'new-cred',
        name: 'New Credential',
        type: 'apiKey',
        config: { apiKey: 'key123' },
      })

      const request = createMockPostRequest({
        credentialType: 'apiKey',
        credentialName: 'New Credential',
        config: { apiKey: 'key123' },
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.credential.id).toBe('new-cred')
      expect(createCredential).toHaveBeenCalledWith({
        organizationId: mockOrganizationId,
        credentialType: 'apiKey',
        credentialName: 'New Credential',
        config: { apiKey: 'key123' },
        createdBy: mockUser.id,
      })
    })

    it('should return OAuth URL for OAuth credential type', async () => {
      const request = createMockPostRequest({
        action: 'getOAuthUrl',
        credentialType: 'oauth2',
        credentialName: 'Google Account',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.authUrl).toBeDefined()
      expect(body.state).toBeDefined()
    })

    it('should reject missing credential type', async () => {
      const request = createMockPostRequest({
        credentialName: 'Test',
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('credentialType')
    })

    it('should reject missing credential name', async () => {
      const request = createMockPostRequest({
        credentialType: 'apiKey',
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('credentialName')
    })

    it('should reject unknown credential type', async () => {
      const request = createMockPostRequest({
        credentialType: 'unknownType',
        credentialName: 'Test',
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('Unknown')
    })

    it('should require OAuth flow for OAuth2 credentials', async () => {
      const request = createMockPostRequest({
        credentialType: 'oauth2',
        credentialName: 'Test OAuth',
        config: { token: 'direct-token' },
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('OAuth flow')
    })

    it('should validate required fields', async () => {
      const request = createMockPostRequest({
        credentialType: 'apiKey',
        credentialName: 'Test',
        config: {}, // Missing required apiKey field
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('required')
    })

    it('should apply rate limiting', async () => {
      const request = createMockPostRequest({
        credentialType: 'apiKey',
        credentialName: 'Test',
        config: { apiKey: 'key' },
      })
      await POST(request)

      expect(applyRateLimit).toHaveBeenCalled()
    })

    it('should block rate-limited requests', async () => {
      vi.mocked(applyRateLimit).mockReturnValueOnce({
        status: 429,
        json: () => Promise.resolve({ error: 'Rate limited' }),
      } as any)

      const request = createMockPostRequest({
        credentialType: 'apiKey',
        credentialName: 'Test',
        config: { apiKey: 'key' },
      })
      const response = await POST(request)

      expect(response.status).toBe(429)
    })

    it('should require authentication', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as any)

      const request = createMockPostRequest({
        credentialType: 'apiKey',
        credentialName: 'Test',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })

  describe('PATCH', () => {
    it('should update credential name', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-1',
        name: 'Old Name',
        organizationId: mockOrganizationId,
      })
      vi.mocked(updateCredential).mockResolvedValueOnce({
        id: 'cred-1',
        name: 'New Name',
        config: null,
      })

      const request = createMockPatchRequest({
        credentialId: 'cred-1',
        credentialName: 'New Name',
      })
      const response = await PATCH(request)

      expect(response.status).toBe(200)
      expect(updateCredential).toHaveBeenCalledWith('cred-1', {
        credentialName: 'New Name',
        config: undefined,
      })
    })

    it('should update credential config', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-1',
        name: 'Test',
        organizationId: mockOrganizationId,
      })
      vi.mocked(updateCredential).mockResolvedValueOnce({
        id: 'cred-1',
        name: 'Test',
        config: { apiKey: 'new-key' },
      })

      const request = createMockPatchRequest({
        credentialId: 'cred-1',
        config: { apiKey: 'new-key' },
      })
      const response = await PATCH(request)

      expect(response.status).toBe(200)
    })

    it('should reject missing credentialId', async () => {
      const request = createMockPatchRequest({
        credentialName: 'Test',
      })
      const response = await PATCH(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('credentialId')
    })

    it('should return 404 for credential from different organization', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-other',
        name: 'Other',
        organizationId: 'different-org',
      })

      const request = createMockPatchRequest({
        credentialId: 'cred-other',
        credentialName: 'Hacked',
      })
      const response = await PATCH(request)

      expect(response.status).toBe(404)
      expect(updateCredential).not.toHaveBeenCalled()
    })

    it('should not expose config in response', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-1',
        organizationId: mockOrganizationId,
      })
      vi.mocked(updateCredential).mockResolvedValueOnce({
        id: 'cred-1',
        name: 'Test',
        config: { apiKey: 'secret' },
        oauthTokens: { token: 'secret-token' },
      })

      const request = createMockPatchRequest({
        credentialId: 'cred-1',
        config: { apiKey: 'new-key' },
      })
      const response = await PATCH(request)

      const body = await response.json()
      expect(body.credential.config).toBeUndefined()
      expect(body.credential.oauthTokens).toBeUndefined()
      expect(body.credential.hasConfig).toBe(true)
    })

    it('should apply rate limiting', async () => {
      const request = createMockPatchRequest({
        credentialId: 'cred-1',
        credentialName: 'Test',
      })
      await PATCH(request)

      expect(applyRateLimit).toHaveBeenCalled()
    })
  })

  describe('DELETE', () => {
    it('should delete credential', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-1',
        name: 'Test',
        organizationId: mockOrganizationId,
      })
      vi.mocked(deleteCredential).mockResolvedValueOnce(undefined)

      const request = createMockDeleteRequest('cred-1')
      const response = await DELETE(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(deleteCredential).toHaveBeenCalledWith('cred-1')
    })

    it('should reject missing credential ID', async () => {
      const request = new NextRequest('http://localhost/api/n8n/credentials', {
        method: 'DELETE',
      })
      const response = await DELETE(request)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('credential ID')
    })

    it('should return 404 for credential from different organization', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce({
        id: 'cred-other',
        name: 'Other',
        organizationId: 'different-org',
      })

      const request = createMockDeleteRequest('cred-other')
      const response = await DELETE(request)

      expect(response.status).toBe(404)
      expect(deleteCredential).not.toHaveBeenCalled()
    })

    it('should return 404 for non-existent credential', async () => {
      vi.mocked(getCredential).mockResolvedValueOnce(null)

      const request = createMockDeleteRequest('non-existent')
      const response = await DELETE(request)

      expect(response.status).toBe(404)
    })

    it('should apply rate limiting', async () => {
      const request = createMockDeleteRequest('cred-1')
      await DELETE(request)

      expect(applyRateLimit).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as any)

      const request = createMockDeleteRequest('cred-1')
      const response = await DELETE(request)

      expect(response.status).toBe(401)
    })
  })
})
