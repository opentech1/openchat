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
    <div className="flex h-full gap-8">
      <div className="flex-1">
        <div className="mb-6">
          <h3 className="mb-2 text-2xl font-semibold text-foreground">Workspace Layout</h3>
          <p className="text-muted-foreground">Choose how you want to organize your workspace</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => updateData({ workspaceLayout: layout.id })}
              className={cn(
                "relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02]",
                data.workspaceLayout === layout.id
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="mb-3 h-32 overflow-hidden rounded-lg border border-border/50 bg-background/50">
                {layout.preview}
              </div>
              
              <h4 className="mb-1 font-semibold text-foreground">{layout.name}</h4>
              <p className="text-xs text-muted-foreground">{layout.description}</p>
              
              {data.workspaceLayout === layout.id && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
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
      </div>
      
      <div className="w-px bg-border/50" />
      
      <div className="w-80">
        <div className="mb-6">
          <h3 className="mb-2 text-2xl font-semibold text-foreground">AI Assistant</h3>
          <p className="text-muted-foreground">Configure your AI preferences</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              AI Model
            </label>
            <select
              value={data.aiModel}
              onChange={(e) => updateData({ aiModel: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="gpt-4">GPT-4 (Most capable)</option>
              <option value="gpt-3.5">GPT-3.5 (Faster)</option>
              <option value="claude">Claude (Analytical)</option>
              <option value="custom">Custom Model</option>
            </select>
          </div>
          
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Response Style</label>
            {["Concise", "Detailed", "Creative"].map((style) => (
              <label key={style} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="style"
                  className="h-4 w-4 border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground">{style}</span>
              </label>
            ))}
          </div>
          
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-chart-2/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-medium text-foreground">AI Features</span>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Smart completions</li>
              <li>• Context awareness</li>
              <li>• Multi-language support</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}