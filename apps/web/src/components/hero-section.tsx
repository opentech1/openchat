'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/nice-loader';

import { HeroHeader } from './header';
import { HeroContent } from '@/components/hero/hero-content';
import { captureClientEvent } from '@/lib/posthog';

// Lazy load below-fold sections to reduce initial bundle size
const Features = dynamic(() => import('@/components/features-1'), {
  loading: () => <div className="h-96 animate-pulse bg-muted/20" />,
});

const AIModelsSection = dynamic(() => import('@/components/hero/ai-models-section').then(mod => ({ default: mod.AIModelsSection })), {
  loading: () => <div className="h-96 animate-pulse bg-muted/20" />,
});

const RealtimeSection = dynamic(() => import('@/components/hero/realtime-section').then(mod => ({ default: mod.RealtimeSection })), {
  loading: () => <div className="h-96 animate-pulse bg-muted/20" />,
});

const ComparisonSection = dynamic(() => import('@/components/hero/comparison-section').then(mod => ({ default: mod.ComparisonSection })), {
  loading: () => <div className="h-96 animate-pulse bg-muted/20" />,
});

const SponsorsSection = dynamic(() => import('@/components/hero/sponsors-section').then(mod => ({ default: mod.SponsorsSection })), {
  loading: () => <div className="h-96 animate-pulse bg-muted/20" />,
});

const VersionsSection = dynamic(() => import('@/components/hero/versions-section').then(mod => ({ default: mod.VersionsSection })), {
  loading: () => <div className="h-96 animate-pulse bg-muted/20" />,
});

const Footer = dynamic(() => import('@/components/footer').then(mod => ({ default: mod.Footer })), {
  loading: () => <div className="h-64 animate-pulse bg-muted/20" />,
});

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
      <main className="relative">
        {/* Subtle background - Linear style */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10">
          {/* Very subtle gradient - barely visible */}
          <div className="absolute inset-0 bg-gradient-to-b from-muted/5 via-transparent to-transparent" />
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
