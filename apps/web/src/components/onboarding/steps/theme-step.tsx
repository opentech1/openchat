import { OnboardingData } from "../onboarding"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "@/components/theme-provider-simple"

interface ThemeStepProps {
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

const themes = [
  {
    id: "purple",
    name: "Purple",
    description: "Royal purple vibes",
    primaryColor: "#9333EA"
  },
  {
    id: "blue",
    name: "Blue",
    description: "Ocean blue calm",
    primaryColor: "#3B82F6"
  },
  {
    id: "green",
    name: "Green",
    description: "Natural emerald",
    primaryColor: "#10B981"
  },
  {
    id: "red",
    name: "Red",
    description: "Bold crimson", 
    primaryColor: "#EF4444"
  },
  {
    id: "orange",
    name: "Orange",
    description: "Warm sunset",
    primaryColor: "#F97316"
  },
  {
    id: "pink",
    name: "Pink",
    description: "Sweet fuchsia",
    primaryColor: "#EC4899"
  }
]

export function ThemeStep({ data, updateData }: ThemeStepProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme: currentTheme, setTheme } = useTheme()
  

  useEffect(() => {
    // Set first theme as default if none selected
    if (!data.theme) {
      const defaultTheme = themes[0].id
      updateData({ theme: defaultTheme })
      // Also apply the theme immediately
      setTheme(defaultTheme as any)
    }
  }, [])

  const handleThemeSelect = (themeId: string) => {
    updateData({ theme: themeId })
    // Apply theme immediately for preview
    const validThemes = ["purple", "blue", "green", "red", "orange", "pink"]
    if (validThemes.includes(themeId)) {
      setTheme(themeId as any)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we're on this step
      if (!containerRef.current) return
      
      const currentIndex = themes.findIndex(t => t.id === data.theme)
      
      switch(e.key) {
        case 'Tab':
          e.preventDefault()
          const nextIndex = e.shiftKey 
            ? (currentIndex - 1 + themes.length) % themes.length
            : (currentIndex + 1) % themes.length
          handleThemeSelect(themes[nextIndex].id)
          break
        
        case 'ArrowRight':
          e.preventDefault()
          const rightIndex = (currentIndex + 1) % themes.length
          handleThemeSelect(themes[rightIndex].id)
          break
          
        case 'ArrowLeft':
          e.preventDefault()
          const leftIndex = (currentIndex - 1 + themes.length) % themes.length
          handleThemeSelect(themes[leftIndex].id)
          break
          
        case 'ArrowDown':
          e.preventDefault()
          // Move down by 3 columns (grid is 3 columns wide on desktop)
          const downIndex = Math.min(currentIndex + 3, themes.length - 1)
          handleThemeSelect(themes[downIndex].id)
          break
          
        case 'ArrowUp':
          e.preventDefault()
          // Move up by 3 columns
          const upIndex = Math.max(currentIndex - 3, 0)
          handleThemeSelect(themes[upIndex].id)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [data.theme, updateData])

  return (
    <div className="w-full space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-foreground sm:text-2xl">Choose Your Theme</h3>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Select a color scheme that matches your style</p>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
            Tab / Arrow Keys to switch themes
          </span>
        </p>
      </div>
      
      <div ref={containerRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {themes.map((theme, index) => (
          <button
            key={theme.id}
            onClick={() => handleThemeSelect(theme.id)}
            tabIndex={-1}
            className={cn(
              "group relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] focus:outline-none",
              data.theme === theme.id
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/50"
            )}
          >
            <div 
              className="mb-3 h-20 rounded-lg sm:h-24 flex items-center justify-center bg-card border border-border"
            >
              <div 
                className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
                style={{ backgroundColor: theme.primaryColor }}
              />
            </div>
            
            <h4 className="text-sm font-semibold text-foreground sm:text-base">{theme.name}</h4>
            <p className="text-xs text-muted-foreground">{theme.description}</p>
            
            {data.theme === theme.id && (
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
          <span className="font-medium">Tip:</span> You can change your theme anytime from settings
        </p>
      </div>
    </div>
  )
}