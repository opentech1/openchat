/**
 * usePersistentChat - Wrapper around AI SDK's useChat with Convex persistence
 *
 * Features:
 * - Creates new chat on first message (when chatId is undefined)
 * - Loads existing messages from Convex
 * - Saves messages to Convex on completion
 * - Supports navigation to chat page after creation
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useQuery, useMutation } from "convex/react";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-client";
import { useModelStore } from "@/stores/model";
import { useOpenRouterKey } from "@/stores/openrouter";

export interface UsePersistentChatOptions {
  chatId?: string;
  onChatCreated?: (chatId: string) => void;
}

export interface UsePersistentChatReturn {
  messages: UIMessage[];
  sendMessage: (message: { text: string; files?: any[] }) => Promise<void>;
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | undefined;
  stop: () => void;
  isNewChat: boolean;
  isLoadingMessages: boolean;
  chatId: string | null;
}

// Convert Convex message to AI SDK UIMessage format
function convexMessageToUIMessage(msg: {
  _id: string;
  role: string;
  content: string;
  reasoning?: string;
  createdAt: number;
  attachments?: Array<{
    storageId: string;
    filename: string;
    contentType: string;
    size: number;
    url?: string;
  }>;
}): UIMessage {
  const parts: UIMessage["parts"] = [];

  // Add text part
  if (msg.content) {
    parts.push({ type: "text", text: msg.content });
  }

  // Add reasoning part if present
  if (msg.reasoning) {
    parts.push({ type: "reasoning", text: msg.reasoning });
  }

  // Add file parts for attachments
  if (msg.attachments) {
    for (const attachment of msg.attachments) {
      if (attachment.url) {
        parts.push({
          type: "file",
          mediaType: attachment.contentType,
          filename: attachment.filename,
          url: attachment.url,
        } as any);
      }
    }
  }

  return {
    id: msg._id,
    role: msg.role as "user" | "assistant",
    parts,
  };
}

export function usePersistentChat({
  chatId,
  onChatCreated,
}: UsePersistentChatOptions): UsePersistentChatReturn {
  const { user } = useAuth();
  const { selectedModelId } = useModelStore();
  const { apiKey } = useOpenRouterKey();

  // Track current chat ID (may change when new chat is created)
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    chatId ?? null
  );
  const chatIdRef = useRef<string | null>(chatId ?? null);

  // Track pending user message for onFinish callback (avoids stale closure)
  const pendingUserMessageRef = useRef<{ text: string; id: string } | null>(null);

  // Update ref when chatId prop changes
  useEffect(() => {
    if (chatId) {
      chatIdRef.current = chatId;
      setCurrentChatId(chatId);
    }
  }, [chatId]);

  // First, get the Convex user by Better Auth external ID
  const convexUser = useQuery(
    api.users.getByExternalId,
    user?.id ? { externalId: user.id } : "skip"
  );

  // Get the Convex user ID
  const convexUserId = convexUser?._id;

  // Convex queries and mutations
  const messagesResult = useQuery(
    api.messages.list,
    chatId && convexUserId
      ? { chatId: chatId as Id<"chats">, userId: convexUserId }
      : "skip"
  );

  const createChat = useMutation(api.chats.create);
  const sendMessages = useMutation(api.messages.send);
  const updateTitle = useMutation(api.chats.updateTitle);

  // Track if we're in new chat mode
  const isNewChat = !chatId;

  // Use AI SDK's useChat
  const {
    messages: aiMessages,
    sendMessage: aiSendMessage,
    status,
    error,
    stop,
    setMessages,
  } = useChat({
    id: chatId ?? "new-chat",
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          model: selectedModelId,
          apiKey: apiKey,
          chatId: chatIdRef.current,
        },
      }),
    }),
    onFinish: async ({ message }) => {
      // Save completed message to Convex
      const pendingUserMessage = pendingUserMessageRef.current;
      if (chatIdRef.current && convexUserId && pendingUserMessage) {
        try {
          // Get assistant response text
          const assistantText =
            message.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n") || "";

          // Save to Convex
          await sendMessages({
            chatId: chatIdRef.current as Id<"chats">,
            userId: convexUserId,
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
          });

          // Update chat title from first message
          if (pendingUserMessage.text && !chatId) {
            const title =
              pendingUserMessage.text.slice(0, 100) +
              (pendingUserMessage.text.length > 100 ? "..." : "");
            await updateTitle({
              chatId: chatIdRef.current as Id<"chats">,
              userId: convexUserId,
              title,
            });
          }

          // Clear pending message
          pendingUserMessageRef.current = null;
        } catch (e) {
          console.error("Failed to save messages to Convex:", e);
        }
      }
    },
  });

  // Sync initial messages from Convex when they load
  useEffect(() => {
    if (chatId && messagesResult && messagesResult.length > 0) {
      const convexMessages = messagesResult.map(convexMessageToUIMessage);
      setMessages(convexMessages);
    }
  }, [chatId, messagesResult, setMessages]);

  // Handle sending messages with new chat creation
  const handleSendMessage = useCallback(
    async (message: { text: string; files?: any[] }) => {
      if (!convexUserId) return;

      if (!message.text.trim() && (!message.files || message.files.length === 0)) {
        return;
      }

      // Store pending message for onFinish callback
      const messageId = crypto.randomUUID();
      pendingUserMessageRef.current = { text: message.text, id: messageId };

      // If no chatId, create a new chat first
      if (!chatIdRef.current) {
        try {
          const result = await createChat({
            userId: convexUserId,
            title: "New Chat",
          });

          const newChatId = result.chatId;
          chatIdRef.current = newChatId;
          setCurrentChatId(newChatId);

          // Notify parent about new chat
          onChatCreated?.(newChatId);

          // Now send the message
          await aiSendMessage({
            text: message.text,
            files: message.files,
          });
        } catch (e) {
          console.error("Failed to create chat:", e);
          pendingUserMessageRef.current = null;
        }
      } else {
        // Existing chat - just send
        await aiSendMessage({
          text: message.text,
          files: message.files,
        });
      }
    },
    [convexUserId, createChat, aiSendMessage, onChatCreated]
  );

  return {
    messages: aiMessages,
    sendMessage: handleSendMessage,
    status,
    error,
    stop,
    isNewChat,
    isLoadingMessages: chatId ? messagesResult === undefined : false,
    chatId: currentChatId,
  };
}
