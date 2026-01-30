'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ConversationSession, ConversationMessage } from '@/types'

// Database types matching Supabase schema
interface DbConversation {
  id: string
  organization_id: string | null
  workflow_id: string | null
  messages: ConversationMessage[]
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

// Transform database conversation to app conversation
function toConversation(db: DbConversation): ConversationSession {
  return {
    id: db.id,
    organizationId: db.organization_id || undefined,
    workflowId: db.workflow_id || undefined,
    messages: (db.messages || []).map(msg => ({
      sender: msg.sender,
      text: msg.text,
      timestamp: msg.timestamp ? new Date(msg.timestamp as unknown as string) : undefined,
    })),
    createdBy: db.created_by || undefined,
    createdAt: db.created_at ? new Date(db.created_at) : new Date(),
    updatedAt: db.updated_at ? new Date(db.updated_at) : new Date(),
  }
}

export function useConversations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch all conversations
  const {
    data: conversations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) throw error
      return (data as DbConversation[]).map(toConversation)
    },
  })

  // Fetch a single conversation by ID
  const useConversation = (conversationId: string | undefined) => {
    return useQuery({
      queryKey: ['conversations', conversationId],
      queryFn: async () => {
        if (!conversationId) return null
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single()

        if (error) throw error
        return toConversation(data as DbConversation)
      },
      enabled: !!conversationId,
    })
  }

  // Fetch conversation by workflow ID
  const useConversationByWorkflow = (workflowId: string | undefined) => {
    return useQuery({
      queryKey: ['conversations', 'workflow', workflowId],
      queryFn: async () => {
        if (!workflowId) return null
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('workflow_id', workflowId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) throw error
        return data ? toConversation(data as DbConversation) : null
      },
      enabled: !!workflowId,
    })
  }

  // Create a new conversation
  const createConversation = useMutation({
    mutationFn: async (conversation: {
      organizationId: string
      workflowId?: string
      messages?: ConversationMessage[]
      createdBy?: string
    }) => {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          organization_id: conversation.organizationId,
          workflow_id: conversation.workflowId || null,
          messages: conversation.messages || [],
          created_by: conversation.createdBy || null,
        })
        .select()
        .single()

      if (error) throw error
      return toConversation(data as DbConversation)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  // Add a message to a conversation
  const addMessage = useMutation({
    mutationFn: async ({
      conversationId,
      message
    }: {
      conversationId: string
      message: ConversationMessage
    }) => {
      // First, get the current messages
      const { data: current, error: fetchError } = await supabase
        .from('conversations')
        .select('messages')
        .eq('id', conversationId)
        .single()

      if (fetchError) throw fetchError

      const currentMessages = (current as { messages: ConversationMessage[] }).messages || []
      const newMessages = [
        ...currentMessages,
        { ...message, timestamp: message.timestamp || new Date() },
      ]

      // Update with new messages
      const { data, error } = await supabase
        .from('conversations')
        .update({
          messages: newMessages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .select()
        .single()

      if (error) throw error
      return toConversation(data as DbConversation)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', data.id] })
      if (data.workflowId) {
        queryClient.invalidateQueries({ queryKey: ['conversations', 'workflow', data.workflowId] })
      }
    },
  })

  // Update all messages in a conversation
  const updateMessages = useMutation({
    mutationFn: async ({
      conversationId,
      messages
    }: {
      conversationId: string
      messages: ConversationMessage[]
    }) => {
      const { data, error } = await supabase
        .from('conversations')
        .update({
          messages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .select()
        .single()

      if (error) throw error
      return toConversation(data as DbConversation)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', data.id] })
      if (data.workflowId) {
        queryClient.invalidateQueries({ queryKey: ['conversations', 'workflow', data.workflowId] })
      }
    },
  })

  // Link conversation to workflow
  const linkToWorkflow = useMutation({
    mutationFn: async ({
      conversationId,
      workflowId
    }: {
      conversationId: string
      workflowId: string
    }) => {
      const { data, error } = await supabase
        .from('conversations')
        .update({
          workflow_id: workflowId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .select()
        .single()

      if (error) throw error
      return toConversation(data as DbConversation)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', data.id] })
      queryClient.invalidateQueries({ queryKey: ['conversations', 'workflow', data.workflowId] })
    },
  })

  // Delete a conversation
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (error) throw error
      return conversationId
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.removeQueries({ queryKey: ['conversations', conversationId] })
    },
  })

  return {
    conversations,
    isLoading,
    error,
    refetch,
    useConversation,
    useConversationByWorkflow,
    createConversation,
    addMessage,
    updateMessages,
    linkToWorkflow,
    deleteConversation,
  }
}
