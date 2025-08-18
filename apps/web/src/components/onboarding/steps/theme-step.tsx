import { OnboardingData } from "../onboarding"
import { cn } from "@/lib/utils"

interface ThemeStepProps {
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

const themes = [
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep purples and blues",
    gradient: "from-purple-600 to-blue-600",
    colors: ["#9333EA", "#3B82F6", "#1E293B", "#6366F1"]
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Northern lights inspired",
    gradient: "from-green-500 via-purple-500 to-pink-500",
    colors: ["#10B981", "#A855F7", "#EC4899", "#3B82F6"]
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm oranges and pinks",
    gradient: "from-orange-500 to-pink-500",
    colors: ["#F97316", "#EC4899", "#F43F5E", "#FBBF24"]
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep sea blues",
    gradient: "from-cyan-500 to-blue-700",
    colors: ["#06B6D4", "#0EA5E9", "#1E40AF", "#0891B2"]
  },
  {
    id: "forest",
    name: "Forest",
    description: "Natural greens",
    gradient: "from-green-600 to-emerald-700",
    colors: ["#16A34A", "#059669", "#047857", "#15803D"]
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Classic black and white",
    gradient: "from-gray-700 to-gray-900",
    colors: ["#374151", "#1F2937", "#111827", "#6B7280"]
  }
]

export function ThemeStep({ data, updateData }: ThemeStepProps) {
  return (
    <div className="h-full">
      <div className="mb-6">
        <h3 className="mb-2 text-2xl font-semibold text-foreground">Choose Your Theme</h3>
        <p className="text-muted-foreground">Select a color scheme that matches your style</p>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => updateData({ theme: theme.id })}
            className={cn(
              "group relative overflow-hidden rounded-2xl border-2 p-6 text-left transition-all hover:scale-[1.02]",
              data.theme === theme.id
                ? "border-primary bg-primary/10 shadow-xl"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className={cn(
              "mb-4 h-32 rounded-xl bg-gradient-to-br",
              theme.gradient
            )} />
            
            <h4 className="mb-1 text-lg font-semibold text-foreground">{theme.name}</h4>
            <p className="mb-3 text-sm text-muted-foreground">{theme.description}</p>
            
            <div className="flex gap-2">
              {theme.colors.map((color, i) => (
                <div
                  key={i}
                  className="h-6 w-6 rounded-md border border-border/50"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            
            {data.theme === theme.id && (
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
            
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
      
      <div className="mt-6 rounded-xl border border-border/50 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Note:</span> Themes are purely visual and won't affect functionality. You can change your theme anytime from settings.
        </p>
      </div>
    </div>
  )
}