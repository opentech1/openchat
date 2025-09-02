"use client"

import { useState } from "react"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async (content: string, model: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `This is a simulated response from ${model}. In a real implementation, this would connect to the actual AI model API.`,
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="relative flex flex-col h-screen bg-background">
      <div className="flex-1 overflow-hidden pb-32 sm:pb-24">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>
      <div className="fixed bottom-0 left-0 right-0 px-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl bg-background/80 backdrop-blur-sm border-t sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
        <div className="py-4 sm:py-0">
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  )
}
