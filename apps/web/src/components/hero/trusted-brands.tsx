'use client';

import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';

const TRUSTED_BRANDS = [
  "Nvidia",
  "Column",
  "GitHub",
  "Nike",
  "Lemon Squeezy",
  "Laravel",
  "Eli Lilly",
  "OpenAI",
];

export function TrustedBrands() {
  return (
    <section className="bg-background pb-16 md:pb-32">
      <div className="group relative m-auto max-w-6xl px-6">
        <div className="flex flex-col items-center md:flex-row">
          <div className="md:max-w-44 md:border-r md:pr-6">
            <p className="text-end text-sm text-muted-foreground">Trusted by teams shipping with OpenChat</p>
          </div>
          <div className="relative py-6 md:w-[calc(100%-11rem)]">
            <InfiniteSlider
              speedOnHover={26}
              speed={32}
              gap={96}
              className="pl-8 pr-8">
              {TRUSTED_BRANDS.map((brand) => (
                <div key={brand} className="flex">
                  <span className="mx-auto whitespace-nowrap rounded-full border border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground">
                    {brand}
                  </span>
                </div>
              ))}
            </InfiniteSlider>

            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-linear-to-r from-background" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-background" />
            <ProgressiveBlur
              className="pointer-events-none absolute left-0 top-0 h-full w-20"
              direction="left"
              blurIntensity={1}
            />
            <ProgressiveBlur
              className="pointer-events-none absolute right-0 top-0 h-full w-20"
              direction="right"
              blurIntensity={1}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
