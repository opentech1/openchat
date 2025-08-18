"use client"

const ONBOARDING_KEY = "onboarding_completed"

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

export function clearOnboardingStatus() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ONBOARDING_KEY)
  }
}