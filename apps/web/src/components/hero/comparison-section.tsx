'use client';

import { Check, X } from 'lucide-react';
import { borderRadius, spacing, opacity, transitions } from '@/styles/design-tokens';

const COMPARISON_DATA = [
  {
    feature: 'Models Available',
    chatgpt: { value: 'GPT only', isPositive: false },
    claude: { value: 'Claude only', isPositive: false },
    openchat: { value: '100+ models', isPositive: true },
  },
  {
    feature: 'Open Source',
    chatgpt: { value: 'No', isPositive: false },
    claude: { value: 'No', isPositive: false },
    openchat: { value: 'AGPL v3', isPositive: true },
  },
  {
    feature: 'Self-Hosting',
    chatgpt: { value: 'No', isPositive: false },
    claude: { value: 'No', isPositive: false },
    openchat: { value: 'Coming soon', isPositive: true },
  },
  {
    feature: 'Cost',
    chatgpt: { value: '$20/mo per user', isPositive: false },
    claude: { value: '$20/mo per user', isPositive: false },
    openchat: { value: 'Free', isPositive: true },
  },
  {
    feature: 'Customization',
    chatgpt: { value: 'Limited themes', isPositive: false },
    claude: { value: 'Limited themes', isPositive: false },
    openchat: { value: 'Full control', isPositive: true },
  },
  {
    feature: 'Your Data',
    chatgpt: { value: 'Their servers', isPositive: false },
    claude: { value: 'Their servers', isPositive: false },
    openchat: { value: 'Your choice', isPositive: true },
  },
] as const;

const CheckmarkIcon = ({ isPositive }: { isPositive: boolean }) => {
  if (isPositive) {
    return <Check className="size-4 shrink-0 text-green-500" aria-label="Yes" />;
  }
  return <X className="size-4 shrink-0 text-muted-foreground/50" aria-label="No" />;
};

export function ComparisonSection() {
  return (
    <section className="relative py-20 md:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.accent/6%)0%,transparent70%)] dark:bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.accent/10%)0%,transparent70%)]"
      />
      <div className="@container mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl">Why choose OpenChat?</h2>
          <p className="mt-4 text-muted-foreground">
            The open source alternative to proprietary AI chat platforms
          </p>
        </div>

        {/* Desktop Table */}
        <div className="mt-12 hidden overflow-hidden md:mt-16 md:block">
          <div className={`overflow-hidden border border-border/60 bg-card/${opacity.medium} backdrop-blur ${borderRadius.lg}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-muted-foreground">Feature</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">ChatGPT</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Claude</th>
                  <th className="bg-primary/5 px-6 py-4 text-center text-sm font-semibold text-primary">OpenChat</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_DATA.map((row, index) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-border/60 transition-colors ${transitions.normal} last:border-b-0 hover:bg-accent/30`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{row.feature}</td>
                    <td className="px-6 py-4 text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <CheckmarkIcon isPositive={row.chatgpt.isPositive} />
                        <span>{row.chatgpt.value}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <CheckmarkIcon isPositive={row.claude.isPositive} />
                        <span>{row.claude.value}</span>
                      </div>
                    </td>
                    <td className="bg-primary/5 px-6 py-4 text-center text-sm font-medium text-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <CheckmarkIcon isPositive={row.openchat.isPositive} />
                        <span>{row.openchat.value}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className={`mt-12 md:hidden ${spacing.gap.lg} flex flex-col`}>
          {COMPARISON_DATA.map((row) => (
            <div
              key={row.feature}
              className={`border border-border/60 bg-card/${opacity.medium} p-4 backdrop-blur ${borderRadius.lg}`}
            >
              <h3 className="mb-3 font-semibold text-foreground">{row.feature}</h3>
              <div className={`flex flex-col ${spacing.gap.sm}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ChatGPT:</span>
                  <div className="flex items-center gap-2">
                    <CheckmarkIcon isPositive={row.chatgpt.isPositive} />
                    <span className="text-sm text-muted-foreground">{row.chatgpt.value}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Claude:</span>
                  <div className="flex items-center gap-2">
                    <CheckmarkIcon isPositive={row.claude.isPositive} />
                    <span className="text-sm text-muted-foreground">{row.claude.value}</span>
                  </div>
                </div>
                <div className="bg-primary/10 -mx-4 -mb-4 mt-2 flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-primary">OpenChat:</span>
                  <div className="flex items-center gap-2">
                    <CheckmarkIcon isPositive={row.openchat.isPositive} />
                    <span className="text-sm font-medium text-foreground">{row.openchat.value}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
