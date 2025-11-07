'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { authClient } from '@/lib/auth-client';

import { HeroHeader } from './header';
import Features from '@/components/features-1';
import { HeroContent } from '@/components/hero/hero-content';
import { TrustedBrands } from '@/components/hero/trusted-brands';
import { IntegrationsSection } from '@/components/hero/integrations-section';
import { PricingSection } from '@/components/hero/pricing-section';
import { captureClientEvent } from '@/lib/posthog';

function screenWidthBucket(width: number) {
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  return 'xl';
}

export default function HeroSection() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const visitTrackedRef = useRef(false);

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

  return (
    <>
      <HeroHeader />
      <main className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-[-20%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,theme(colors.primary/30%)0%,transparent70%)] [filter:blur(140px)]" />
          <div className="absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,theme(colors.accent/25%)0%,transparent70%)] [filter:blur(140px)]" />
          <div className="absolute -left-32 bottom-[-10%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,theme(colors.primary/25%)0%,transparent70%)] [filter:blur(140px)]" />
          <div className="absolute inset-x-0 bottom-[-35%] h-[40rem] bg-[radial-gradient(60%_50%_at_50%_50%,theme(colors.background/0%)0%,theme(colors.background)70%)]" />
        </div>
        <HeroContent onCtaClick={handleCtaClick} />
        <TrustedBrands />
        <Features />
        <IntegrationsSection />
        <PricingSection />
      </main>
    </>
  );
}
