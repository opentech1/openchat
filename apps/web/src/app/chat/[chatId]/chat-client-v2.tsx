"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "server/convex/_generated/api";
import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Play, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/chat-input";
import { MessageContent } from "@/components/message-content";
import { OpenRouterConnect } from "@/components/auth/openrouter-connect";
import { useOpenRouterAuth } from "@/contexts/openrouter-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { Id } from "server/convex/_generated/dataModel";

interface ChatPageClientProps {
  chatId: string;
}

interface StreamData {
  streamId: string;
  partialContent: string;
  stopPosition: number;
  model: string;
  messages: any[];
  canResume: boolean;
  messageId: string;
  savedToDb: boolean;
}

export default function ChatPageClient({ chatId }: ChatPageClientProps) {
  // Load saved model from localStorage or use default
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedModel = localStorage.getItem('selectedModel');
      return savedModel || "openai/gpt-4o-mini";
    }
    return "openai/gpt-4o-mini";
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stoppedStreams, setStoppedStreams] = useState<Map<string, StreamData>>(new Map());
  const [continuingMessageId, setContinuingMessageId] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamIdRef = useRef<string | null>(null);
  const currentStreamMessages = useRef<any[]>([]);
  const currentMessageIdRef = useRef<string | null>(null);
  const isStreamSavedRef = useRef<boolean>(false);
  const isAbortingRef = useRef<boolean>(false); // Track user-initiated aborts
  const lastScrollTop = useRef(0);
  const scrollCheckTimer = useRef<NodeJS.Timeout | null>(null);

  const { isConnected, token } = useOpenRouterAuth();
  const chat = useQuery(api.chats.getChat, { chatId: chatId as Id<"chats"> });
  const messages = useQuery(api.messages.getMessages, { chatId: chatId as Id<"chats"> });
  const sendMessage = useMutation(api.messages.sendMessage);
  const updateMessage = useMutation(api.messages.updateMessage);

  // Save model selection to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedModel', selectedModel);
    }
  }, [selectedModel]);

  // Improved scroll detection with debouncing
  const handleScroll = useCallback(() => {
    if (scrollCheckTimer.current) {
      clearTimeout(scrollCheckTimer.current);
    }

    scrollCheckTimer.current = setTimeout(() => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isAtBottom = distanceFromBottom < 50;
        
        // Only update state if there's an actual change
        if (!isAtBottom && !isUserScrolling) {
          setIsUserScrolling(true);
          setShowScrollButton(true);
        } else if (isAtBottom && isUserScrolling) {
          setIsUserScrolling(false);
          setShowScrollButton(false);
        }
        
        lastScrollTop.current = scrollTop;
      }
    }, 100); // Debounce for 100ms
  }, [isUserScrolling]);

  // Auto-scroll only when appropriate
  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled up
    if (!isUserScrolling) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: streamingContent ? "auto" : "smooth",
          block: "end" 
        });
      });
    }
  }, [messages?.length, streamingContent]); // Only trigger on new messages or streaming updates

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    setIsUserScrolling(false);
    setShowScrollButton(false);
    messagesEndRef.current?.scrollIntoView({ 
      behavior: "smooth",
      block: "end"
    });
  }, []);

  useEffect(() => {
    if (chat?.title) {
      document.title = `${chat.title} - OpenChat`;
    } else {
      document.title = "Chat - OpenChat";
    }
  }, [chat?.title]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('[STOP] User clicked stop button');
      console.log('[STOP] Current streamingContent length:', streamingContent.length);
      console.log('[STOP] isStreamSavedRef.current:', isStreamSavedRef.current);
      
      // Set abort flag IMMEDIATELY before sending abort signal
      isAbortingRef.current = true;
      console.log('[STOP] Set isAbortingRef = true');
      
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      console.log('[STOP] Abort signal sent');
      
      // Handle stopping during continuation differently
      if (continuingMessageId && streamingContent) {
        console.log('[STOP] Stopping continuation for message:', continuingMessageId);
        // We're continuing an existing message - just update the UI state
        // The continuation handler will take care of updating the DB
        setIsLoading(false);
        // Don't clear streamingContent here - let the continuation handler do it
        return;
      }
      
      // Don't save here - let handleSubmit be the single source of truth for saving
      // Just update the UI state
      console.log('[STOP] Setting loading to false, NOT clearing streamingContent');
      setIsLoading(false);
      // Don't clear streamingContent yet - handleSubmit needs it for saving
    }
  }, [continuingMessageId, streamingContent]);

  const continueGeneration = async (messageId: string) => {
    if (isLoading) return;
    
    // Get the stream data for this message
    const streamData = stoppedStreams.get(messageId);
    if (!streamData || !streamData.canResume) {
      console.error('Cannot resume stream for message:', messageId);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setContinuingMessageId(messageId);
    currentMessageIdRef.current = messageId;
    setStreamingContent(''); // Start fresh - don't duplicate
    isAbortingRef.current = false; // Reset abort flag for continuation
    
    // Create new abort controller for continuation
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      // Send continuation request with resume flag
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: streamData.messages,
          model: streamData.model,
          token,
          streamId: streamData.streamId,
          resume: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Continuation failed: ${response.status}`);
      }
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let continuedContent = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.type === 'resume') {
                    // Skip - we already have the previous content in the DB
                    continue;
                  } else if (parsed.type === 'delta') {
                    // New content being generated
                    continuedContent += parsed.content;
                    setStreamingContent(continuedContent);
                  } else if (parsed.type === 'done') {
                    // Stream completed
                    console.log('Stream completed:', parsed.streamId);
                  } else if (parsed.type === 'abort') {
                    // Stream was aborted
                    console.log('Continuation stream aborted:', parsed.streamId);
                  }
                } catch (e) {
                  // Handle plain text for OpenRouter
                  if (!line.includes('[DONE]')) {
                    continuedContent += data;
                    setStreamingContent(continuedContent);
                  }
                }
              }
            }
          }
        }
      } catch (streamError: any) {
        if (streamError?.name === 'AbortError') {
          console.log('Continuation stopped by user');
          // The update will be handled below in the finally block
        } else {
          throw streamError;
        }
      }
      
      // Update the message with continued content
      if (continuedContent.trim() || abortControllerRef.current?.signal.aborted) {
        const fullContent = streamData.partialContent + continuedContent;
        
        // Update message in database with the complete content
        await updateMessage({
          messageId: messageId as Id<"messages">,
          content: fullContent,
        });
        
        // Update or remove from stopped streams based on completion
        if (!abortControllerRef.current?.signal.aborted) {
          // Completed successfully - remove from stopped streams
          setStoppedStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(messageId);
            return newMap;
          });
        } else {
          // Stopped again - update stream data for next continuation
          const updatedStreamData: StreamData = {
            ...streamData,
            partialContent: fullContent,
            stopPosition: fullContent.length,
            canResume: true,
            savedToDb: true
          };
          setStoppedStreams(prev => {
            const newMap = new Map(prev);
            newMap.set(messageId, updatedStreamData);
            return newMap;
          });
        }
      }
      
    } catch (error) {
      console.error('Failed to continue generation:', error);
      setError('Failed to continue generation. Please try again.');
    } finally {
      setIsLoading(false);
      setContinuingMessageId(null);
      setStreamingContent('');
      abortControllerRef.current = null;
      currentMessageIdRef.current = null;
      isAbortingRef.current = false; // Reset abort flag
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    console.log('[SUBMIT] Starting new message submission');
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    setError(null);
    setIsUserScrolling(false); // Reset scroll when sending new message
    setShowScrollButton(false);
    isStreamSavedRef.current = false; // Reset save flag
    console.log('[SUBMIT] Reset isStreamSavedRef.current to false');

    // Add user message to database
    await sendMessage({
      chatId: chatId as Id<"chats">,
      content: userMessage,
      role: "user",
    });

    // Prepare messages for API
    const contextMessages = messages?.map(msg => ({
      role: msg.role,
      content: msg.content,
    })) || [];
    
    const allMessages = [
      ...contextMessages,
      { role: "user", content: userMessage }
    ];
    
    // Store messages for potential continuation
    currentStreamMessages.current = allMessages;

    // Create unique stream ID
    const streamId = crypto.randomUUID();
    currentStreamIdRef.current = streamId;

    // Create abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const needsToken = !selectedModel.startsWith("openai/") && !selectedModel.startsWith("anthropic/");
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: allMessages,
          model: selectedModel,
          token: needsToken ? token : undefined,
          streamId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let wasStoppedEarly = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data && !data.includes('[DONE]')) {
                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.type === 'delta') {
                    accumulatedContent += parsed.content;
                    setStreamingContent(accumulatedContent);
                    // Log every 10th chunk to avoid spam
                    if (accumulatedContent.length % 100 < parsed.content.length) {
                      console.log('[SUBMIT] Accumulated content length:', accumulatedContent.length);
                    }
                  } else if (parsed.type === 'done') {
                    console.log('[SUBMIT] Stream completed normally:', parsed.streamId);
                  } else if (parsed.type === 'abort') {
                    console.log('[SUBMIT] Stream aborted by server:', parsed.streamId);
                    wasStoppedEarly = true;
                  }
                } catch (e) {
                  // Handle plain text response for OpenRouter
                  accumulatedContent += data;
                  setStreamingContent(accumulatedContent);
                }
              }
            } else if (line && !line.startsWith('data:')) {
              // Plain text chunk
              accumulatedContent += chunk;
              setStreamingContent(accumulatedContent);
              break; // Exit the loop for plain text
            }
          }
        }
      } catch (streamError: any) {
        if (streamError?.name === 'AbortError') {
          console.log('[SUBMIT] Stream caught AbortError');
          console.log('[SUBMIT] isAbortingRef.current:', isAbortingRef.current);
          console.log('[SUBMIT] accumulatedContent length:', accumulatedContent.length);
          wasStoppedEarly = true;
        } else {
          throw streamError;
        }
      }

      console.log('[SUBMIT] After stream - checking if should save');
      console.log('[SUBMIT] accumulatedContent.trim() length:', accumulatedContent.trim().length);
      console.log('[SUBMIT] isStreamSavedRef.current:', isStreamSavedRef.current);
      console.log('[SUBMIT] wasStoppedEarly:', wasStoppedEarly);

      // Save assistant message if not already saved
      if (accumulatedContent.trim() && !isStreamSavedRef.current) {
        console.log('[SUBMIT] Saving message with content length:', accumulatedContent.length);
        const assistantMessageId = await sendMessage({
          chatId: chatId as Id<"chats">,
          content: accumulatedContent,
          role: "assistant",
        });
        
        console.log('[SUBMIT] Message saved successfully with ID:', assistantMessageId);
        isStreamSavedRef.current = true;
        currentMessageIdRef.current = assistantMessageId;
        
        // Clear streaming content immediately after saving to prevent duplicate display
        console.log('[SUBMIT] Clearing streamingContent after save to prevent duplicate display');
        setStreamingContent("");

        // Store for resumption if stopped early
        if (wasStoppedEarly) {
          const streamData: StreamData = {
            streamId,
            partialContent: accumulatedContent,
            stopPosition: accumulatedContent.length,
            model: selectedModel,
            messages: allMessages,
            canResume: true,
            messageId: assistantMessageId,
            savedToDb: true
          };
          setStoppedStreams(prev => new Map(prev).set(assistantMessageId, streamData));
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      if (error?.name !== 'AbortError') {
        setError(error.message || "Failed to send message. Please try again.");
      }
    } finally {
      console.log('[SUBMIT] Finally block - cleaning up');
      console.log('[SUBMIT] Resetting flags');
      setIsLoading(false);
      // Clear streaming content if it hasn't been cleared yet
      setStreamingContent(prev => {
        if (prev) {
          console.log('[SUBMIT] Clearing remaining streamingContent in finally');
        }
        return "";
      });
      abortControllerRef.current = null;
      currentStreamIdRef.current = null;
      currentMessageIdRef.current = null;
      isStreamSavedRef.current = false;
      isAbortingRef.current = false; // Reset abort flag
      console.log('[SUBMIT] Cleanup complete');
    }
  };

  const getDisplayContent = (message: any) => {
    // If this message is being continued, combine DB content with streaming content
    if (continuingMessageId === message._id && streamingContent) {
      return message.content + streamingContent;
    }
    // Otherwise just return the DB content
    return message.content;
  };

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const needsOpenRouter = selectedModel && !selectedModel.startsWith("openai/") && !selectedModel.startsWith("anthropic/");
  const canSendMessage = !needsOpenRouter || isConnected;

  return (
    <div className="flex flex-col h-screen lg:h-[calc(100vh-4rem)]">
      {/* Messages area with proper padding for fixed input */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-48"
      >
        {messages?.map((message) => (
          <motion.div
            key={message._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-2",
                message.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : "bg-muted"
              )}
            >
              <MessageContent content={getDisplayContent(message)} />
              
              {/* Show continue button for stopped messages */}
              {message.role === "assistant" && 
               stoppedStreams.has(message._id) && 
               stoppedStreams.get(message._id)?.canResume &&
               !isLoading && 
               continuingMessageId !== message._id && (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => continueGeneration(message._id)}
                    className="flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Continue
                  </Button>
                </div>
              )}
              
              {/* Show loading indicator when continuing this message */}
              {continuingMessageId === message._id && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {streamingContent ? 'Continuing generation...' : 'Starting continuation...'}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        
        
        {/* Regular streaming for new messages */}
        {streamingContent && !continuingMessageId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-start"
          >
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
              <MessageContent content={streamingContent} />
            </div>
          </motion.div>
        )}
        
        {error && (
          <div className="flex justify-center">
            <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 max-w-[80%]">
              {error}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        {/* Add extra space at the bottom for better UX */}
        <div className="h-24" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToBottom}
          className="fixed bottom-24 right-4 lg:right-8 z-20 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-5 w-5" />
        </motion.button>
      )}

      {/* Input area - fixed to bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-background border-t p-4 space-y-2 z-10">
        {needsOpenRouter && !isConnected && (
          <div className="mb-2">
            <OpenRouterConnect />
          </div>
        )}
        
        <div className="flex gap-2">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onModelChange={setSelectedModel}
            selectedModel={selectedModel}
            isLoading={isLoading}
            isConnected={canSendMessage}
            onStop={stopGeneration}
          />
        </div>
      </div>
    </div>
  );
}