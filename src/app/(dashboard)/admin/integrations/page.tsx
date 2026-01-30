'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plug,
  Key,
  RefreshCw,
  Trash2,
  Plus,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Mail,
  MessageSquare,
  Database,
  Globe,
  Lock,
} from 'lucide-react'
import { Button, Card, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Credential {
  id: string
  credential_type: string
  credential_name: string
  n8n_credential_id: string | null
  scopes: string[] | null
  expires_at: string | null
  created_at: string
  updated_at: string
  status: 'active' | 'expired' | 'error'
}

interface CredentialType {
  id: string
  display_name: string
  auth_type: 'oauth2' | 'api_key' | 'basic' | 'custom'
  icon: React.ReactNode
  description: string
  scopes?: string[]
}

const CREDENTIAL_TYPES: CredentialType[] = [
  {
    id: 'gmail',
    display_name: 'Gmail',
    auth_type: 'oauth2',
    icon: <Mail className="h-5 w-5 text-red-500" />,
    description: 'Send and receive emails via Gmail',
    scopes: ['gmail.send', 'gmail.readonly'],
  },
  {
    id: 'slack',
    display_name: 'Slack',
    auth_type: 'oauth2',
    icon: <MessageSquare className="h-5 w-5 text-purple-500" />,
    description: 'Send messages and manage channels',
    scopes: ['chat:write', 'channels:read'],
  },
  {
    id: 'notion',
    display_name: 'Notion',
    auth_type: 'oauth2',
    icon: <Database className="h-5 w-5 text-gray-700" />,
    description: 'Read and write to Notion databases',
  },
  {
    id: 'openai',
    display_name: 'OpenAI',
    auth_type: 'api_key',
    icon: <Globe className="h-5 w-5 text-green-500" />,
    description: 'Access GPT models and embeddings',
  },
  {
    id: 'anthropic',
    display_name: 'Anthropic',
    auth_type: 'api_key',
    icon: <Globe className="h-5 w-5 text-orange-500" />,
    description: 'Access Claude models',
  },
  {
    id: 'custom',
    display_name: 'Custom API',
    auth_type: 'api_key',
    icon: <Key className="h-5 w-5 text-blue-500" />,
    description: 'Add a custom API integration',
  },
]

export default function IntegrationsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<CredentialType | null>(null)
  const [credentialName, setCredentialName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [customUrl, setCustomUrl] = useState('')

  // Fetch credentials
  const { data: credentials, isLoading } = useQuery({
    queryKey: ['admin-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('n8n_credentials')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map((cred): Credential => ({
        ...cred,
        status: cred.expires_at && new Date(cred.expires_at) < new Date()
          ? 'expired'
          : 'active',
      }))
    },
  })

  // Add credential mutation
  const addCredential = useMutation({
    mutationFn: async (params: {
      type: string
      name: string
      apiKey?: string
      customUrl?: string
    }) => {
      const response = await fetch('/api/n8n/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add credential')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credentials'] })
      closeAddModal()
    },
  })

  // Delete credential mutation
  const deleteCredential = useMutation({
    mutationFn: async (credentialId: string) => {
      const response = await fetch(`/api/n8n/credentials?id=${credentialId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete credential')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credentials'] })
    },
  })

  // Refresh OAuth token mutation
  const refreshToken = useMutation({
    mutationFn: async (credentialId: string) => {
      const response = await fetch('/api/n8n/credentials/oauth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to refresh token')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-credentials'] })
    },
  })

  const closeAddModal = () => {
    setIsAddModalOpen(false)
    setSelectedType(null)
    setCredentialName('')
    setApiKey('')
    setCustomUrl('')
  }

  const handleAddCredential = () => {
    if (!selectedType || !credentialName) return

    if (selectedType.auth_type === 'oauth2') {
      // Redirect to OAuth flow
      window.location.href = `/api/n8n/credentials/oauth/start?type=${selectedType.id}&name=${encodeURIComponent(credentialName)}`
    } else {
      // Add API key credential
      addCredential.mutate({
        type: selectedType.id,
        name: credentialName,
        apiKey,
        customUrl: selectedType.id === 'custom' ? customUrl : undefined,
      })
    }
  }

  const getCredentialTypeInfo = (type: string) => {
    return CREDENTIAL_TYPES.find((t) => t.id === type) || CREDENTIAL_TYPES[CREDENTIAL_TYPES.length - 1]
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" />
            Active
          </span>
        )
      case 'expired':
        return (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            Expired
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-orange-600">
            <AlertCircle className="h-3 w-3" />
            Error
          </span>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500">
            Manage OAuth connections and API credentials
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* Credentials List */}
      {credentials && credentials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credentials.map((credential) => {
            const typeInfo = getCredentialTypeInfo(credential.credential_type)
            return (
              <Card key={credential.id} variant="outlined">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {typeInfo.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {credential.credential_name}
                        </h3>
                        {getStatusBadge(credential.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {typeInfo.display_name}
                      </p>
                      {credential.scopes && credential.scopes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {credential.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Added {new Date(credential.created_at).toLocaleDateString()}
                        {credential.expires_at && (
                          <> • Expires {new Date(credential.expires_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {typeInfo.auth_type === 'oauth2' && credential.status === 'expired' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshToken.mutate(credential.id)}
                        isLoading={refreshToken.isPending}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this integration?')) {
                          deleteCredential.mutate(credential.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card variant="outlined">
          <div className="text-center py-12">
            <Plug className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No integrations configured
            </h3>
            <p className="text-gray-500 mb-4">
              Add OAuth connections or API keys to enable workflow integrations
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </div>
        </Card>
      )}

      {/* Available Integrations */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Available Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CREDENTIAL_TYPES.map((type) => {
            const isConnected = credentials?.some(
              (c) => c.credential_type === type.id && c.status === 'active'
            )
            return (
              <Card
                key={type.id}
                variant="outlined"
                className={cn(
                  'cursor-pointer transition-shadow hover:shadow-md',
                  isConnected && 'border-green-200 bg-green-50'
                )}
                onClick={() => {
                  setSelectedType(type)
                  setIsAddModalOpen(true)
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">{type.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">
                        {type.display_name}
                      </h3>
                      {isConnected && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {type.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        {type.auth_type === 'oauth2' ? (
                          <>
                            <Lock className="h-3 w-3" />
                            OAuth 2.0
                          </>
                        ) : (
                          <>
                            <Key className="h-3 w-3" />
                            API Key
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Add Integration Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        title={selectedType ? `Add ${selectedType.display_name}` : 'Add Integration'}
        size="md"
      >
        {!selectedType ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select an integration type to configure:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CREDENTIAL_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
                >
                  {type.icon}
                  <div>
                    <p className="font-medium text-gray-900">{type.display_name}</p>
                    <p className="text-xs text-gray-500">{type.auth_type}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {selectedType.icon}
              <div>
                <p className="font-medium text-gray-900">{selectedType.display_name}</p>
                <p className="text-sm text-gray-500">{selectedType.description}</p>
              </div>
            </div>

            <Input
              label="Connection Name"
              value={credentialName}
              onChange={(e) => setCredentialName(e.target.value)}
              placeholder={`My ${selectedType.display_name} Connection`}
            />

            {selectedType.auth_type === 'api_key' && (
              <>
                <Input
                  label="API Key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                />
                {selectedType.id === 'custom' && (
                  <Input
                    label="Base URL"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://api.example.com"
                  />
                )}
              </>
            )}

            {selectedType.auth_type === 'oauth2' && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  You will be redirected to {selectedType.display_name} to authorize
                  access. Make sure pop-ups are enabled.
                </p>
                {selectedType.scopes && (
                  <div className="mt-2">
                    <p className="text-xs text-blue-600 font-medium">
                      Requested permissions:
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedType.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={closeAddModal}>
                Cancel
              </Button>
              <Button
                onClick={handleAddCredential}
                isLoading={addCredential.isPending}
                disabled={!credentialName || (selectedType.auth_type === 'api_key' && !apiKey)}
              >
                {selectedType.auth_type === 'oauth2' ? (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
