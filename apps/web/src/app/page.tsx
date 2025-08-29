export default function HomePage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background">
      <div className="text-center space-y-8 px-4 max-w-3xl">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Welcome to OpenChat
          </h1>
          <p className="text-xl text-muted-foreground">
            Your AI-powered conversation companion
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-lg mb-2 text-card-foreground">Real-time Chat</h3>
            <p className="text-sm text-muted-foreground">
              Instant messaging with AI responses
            </p>
          </div>
          
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-lg mb-2 text-card-foreground">Lightning Fast</h3>
            <p className="text-sm text-muted-foreground">
              Powered by Convex for instant updates
            </p>
          </div>
          
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-lg mb-2 text-card-foreground">Secure</h3>
            <p className="text-sm text-muted-foreground">
              Your conversations are private and secure
            </p>
          </div>
          
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-lg mb-2 text-card-foreground">AI Powered</h3>
            <p className="text-sm text-muted-foreground">
              Smart responses powered by AI
            </p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-muted-foreground">
            Click "New Chat" in the sidebar to start a conversation
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            Backend Connected
          </p>
        </div>
      </div>
    </div>
  );
}
