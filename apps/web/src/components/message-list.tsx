"use client"

import type { Message } from "./chat-interface"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sparkles, User } from "lucide-react"

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Start a conversation</p>
          <p className="text-sm">Choose a model and send your first message</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
          {message.role === "assistant" && (
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Sparkles className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={`max-w-[70%] rounded-lg px-4 py-2 ${
              message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <p className="text-sm">{message.content}</p>
          </div>
          {message.role === "user" && (
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}
      {isLoading && (
        <div className="flex gap-3 justify-start">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Sparkles className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
