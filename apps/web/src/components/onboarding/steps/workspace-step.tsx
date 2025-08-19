import { OnboardingData } from "../onboarding"
import { cn } from "@/lib/utils"

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
        <div className="h-8 rounded bg-muted/50" />
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
        <div className="h-12 rounded bg-muted/50" />
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
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h3 className="mb-3 text-3xl font-bold text-foreground">Choose Your Layout</h3>
          <p className="text-lg text-muted-foreground">How do you want to organize your workspace?</p>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => updateData({ workspaceLayout: layout.id })}
              className={cn(
                "relative overflow-hidden rounded-2xl border-2 p-6 text-left transition-all hover:scale-[1.02]",
                data.workspaceLayout === layout.id
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="mb-4 h-40 overflow-hidden rounded-xl border border-border/50 bg-background/50">
                {layout.preview}
              </div>
              
              <h4 className="mb-2 text-xl font-semibold text-foreground">{layout.name}</h4>
              <p className="text-sm text-muted-foreground">{layout.description}</p>
              
              {data.workspaceLayout === layout.id && (
                <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
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
      </div>
    </div>
  )
}