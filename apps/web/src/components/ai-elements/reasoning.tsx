'use client';

import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDown, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

const Reasoning = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root> & {
    isStreaming?: boolean;
  }
>(({ className, isStreaming = false, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    } else if (isOpen && !isStreaming) {
      const timer = setTimeout(() => setIsOpen(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isOpen]);

  return (
    <CollapsiblePrimitive.Root
      ref={ref}
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        'w-full rounded-lg border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    />
  );
});
Reasoning.displayName = 'Reasoning';

const ReasoningTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> & {
    title?: string;
  }
>(({ className, title = 'Thinking...', children, ...props }, ref) => {
  const [isStreaming, setIsStreaming] = React.useState(false);

  return (
    <CollapsiblePrimitive.Trigger
      ref={ref}
      className={cn(
        'flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Brain className={cn(
          'h-4 w-4',
          isStreaming && 'animate-pulse text-primary'
        )} />
        <span>{title}</span>
        {isStreaming && (
          <span className="ml-2 flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
          </span>
        )}
      </div>
      <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
      {children}
    </CollapsiblePrimitive.Trigger>
  );
});
ReasoningTrigger.displayName = 'ReasoningTrigger';

const ReasoningContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => {
  return (
    <CollapsiblePrimitive.Content
      ref={ref}
      className={cn(
        'overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
        className
      )}
      {...props}
    >
      <div className="border-t px-4 py-3">
        <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
          {children}
        </div>
      </div>
    </CollapsiblePrimitive.Content>
  );
});
ReasoningContent.displayName = 'ReasoningContent';

export { Reasoning, ReasoningTrigger, ReasoningContent };