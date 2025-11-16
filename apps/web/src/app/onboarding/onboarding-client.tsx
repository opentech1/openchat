"use client";

import { useState, useEffect } from "react";
import { Github, ArrowLeft, LoaderIcon, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import { NiceLoader } from "@/components/ui/nice-loader";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { spacing, iconSize } from "@/styles/design-tokens";

const TONE_OPTIONS = [
	{ value: "casual", label: "Casual / Friendly", description: "Conversational and relaxed" },
	{ value: "professional", label: "Professional / Formal", description: "Business-like and polished" },
	{ value: "concise", label: "Concise / Direct", description: "Short and to-the-point" },
	{ value: "detailed", label: "Detailed / Thorough", description: "Comprehensive explanations" },
];

export default function OnboardingPage() {
	const router = useRouter();
	const { data: session, isPending: isSessionLoading } = authClient.useSession();
	const { hasKey, saveKey, isLoading: isKeyLoading } = useOpenRouterKey();
	const completeOnboarding = useMutation(api.users.completeOnboarding);

	// Get Convex user ID from Better Auth session
	const convexUser = useQuery(
		api.users.getByExternalId,
		session?.user?.id ? { externalId: session.user.id } : "skip"
	);
	const userId = convexUser?._id;
	const user = convexUser;

	const [currentStep, setCurrentStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [isRedirecting, setIsRedirecting] = useState(false);

	// Step 2: API Key
	const [apiKey, setApiKey] = useState("");
	const [savingApiKey, setSavingApiKey] = useState(false);

	// Step 3: Preferences
	const [displayName, setDisplayName] = useState("");
	const [preferredTone, setPreferredTone] = useState("casual");
	const [customInstructions, setCustomInstructions] = useState("");

	// Check if we're waiting for user data to load
	const isUserLoading = session?.user?.id && !user;

	// Redirect to dashboard if onboarding is already completed
	useEffect(() => {
		if (user?.onboardingCompletedAt) {
			setIsRedirecting(true);
			router.push("/dashboard");
		}
	}, [user, router]);

	// Initialize to the correct step once all data is loaded
	useEffect(() => {
		if (!isSessionLoading && !isUserLoading && !isKeyLoading && session?.user && currentStep === 1) {
			// Pre-fill display name with account name
			if (session.user.name) {
				setDisplayName(session.user.name);
			}

			// Determine starting step based on what they've completed
			if (hasKey) {
				setCurrentStep(3); // Has key, go to preferences
			} else {
				setCurrentStep(2); // No key, go to API key step
			}
		}
	}, [session, isSessionLoading, isUserLoading, isKeyLoading, hasKey, currentStep]);

	const handleGitHubSignIn = async () => {
		setError("");
		setLoading(true);
		try {
			await authClient.signIn.social({
				provider: "github",
				callbackURL: "/onboarding",
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sign in with GitHub");
			setLoading(false);
		}
	};

	const handleApiKeySubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!apiKey.trim() || savingApiKey) return;

		setSavingApiKey(true);
		setError("");

		try {
			await saveKey(apiKey.trim());
			toast.success("API key saved successfully");
			setCurrentStep(3);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save API key");
			toast.error("Failed to save API key");
		} finally {
			setSavingApiKey(false);
		}
	};

	const handlePreferencesSubmit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!userId) {
			toast.error("User not found");
			return;
		}

		setLoading(true);
		setError("");

		try {
			await completeOnboarding({
				userId,
				displayName: displayName.trim() || undefined,
				preferredTone,
				customInstructions: customInstructions.trim() || undefined,
			});

			toast.success("Welcome to OpenChat!");
			router.push("/dashboard");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to complete onboarding");
			toast.error("Failed to complete onboarding");
			setLoading(false);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1);
			setError("");
		}
	};

	const renderStep = () => {
		switch (currentStep) {
			case 1:
				return (
					<div className="w-full space-y-6">
						<div className="space-y-1 text-center">
							<h1 className="text-2xl font-semibold tracking-tight">Welcome to OpenChat</h1>
							<p className="text-muted-foreground text-sm">
								Sign in to get started
							</p>
						</div>

						<div className="space-y-3">
							{error && (
								<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
									{error}
								</div>
							)}

							<button
								onClick={handleGitHubSignIn}
								disabled={loading}
								className="relative inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Github className="size-4" />
								{loading ? "Signing in..." : "Continue with GitHub"}
							</button>
						</div>

						<p className="text-center text-xs text-muted-foreground">
							By continuing, you agree to our Terms of Service and Privacy Policy
						</p>
					</div>
				);

			case 2:
				return (
					<div className="w-full space-y-6">
						<div className="space-y-1 text-center">
							<h1 className="text-2xl font-semibold tracking-tight">Add your OpenRouter API key</h1>
							<p className="text-muted-foreground text-sm">
								Connect your OpenRouter account to start chatting
							</p>
						</div>

						<form onSubmit={handleApiKeySubmit} className="space-y-5">
							{error && (
								<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
									{error}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="api-key" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									OpenRouter API Key
								</Label>
								<Input
									id="api-key"
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
									type="password"
									placeholder="sk-or-v1..."
									autoFocus
									required
									className="font-mono h-11"
								/>
								<p className="text-muted-foreground text-xs">
									Create a key under{" "}
									<a
										href="https://openrouter.ai/keys"
										className={cn("text-primary inline-flex items-center underline-offset-4 hover:underline", spacing.gap.xs)}
										target="_blank"
										rel="noreferrer"
									>
										OpenRouter → Keys
										<ExternalLink className={iconSize.xs} />
									</a>
								</p>
							</div>

							<Button
								type="submit"
								disabled={savingApiKey || apiKey.trim().length < 10}
								className="w-full h-11"
							>
								{savingApiKey ? (
									<LoaderIcon className="size-4 animate-spin" />
								) : (
									"Continue"
								)}
							</Button>

							<p className="text-muted-foreground text-xs text-center">
								Your key is encrypted in your browser using AES-256 encryption, then stored in your account database and synced across devices. Once stored, keys cannot be viewed - only updated or removed.
							</p>
						</form>
					</div>
				);

			case 3:
				return (
					<div className="w-full space-y-6">
						<div className="space-y-1 text-center">
							<h1 className="text-2xl font-semibold tracking-tight">Personalize your experience</h1>
							<p className="text-muted-foreground text-sm">
								Help us tailor the AI to your preferences
							</p>
						</div>

						<form onSubmit={handlePreferencesSubmit} className="space-y-4">
							{error && (
								<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
									{error}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="display-name">What should the AI call you?</Label>
								<Input
									id="display-name"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									placeholder="Your name"
									autoFocus
								/>
							</div>

							<div className="space-y-2">
								<Label>Preferred tone</Label>
								<div className="grid gap-2">
									{TONE_OPTIONS.map((tone) => (
										<label
											key={tone.value}
											className={cn(
												"flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition hover:bg-accent",
												preferredTone === tone.value && "border-primary bg-primary/5"
											)}
										>
											<input
												type="radio"
												name="tone"
												value={tone.value}
												checked={preferredTone === tone.value}
												onChange={(e) => setPreferredTone(e.target.value)}
												className="mt-1"
											/>
											<div className="flex-1">
												<div className="font-medium text-sm">{tone.label}</div>
												<div className="text-muted-foreground text-xs">{tone.description}</div>
											</div>
										</label>
									))}
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="custom-instructions">
									Custom instructions (optional)
								</Label>
								<textarea
									id="custom-instructions"
									value={customInstructions}
									onChange={(e) => setCustomInstructions(e.target.value)}
									placeholder="Any specific preferences or instructions for the AI..."
									className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								/>
							</div>

							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => handlePreferencesSubmit()}
									disabled={loading}
									className="flex-1"
								>
									Skip for now
								</Button>
								<Button
									type="submit"
									disabled={loading}
									className="flex-1"
								>
									{loading ? (
										<LoaderIcon className="size-4 animate-spin" />
									) : (
										"Complete setup"
									)}
								</Button>
							</div>
						</form>
					</div>
				);

			default:
				return null;
		}
	};

	// Show nice loading spinner while checking user status
	if (isSessionLoading || isUserLoading || isKeyLoading || isRedirecting) {
		return <NiceLoader message="Loading onboarding..." size="md" fullScreen />;
	}

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col p-6 md:p-10">
				<div className="flex items-center justify-center py-6">
					<Stepper steps={3} currentStep={currentStep} />
				</div>

				<div className="flex flex-1 items-center justify-center px-4">
					<div className="w-full max-w-xl">
						{currentStep > (session?.user ? 2 : 1) && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleBack}
								className="mb-6 gap-2"
							>
								<ArrowLeft className="size-4" />
								Back
							</Button>
						)}
						{renderStep()}
					</div>
				</div>
			</div>
			<div className="bg-muted relative hidden lg:block">
				<Image
					src="/placeholder.svg"
					alt="OpenChat"
					fill
					className="object-cover dark:brightness-[0.2] dark:grayscale"
					loading="lazy"
					priority={false}
				/>
			</div>
		</div>
	);
}
