"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"
import { getOnboardingData, setOnboardingData } from "@/lib/cookies"

type Theme = "purple" | "blue" | "green" | "red" | "orange" | "pink"

interface ThemeProviderProps {
  children: React.ReactNode
}

const ThemeContext = React.createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: "purple",
  setTheme: () => {}
})

export function useTheme() {
  return React.useContext(ThemeContext)
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)
  
  // Load initial theme from cookies
  const getInitialTheme = (): Theme => {
    if (typeof window === "undefined") return "purple"
    const savedData = getOnboardingData()
    const validThemes = ["purple", "blue", "green", "red", "orange", "pink"]
    if (savedData.theme && validThemes.includes(savedData.theme)) {
      return savedData.theme as Theme
    }
    return "purple"
  }

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme={getInitialTheme()}
      enableSystem={false}
      disableTransitionOnChange
      themes={["purple", "blue", "green", "red", "orange", "pink"]}
    >
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </NextThemesProvider>
  )
}

function ThemeProviderInner({ children }: { children: React.ReactNode }) {
  const { theme: nextTheme, setTheme: setNextTheme } = useNextTheme()
  
  const setTheme = React.useCallback((newTheme: Theme) => {
    setNextTheme(newTheme)
    // Save to cookies
    setOnboardingData({ theme: newTheme })
  }, [setNextTheme])

  return (
    <ThemeContext.Provider value={{ theme: (nextTheme as Theme) || "purple", setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
