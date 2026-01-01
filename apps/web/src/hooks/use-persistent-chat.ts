/**
 * usePersistentChat - Wrapper around AI SDK's useChat with Convex persistence
 *
 * Features:
 * - Creates new chat on first message (when chatId is undefined)
 * - Loads existing messages from Convex
 * - Saves messages to Convex on completion
 * - Supports navigation to chat page after creation
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@server/convex/_generated/api'
import type { Id } from '@server/convex/_generated/dataModel'
import { useAuth } from '@/lib/auth-client'
import { useModelStore } from '@/stores/model'
import { useOpenRouterKey } from '@/stores/openrouter'
import { useProviderStore, calculateCost } from '@/stores/provider'
import { usePendingMessageStore } from '@/stores/pending-message'
import { toast } from 'sonner'

export interface UsePersistentChatOptions {
  chatId?: string
  onChatCreated?: (chatId: string) => void
}

export interface UsePersistentChatReturn {
  messages: UIMessage[]
  sendMessage: (message: { text: string; files?: any[] }) => Promise<void>
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  error: Error | undefined
  stop: () => void
  isNewChat: boolean
  isLoadingMessages: boolean
  chatId: string | null
}

// Convert Convex message to AI SDK UIMessage format
function convexMessageToUIMessage(msg: {
  _id: string
  role: string
  content: string
  reasoning?: string
  createdAt: number
  attachments?: Array<{
    storageId: string
    filename: string
    contentType: string
    size: number
    url?: string
  }>
}): UIMessage {
  const parts: UIMessage['parts'] = []

  // Add text part
  if (msg.content) {
    parts.push({ type: 'text', text: msg.content })
  }

  // Add reasoning part if present
  if (msg.reasoning) {
    parts.push({ type: 'reasoning', text: msg.reasoning })
  }

  // Add file parts for attachments
  if (msg.attachments) {
    for (const attachment of msg.attachments) {
      if (attachment.url) {
        parts.push({
          type: 'file',
          mediaType: attachment.contentType,
          filename: attachment.filename,
          url: attachment.url,
        } as any)
      }
    }
  }

  return {
    id: msg._id,
    role: msg.role as 'user' | 'assistant',
    parts,
  }
}

export function usePersistentChat({
  chatId,
  onChatCreated,
}: UsePersistentChatOptions): UsePersistentChatReturn {
  const { user } = useAuth()
  const { selectedModelId } = useModelStore()
  const { apiKey } = useOpenRouterKey()
  const activeProvider = useProviderStore((s) => s.activeProvider)
  const webSearchEnabled = useProviderStore((s) => s.webSearchEnabled)

  // Track current chat ID (may change when new chat is created)
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    chatId ?? null,
  )
  const chatIdRef = useRef<string | null>(chatId ?? null)

  // Track pending user message for onFinish callback (avoids stale closure)
  const pendingUserMessageRef = useRef<{ text: string; id: string } | null>(
    null,
  )

  // Track mount state to prevent stale operations after unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Store onChatCreated in a ref to avoid stale closure
  const onChatCreatedRef = useRef(onChatCreated)
  useEffect(() => {
    onChatCreatedRef.current = onChatCreated
  }, [onChatCreated])

  // Update ref when chatId prop changes
  useEffect(() => {
    if (chatId) {
      chatIdRef.current = chatId
      setCurrentChatId(chatId)
    }
  }, [chatId])

  // First, get the Convex user by Better Auth external ID
  const convexUser = useQuery(
    api.users.getByExternalId,
    user?.id ? { externalId: user.id } : 'skip',
  )

  // Get the Convex user ID
  const convexUserId = convexUser?._id

  // Store convexUserId in a ref to avoid stale closure in onFinish
  // This is critical because onFinish callback may capture an old value
  const convexUserIdRef = useRef(convexUserId)
  useEffect(() => {
    convexUserIdRef.current = convexUserId
  }, [convexUserId])

  // Convex queries and mutations
  const messagesResult = useQuery(
    api.messages.list,
    chatId && convexUserId
      ? { chatId: chatId as Id<'chats'>, userId: convexUserId }
      : 'skip',
  )

  const createChat = useMutation(api.chats.create)
  const sendMessages = useMutation(api.messages.send)
  const updateTitle = useMutation(api.chats.updateTitle)

  // Track if we're in new chat mode
  const isNewChat = !chatId

  // Use AI SDK's useChat
  const {
    messages: aiMessages,
    sendMessage: aiSendMessage,
    status,
    error,
    stop,
    setMessages,
  } = useChat({
    id: chatId ?? 'new-chat',
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          model: selectedModelId,
          provider: activeProvider,
          apiKey: activeProvider === 'openrouter' ? apiKey : undefined,
          chatId: chatIdRef.current,
          enableWebSearch: webSearchEnabled,
        },
      }),
    }),
    onFinish: async ({ message }) => {
      // Save completed message to Convex
      // This callback runs even if the component has navigated away
      const pendingUserMessage = pendingUserMessageRef.current
      const currentConvexUserId = convexUserIdRef.current

      // Track usage for OSSChat Cloud provider
      // Message metadata contains token usage info sent from the server
      const metadata = message.metadata as {
        model?: string
        provider?: string
        inputTokens?: number
        outputTokens?: number
        totalTokens?: number
      } | undefined

      if (metadata?.inputTokens && metadata?.outputTokens && metadata?.model) {
        const providerState = useProviderStore.getState()
        // Only track usage for OSSChat Cloud (free tier with limits)
        if (providerState.activeProvider === 'osschat') {
          const costCents = calculateCost(
            metadata.model,
            metadata.inputTokens,
            metadata.outputTokens,
          )
          providerState.addUsage(costCents)

          // Warn when approaching limit (below 2¢ remaining)
          const remaining = providerState.remainingBudgetCents()
          if (remaining > 0 && remaining <= 2) {
            toast.warning('Approaching daily limit', {
              description: `Only ${remaining.toFixed(1)}¢ remaining of your free daily quota.`,
            })
          } else if (remaining <= 0) {
            toast.error('Daily limit reached', {
              description: 'Add your OpenRouter API key in settings to continue.',
            })
          }
        }
      }

      // Track web search usage if tool was called
      const hasWebSearch = message.parts?.some(
        (p) => p.type === 'tool-call' && (p as { toolName?: string }).toolName === 'webSearch'
      )
      if (hasWebSearch) {
        const providerState = useProviderStore.getState()
        providerState.addSearchUsage()
        
        // Disable web search if limit reached
        if (providerState.isSearchLimitReached()) {
          providerState.setWebSearchEnabled(false)
          toast.info('Web search disabled', {
            description: 'You\'ve reached your daily limit of 20 searches.',
          })
        }
      }

      if (chatIdRef.current && currentConvexUserId && pendingUserMessage) {
        try {
          // Get assistant response text
          const assistantText =
            message.parts
              ?.filter(
                (p): p is { type: 'text'; text: string } => p.type === 'text',
              )
              .map((p) => p.text)
              .join('\n') || ''

          // Save to Convex
          await sendMessages({
            chatId: chatIdRef.current as Id<'chats'>,
            userId: currentConvexUserId,
            userMessage: {
              content: pendingUserMessage.text,
              clientMessageId: pendingUserMessage.id,
              createdAt: Date.now(),
            },
            assistantMessage: {
              content: assistantText,
              clientMessageId: message.id,
              createdAt: Date.now(),
            },
          })

          // Update chat title from first message
          if (pendingUserMessage.text && !chatId) {
            const title =
              pendingUserMessage.text.slice(0, 100) +
              (pendingUserMessage.text.length > 100 ? '...' : '')
            await updateTitle({
              chatId: chatIdRef.current as Id<'chats'>,
              userId: currentConvexUserId,
              title,
            })
          }

          // Clear pending message after successful save
          pendingUserMessageRef.current = null
        } catch (e) {
          console.error('Failed to save messages to Convex:', e)
        }
      }
    },
  })

  // Sync initial messages from Convex when they load
  useEffect(() => {
    if (chatId && messagesResult && messagesResult.length > 0) {
      const convexMessages = messagesResult.map(convexMessageToUIMessage)
      setMessages(convexMessages)
    }
  }, [chatId, messagesResult, setMessages])

  // Check for pending message and auto-send it (for seamless navigation)
  // This runs when navigating from home page to chat page with a pending message
  const pendingMessageConsumed = useRef(false)
  useEffect(() => {
    if (!chatId || !convexUserId || pendingMessageConsumed.current) return

    const pending = usePendingMessageStore.getState().consume(chatId)
    if (pending) {
      pendingMessageConsumed.current = true

      // Store pending message for onFinish callback
      const messageId = crypto.randomUUID()
      pendingUserMessageRef.current = { text: pending.text, id: messageId }

      // Send the message (streaming will happen with correct useChat id)
      aiSendMessage({
        text: pending.text,
        files: pending.files,
      }).catch((e) => {
        console.error('Failed to send pending message:', e)
        pendingUserMessageRef.current = null
      })
    }
  }, [chatId, convexUserId, aiSendMessage])

  // Handle sending messages with new chat creation
  const handleSendMessage = useCallback(
    async (message: { text: string; files?: any[] }) => {
      if (!convexUserId) return

      if (
        !message.text.trim() &&
        (!message.files || message.files.length === 0)
      ) {
        return
      }

      // Check usage limits for OSSChat Cloud provider
      const providerState = useProviderStore.getState()
      if (providerState.activeProvider === 'osschat') {
        if (providerState.isOverLimit()) {
          toast.error('Daily usage limit reached', {
            description: 'You\'ve used your free 10¢ daily limit. Add your OpenRouter API key in settings to continue.',
            action: {
              label: 'Settings',
              onClick: () => window.location.href = '/settings',
            },
          })
          return
        }
      }

      // If no chatId, create a new chat and navigate immediately
      // The message will be auto-sent on the new page (via pending message store)
      if (!chatIdRef.current) {
        try {
          const result = await createChat({
            userId: convexUserId,
            title: 'New Chat',
          })

          const newChatId = result.chatId

          // Store the pending message - it will be sent on the new page
          usePendingMessageStore.getState().set({
            chatId: newChatId,
            text: message.text,
            files: message.files,
          })

          // Navigate immediately - streaming will happen on the new page
          if (onChatCreatedRef.current) {
            onChatCreatedRef.current(newChatId)
          }
        } catch (e) {
          console.error('Failed to create chat:', e)
        }
      } else {
        // Existing chat - send directly
        // Store pending message for onFinish callback
        const messageId = crypto.randomUUID()
        pendingUserMessageRef.current = { text: message.text, id: messageId }

        await aiSendMessage({
          text: message.text,
          files: message.files,
        })
      }
    },
    [convexUserId, createChat, aiSendMessage],
  )

  return {
    messages: aiMessages,
    sendMessage: handleSendMessage,
    status,
    error,
    stop,
    isNewChat,
    isLoadingMessages: chatId ? messagesResult === undefined : false,
    chatId: currentChatId,
  }
}
