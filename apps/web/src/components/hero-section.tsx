'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/nice-loader';

import { HeroHeader } from './header';
import Features from '@/components/features-1';
import { HeroContent } from '@/components/hero/hero-content';
import { AIModelsSection } from '@/components/hero/ai-models-section';
import { RealtimeSection } from '@/components/hero/realtime-section';
import { ComparisonSection } from '@/components/hero/comparison-section';
import { SponsorsSection } from '@/components/hero/sponsors-section';
import { VersionsSection } from '@/components/hero/versions-section';
import { Footer } from '@/components/footer';
import { captureClientEvent } from '@/lib/posthog';
import { borderRadius } from '@/styles/design-tokens';

function screenWidthBucket(width: number) {
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  return 'xl';
}

export default function HeroSection() {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const user = session?.user;
  const visitTrackedRef = useRef(false);
  const redirectCheckedRef = useRef(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Auto-redirect to dashboard if logged in
  useEffect(() => {
    if (redirectCheckedRef.current) return;
    if (isSessionLoading) return;

    // Check session storage to see if user dismissed the redirect notification
    const dismissedRedirect = sessionStorage.getItem('openchat:dismissed-auto-redirect');

    if (user && !dismissedRedirect) {
      redirectCheckedRef.current = true;
      setIsRedirecting(true);

      // Show toast with option to dismiss for session
      const toastId = toast.info('Redirecting to dashboard...', {
        duration: 2000,
        action: {
          label: 'Stay here',
          onClick: () => {
            sessionStorage.setItem('openchat:dismissed-auto-redirect', 'true');
            setIsRedirecting(false);
            toast.dismiss(toastId);
          },
        },
      });

      // Redirect after a short delay for smooth transition
      const timeoutId = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

      return () => clearTimeout(timeoutId);
    } else if (user && dismissedRedirect) {
      redirectCheckedRef.current = true;
    }
  }, [user, isSessionLoading, router]);

  const handleCtaClick = useCallback((ctaId: string, ctaCopy: string, section: string) => {
    return () => {
      const width = typeof window !== 'undefined' ? window.innerWidth : 0;
      captureClientEvent('marketing.cta_clicked', {
        cta_id: ctaId,
        cta_copy: ctaCopy,
        section,
        screen_width_bucket: screenWidthBucket(width),
      });
    };
  }, []);

  useEffect(() => {
    if (visitTrackedRef.current) return;
    if (typeof user === 'undefined') return;
    visitTrackedRef.current = true;
    const referrerUrl = document.referrer && document.referrer.length > 0 ? document.referrer : 'direct';
    let referrerDomain = 'direct';
    if (referrerUrl !== 'direct') {
      try {
        referrerDomain = new URL(referrerUrl).hostname;
      } catch {
        referrerDomain = 'direct';
      }
    }
    let utmSource: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const source = params.get('utm_source');
      if (source && source.length > 0) {
        utmSource = source;
      }
    } catch {
      utmSource = null;
    }
    const entryPath = window.location.pathname || '/';
    captureClientEvent('marketing.visit_landing', {
      referrer_url: referrerUrl,
      referrer_domain: referrerDomain,
      utm_source: utmSource ?? undefined,
      entry_path: entryPath,
      session_is_guest: !user,
    });
  }, [user]);

  // Show nice loading state during redirect
  if (isRedirecting) {
    return <PageLoader message="Taking you to your dashboard..." />;
  }

  return (
    <>
      <HeroHeader />
      <main className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className={`absolute left-1/2 top-[-20%] h-[32rem] w-[32rem] -translate-x-1/2 ${borderRadius.full} bg-[radial-gradient(circle_at_center,theme(colors.primary/30%)0%,transparent70%)] [filter:blur(140px)]`} />
          <div className={`absolute -right-40 top-1/3 h-[28rem] w-[28rem] ${borderRadius.full} bg-[radial-gradient(circle_at_center,theme(colors.accent/25%)0%,transparent70%)] [filter:blur(140px)]`} />
          <div className={`absolute -left-32 bottom-[-10%] h-[26rem] w-[26rem] ${borderRadius.full} bg-[radial-gradient(circle_at_center,theme(colors.primary/25%)0%,transparent70%)] [filter:blur(140px)]`} />
          <div className="absolute inset-x-0 bottom-[-35%] h-[40rem] bg-[radial-gradient(60%_50%_at_50%_50%,theme(colors.background/0%)0%,theme(colors.background)70%)]" />
        </div>
        <HeroContent onCtaClick={handleCtaClick} />
        <Features />
        <AIModelsSection />
        <RealtimeSection />
        <ComparisonSection />
        <SponsorsSection />
        <VersionsSection />
      </main>
      <Footer />
    </>
  );
}
