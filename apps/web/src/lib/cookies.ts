"use client"

const ONBOARDING_KEY = "onboarding_completed"
const ONBOARDING_DATA_KEY = "onboarding_data"

export interface OnboardingData {
  userName: string
  theme: string
  workspaceLayout: string
}

const VALID_THEMES = ["purple", "blue", "green", "red", "orange", "pink"] as const

export function isValidTheme(theme: string): theme is typeof VALID_THEMES[number] {
  return VALID_THEMES.includes(theme as any)
}

export function setOnboardingStatus(completed: boolean) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(completed))
  }
}

export function getOnboardingStatus(): boolean {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(ONBOARDING_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return false
      }
    }
  }
  return false
}

export function setOnboardingData(data: Partial<OnboardingData>) {
  if (typeof window !== "undefined") {
    const existing = getOnboardingData()
    const updated = { ...existing, ...data }
    localStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(updated))
  }
}

export function getOnboardingData(): OnboardingData {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(ONBOARDING_DATA_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return { userName: "", theme: "", workspaceLayout: "" }
      }
    }
  }
  return { userName: "", theme: "", workspaceLayout: "" }
}

export function clearOnboardingStatus() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ONBOARDING_KEY)
    localStorage.removeItem(ONBOARDING_DATA_KEY)
  }
}