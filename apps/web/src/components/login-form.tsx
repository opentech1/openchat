"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";

export function LoginForm({ className, ...props }: React.ComponentProps<"form">) {
  const router = useRouter();
  const OTP_ENABLED = false;
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ALLOWED = new Set([
    "gmail.com",
    "outlook.com",
    "yahoo.com",
    "icloud.com",
    "hotmail.com",
    "live.com",
    "proton.me",
  ]);
  const ALIASES: Record<string, string> = {
    "googlemail.com": "gmail.com",
    "protonmail.com": "proton.me",
    "ymail.com": "yahoo.com",
    "me.com": "icloud.com",
    "mac.com": "icloud.com",
  };
  const normalizeDomain = (d: string) => ALIASES[d.toLowerCase()] ?? d.toLowerCase();
  const domainOf = (addr: string) => {
    const at = addr.lastIndexOf("@");
    if (at === -1) return "";
    return addr.slice(at + 1);
  };
  const isAllowedEmail = (addr: string) => {
    const dom = normalizeDomain(domainOf(addr));
    return !!dom && ALLOWED.has(dom);
  };

  const onSend = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      if (!isAllowedEmail(email)) {
        throw new Error("Please use Gmail, Outlook, Yahoo, iCloud, Hotmail, Live, or Proton.");
      }
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
        fetchOptions: { credentials: "include", cache: "no-store" },
      });
      if (error) throw error;
      setStep("verify");
      toast.success("Code sent. Check your email.");
    } catch (e: any) {
      setError(e?.message || "Failed to send code");
      toast.error(e?.message || "Failed to send code");
    } finally {
      setPending(false);
    }
  }, [email]);

  const onVerify = useCallback(async (override?: { email?: string; otp?: string }) => {
    setPending(true);
    setError(null);
    try {
      const e = override?.email ?? email;
      const code = override?.otp ?? otp;
      // debug
      if (process.env.NODE_ENV === "test") {
        // eslint-disable-next-line no-console
        console.log("onVerify-called", e, code);
      }
      if (!isAllowedEmail(e)) {
        throw new Error("Unsupported email provider");
      }
      const { error } = await authClient.signIn.emailOtp({
        email: e,
        otp: code,
        fetchOptions: { credentials: "include", cache: "no-store" },
      });
      if (error) throw error;
      // Ensure session cookie is persisted and readable
      try {
        await authClient.$fetch("/get-session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        // give the browser a moment to persist cookies across ports
        await new Promise((r) => setTimeout(r, 50));
      }
      toast.success("Signed in successfully");
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Invalid code");
      toast.error(e?.message || "Invalid code");
    } finally {
      setPending(false);
    }
  }, [email, otp, router]);

  const onGithub = useCallback(async () => {
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3001";
      const callbackURL = `${origin.replace(/\/$/, "")}/dashboard`;
      await authClient.signIn.social({ provider: "github", callbackURL });
    } catch (e) {
      // no-op: better-auth will redirect
    }
  }, []);

  // Auto-fill from query params and auto-verify if both are present
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qEmail = sp.get("email") || "";
    const qOtp = sp.get("otp") || "";
    if (qEmail && !email) setEmail(qEmail);
    if (qOtp) {
      setStep("verify");
      setOtp(qOtp);
      // trigger verify after state settles
      setTimeout(() => {
        if (qEmail && qOtp) onVerify({ email: qEmail, otp: qOtp });
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!OTP_ENABLED) {
    return (
      <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Sign in to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">Use GitHub to continue</p>
        </div>
        <div className="grid gap-6">
          <Button variant="outline" className="w-full" type="button" onClick={onGithub}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
            Continue with GitHub
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Sign in to your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your email to receive a one-time code
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {email && !isAllowedEmail(email) && (
            <p className="text-destructive text-xs">Only Gmail, Outlook, Yahoo, iCloud, Hotmail, Live, or Proton are supported.</p>
          )}
        </div>
        {step === "verify" && (
          <div className="grid gap-3">
            <Label htmlFor="otp">One-time code</Label>
            <InputOTP
              id="otp"
              maxLength={6}
              value={otp}
              onChange={(v) => setOtp(v.replace(/\D/g, ""))}
              aria-label="One-time code"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        )}
        {error && (
          <p className="text-destructive text-sm" role="alert">{error}</p>
        )}
        {step === "request" ? (
          <Button type="button" className="w-full" onClick={onSend} disabled={pending || !email}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        ) : (
          <Button type="button" className="w-full" onClick={onVerify} disabled={pending || !otp} aria-busy={pending}>
            {pending ? "Verifying…" : "Verify & Sign in"}
          </Button>
        )}
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Or continue with
          </span>
        </div>
        <Button variant="outline" className="w-full" type="button" onClick={onGithub}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              fill="currentColor"
            />
          </svg>
          Continue with GitHub
        </Button>
      </div>
    </form>
  );
}
