"use client"

import { useEffect, useState } from "react"
import { clearOnboardingStatus } from "@/lib/cookies"
import { Button } from "@/components/ui/button"

export default function ResetPage() {
  const [cleared, setCleared] = useState(false)

  const handleClear = () => {
    clearOnboardingStatus()
    setCleared(true)
    setTimeout(() => {
      window.location.href = "/"
    }, 1000)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Reset Onboarding</h1>
        {!cleared ? (
          <>
            <p className="text-muted-foreground">
              Click the button below to clear your onboarding data and start fresh.
            </p>
            <Button onClick={handleClear} size="lg">
              Clear Onboarding Data
            </Button>
          </>
        ) : (
          <>
            <p className="text-green-600">Onboarding data cleared!</p>
            <p className="text-muted-foreground">Redirecting to home page...</p>
          </>
        )}
      </div>
    </div>
  )
}
