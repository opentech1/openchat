import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'AI Chat',
};

export default function AIPage() {
  return (
    <div className="h-full w-full p-6">
      <h1 className="text-3xl font-bold mb-4">AI Assistant</h1>
      <p className="text-muted-foreground">Start a conversation with the AI assistant!</p>
    </div>
  );
}