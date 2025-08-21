"use client";

import { useState } from 'react';
import { useChats, useMessages } from '@/hooks/use-local-database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Trash2, Send } from 'lucide-react';

interface LocalChatExampleProps {
  userId: string;
}

export function LocalChatExample({ userId }: LocalChatExampleProps) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const {
    chats,
    isLoading: chatsLoading,
    error: chatsError,
    createChat,
    deleteChat
  } = useChats(userId);

  const {
    messages,
    isLoading: messagesLoading,
    error: messagesError,
    addMessage,
    deleteMessage
  } = useMessages(selectedChatId || undefined);

  const handleCreateChat = async () => {
    if (!newChatTitle.trim()) return;

    try {
      const chat = await createChat(newChatTitle.trim());
      setSelectedChatId(chat.id);
      setNewChatTitle('');
      setIsCreatingChat(false);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId) return;

    try {
      await addMessage(newMessage.trim(), 'user');
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Chat List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chats
          </CardTitle>
          <CardDescription>
            Your local conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create New Chat */}
          {isCreatingChat ? (
            <div className="space-y-2">
              <Input
                placeholder="Chat title..."
                value={newChatTitle}
                onChange={(e) => setNewChatTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateChat();
                  } else if (e.key === 'Escape') {
                    setIsCreatingChat(false);
                    setNewChatTitle('');
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateChat}>
                  Create
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreatingChat(false);
                    setNewChatTitle('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setIsCreatingChat(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          )}

          {/* Chat List */}
          {chatsLoading ? (
            <div className="text-center text-muted-foreground">
              Loading chats...
            </div>
          ) : chatsError ? (
            <div className="text-center text-destructive">
              Error: {chatsError}
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No chats yet. Create your first chat!
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedChatId === chat.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedChatId(chat.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{chat.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(chat.createdAt * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            {selectedChatId 
              ? chats.find(c => c.id === selectedChatId)?.title || 'Chat'
              : 'Select a chat'
            }
          </CardTitle>
          <CardDescription>
            {selectedChatId 
              ? 'Local-first chat with cloud sync'
              : 'Choose a chat from the sidebar to start messaging'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col h-full">
          {!selectedChatId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a chat to view messages
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-96 mb-4">
                {messagesLoading ? (
                  <div className="text-center text-muted-foreground">
                    Loading messages...
                  </div>
                ) : messagesError ? (
                  <div className="text-center text-destructive">
                    Error: {messagesError}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground">
                    No messages yet. Send your first message!
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <Badge 
                              variant={message.role === 'user' ? 'secondary' : 'outline'}
                              className="text-xs mb-2"
                            >
                              {message.role}
                            </Badge>
                            <p className="text-sm whitespace-pre-wrap">
                              {message.content}
                            </p>
                            <p className="text-xs opacity-70 mt-1">
                              {new Date(message.createdAt * 1000).toLocaleTimeString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteMessage(message.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 min-h-[60px] resize-none"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}