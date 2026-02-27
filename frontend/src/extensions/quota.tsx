import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getSubscription } from './api';
import type { SubscriptionInfo } from './types';

const LOW_QUOTA_THRESHOLD = 2;

export function QuotaBanner() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    getSubscription().then(setSub).catch(() => {});
  }, []);

  if (!sub || sub.rewrites_per_month === -1) return null;

  const remaining = sub.rewrites_per_month - sub.rewrites_used;
  const isLow = remaining <= LOW_QUOTA_THRESHOLD && remaining > 0;
  const isExhausted = remaining <= 0;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm mb-3',
        isExhausted
          ? 'bg-danger/10 text-danger border border-danger/20'
          : isLow
            ? 'bg-warning-bg text-warning-text border border-warning-border'
            : 'bg-panel text-muted-foreground',
      )}
      role="status"
      aria-label="Rewrite quota status"
    >
      <span className="flex items-center gap-1.5">
        {(isLow || isExhausted) && (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        )}
        <span>
          {isExhausted
            ? 'Monthly rewrite limit reached.'
            : isLow
              ? `Only ${remaining} rewrite${remaining === 1 ? '' : 's'} remaining this month.`
              : `${remaining} of ${sub.rewrites_per_month} rewrites remaining this month.`}
        </span>
      </span>
      {(isLow || isExhausted) && (
        <Link
          to="/app/settings/account"
          className="text-sm font-semibold text-primary no-underline hover:underline whitespace-nowrap"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}

const ONBOARDING_KEY = 'porchsongs_onboarding_dismissed';

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(ONBOARDING_KEY) === '1');

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-card border border-primary/20 rounded-lg p-5 mb-4" role="region" aria-label="Welcome guide">
      <h2 className="text-lg font-semibold mb-3">Welcome to porchsongs!</h2>
      <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground mb-4">
        <li><strong className="text-foreground">Paste your lyrics</strong> into the box below — any format works.</li>
        <li><strong className="text-foreground">Hit Parse</strong> — AI cleans up chords and identifies the song.</li>
        <li><strong className="text-foreground">Refine with chat</strong> — ask the AI to change specific sections.</li>
        <li><strong className="text-foreground">Save and export</strong> — download as a PDF performance sheet.</li>
      </ol>
      <button
        onClick={handleDismiss}
        className="text-sm font-semibold text-primary bg-transparent border-0 p-0 cursor-pointer underline hover:no-underline"
      >
        Got it, let&apos;s go!
      </button>
    </div>
  );
}

export function isQuotaError(message: string): boolean {
  return (
    message.includes('rewrite limit reached') ||
    message.includes('quota_exceeded') ||
    message.includes('at capacity')
  );
}
