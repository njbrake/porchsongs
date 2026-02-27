import { useState, useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSubscription, listPlans, createCheckout, createPortal, deleteAccount } from './api';
import type { SubscriptionInfo, PlanInfo } from './types';

export interface ExtensionTab {
  key: string;
  label: string;
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      // Clear all local state and redirect to home
      localStorage.clear();
      window.location.href = '/';
    } catch (err) {
      alert((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Card className="border-danger/30">
      <CardContent className="pt-6">
        <h3 className="text-sm font-semibold text-danger mb-2">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!confirming ? (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Delete Account
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Yes, delete my account'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountTab() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    Promise.all([getSubscription(), listPlans()])
      .then(([s, p]) => { setSub(s); setPlans(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planName: string) => {
    setActionLoading(true);
    try {
      const { checkout_url } = await createCheckout(planName);
      window.location.href = checkout_url;
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const { portal_url } = await createPortal();
      window.location.href = portal_url;
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return null;
  if (!sub) return <p className="text-muted-foreground">Could not load account info.</p>;

  const currentPlan = plans.find(p => p.name === sub.plan);
  const upgradePlans = plans.filter(p => p.price_cents > (currentPlan?.price_cents ?? 0));
  const quotaPercent = sub.rewrites_per_month === -1 ? 0 : Math.min(100, Math.round((sub.rewrites_used / sub.rewrites_per_month) * 100));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Account</h2>
        <p className="text-muted-foreground">Your subscription and usage.</p>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold">Current Plan</h3>
            <Badge>{currentPlan?.display_name ?? sub.plan}</Badge>
          </div>
          <div className="mb-1 flex justify-between text-sm text-muted-foreground">
            <span>Rewrites this month</span>
            <span>
              {sub.rewrites_used} / {sub.rewrites_per_month === -1 ? 'unlimited' : sub.rewrites_per_month}
            </span>
          </div>
          {sub.rewrites_per_month !== -1 && (
            <div
              className="w-full h-2 bg-panel rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={sub.rewrites_used}
              aria-valuemin={0}
              aria-valuemax={sub.rewrites_per_month}
              aria-label={`${sub.rewrites_used} of ${sub.rewrites_per_month} rewrites used`}
            >
              <div
                className={cn('h-full rounded-full transition-all', quotaPercent >= 90 ? 'bg-danger' : 'bg-primary')}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {upgradePlans.length > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-3">Upgrade</h3>
            <div className="flex flex-col gap-3">
              {upgradePlans.map(plan => (
                <div key={plan.name} className="flex items-center justify-between border border-border rounded-md p-3">
                  <div>
                    <span className="font-medium">{plan.display_name}</span>
                    <span className="text-muted-foreground ml-2 text-sm">
                      ${(plan.price_cents / 100).toFixed(0)}/mo
                    </span>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {plan.rewrites_per_month === -1 ? 'Unlimited' : plan.rewrites_per_month} rewrites/mo
                    </p>
                  </div>
                  <Button size="sm" onClick={() => handleUpgrade(plan.name)} disabled={actionLoading}>
                    Upgrade
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sub.stripe_customer_id && (
        <div className="mb-4">
          <Button variant="secondary" onClick={handleManageBilling} disabled={actionLoading}>
            Manage Billing
          </Button>
        </div>
      )}

      <DangerZone />
    </div>
  );
}

export function getExtraSettingsTabs(isPremium: boolean): ExtensionTab[] {
  return isPremium ? [{ key: 'account', label: 'Account' }] : [];
}

export function renderPremiumSettingsTab(key: string): ReactNode {
  if (key === 'account') return <AccountTab />;
  return null;
}

export function showOssSettingsTabs(isPremium: boolean): boolean {
  return !isPremium;
}
