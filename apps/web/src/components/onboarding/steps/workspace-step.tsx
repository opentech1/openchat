import { OnboardingData } from "../onboarding"
import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"

interface WorkspaceStepProps {
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

const layouts = [
  {
    id: "focused",
    name: "Focused",
    description: "Minimal distractions, maximum productivity",
    preview: (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="h-6 rounded bg-muted/50" />
        <div className="flex-1 rounded bg-muted/30" />
      </div>
    )
  },
  {
    id: "sidebar",
    name: "Sidebar",
    description: "Classic navigation with quick access",
    preview: (
      <div className="flex h-full gap-2 p-2">
        <div className="w-1/4 rounded bg-muted/50" />
        <div className="flex-1 rounded bg-muted/30" />
      </div>
    )
  },
  {
    id: "command",
    name: "Command Center",
    description: "Everything at your fingertips",
    preview: (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="h-8 rounded bg-muted/50" />
        <div className="flex flex-1 gap-2">
          <div className="w-1/5 rounded bg-muted/40" />
          <div className="flex-1 rounded bg-muted/30" />
          <div className="w-1/5 rounded bg-muted/40" />
        </div>
      </div>
    )
  },
  {
    id: "split",
    name: "Split View",
    description: "Multitask with dual panels",
    preview: (
      <div className="flex h-full gap-2 p-2">
        <div className="flex-1 rounded bg-muted/30" />
        <div className="flex-1 rounded bg-muted/30" />
      </div>
    )
  }
]

export function WorkspaceStep({ data, updateData }: WorkspaceStepProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Set first layout as default if none selected
    if (!data.workspaceLayout) {
      updateData({ workspaceLayout: layouts[0].id })
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we're on this step
      if (!containerRef.current) return
      
      const currentIndex = layouts.findIndex(l => l.id === data.workspaceLayout)
      
      switch(e.key) {
        case 'Tab':
          e.preventDefault()
          const nextIndex = e.shiftKey 
            ? (currentIndex - 1 + layouts.length) % layouts.length
            : (currentIndex + 1) % layouts.length
          updateData({ workspaceLayout: layouts[nextIndex].id })
          break
        
        case 'ArrowRight':
          e.preventDefault()
          const rightIndex = (currentIndex + 1) % layouts.length
          updateData({ workspaceLayout: layouts[rightIndex].id })
          break
          
        case 'ArrowLeft':
          e.preventDefault()
          const leftIndex = (currentIndex - 1 + layouts.length) % layouts.length
          updateData({ workspaceLayout: layouts[leftIndex].id })
          break
          
        case 'ArrowDown':
          e.preventDefault()
          // Move down by 2 columns (grid is 2 columns wide)
          const downIndex = Math.min(currentIndex + 2, layouts.length - 1)
          updateData({ workspaceLayout: layouts[downIndex].id })
          break
          
        case 'ArrowUp':
          e.preventDefault()
          // Move up by 2 columns
          const upIndex = Math.max(currentIndex - 2, 0)
          updateData({ workspaceLayout: layouts[upIndex].id })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [data.workspaceLayout, updateData])

  return (
    <div className="w-full space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground sm:text-2xl">Choose Your Layout</h3>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">How do you want to organize your workspace?</p>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
            Tab / Arrow Keys to switch layouts
          </span>
        </p>
      </div>
      
      <div ref={containerRef} className="grid grid-cols-2 gap-3 sm:gap-4">
        {layouts.map((layout, index) => (
          <button
            key={layout.id}
            onClick={() => updateData({ workspaceLayout: layout.id })}
            tabIndex={-1}
            className={cn(
              "relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] focus:outline-none sm:p-4",
              data.workspaceLayout === layout.id
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="mb-3 h-24 overflow-hidden rounded-lg border border-border/50 bg-background/50 sm:h-32">
              {layout.preview}
            </div>
            
            <h4 className="text-sm font-semibold text-foreground sm:text-base">{layout.name}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{layout.description}</p>
            
            {data.workspaceLayout === layout.id && (
              <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
      
      <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Tip:</span> You can switch layouts anytime from your workspace settings
        </p>
      </div>
    </div>
  )
}