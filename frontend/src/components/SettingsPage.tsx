import { useState, useEffect } from 'react';
import api from '@/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ModelsTab from '@/components/settings/ModelsTab';
import SystemPromptsTab from '@/components/settings/SystemPromptsTab';
import type { Profile, SavedModel, ProviderConnection, SubscriptionInfo, PlanInfo } from '@/types';

function AccountTab() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getSubscription(), api.listPlans()])
      .then(([s, p]) => { setSub(s); setPlans(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planName: string) => {
    setActionLoading(true);
    try {
      const { checkout_url } = await api.createCheckout(planName);
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
      const { portal_url } = await api.createPortal();
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
            <div className="w-full h-2 bg-panel rounded-full overflow-hidden">
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
        <Button variant="secondary" onClick={handleManageBilling} disabled={actionLoading}>
          Manage Billing
        </Button>
      )}
    </div>
  );
}

const SETTINGS_TABS = [
  { key: 'models', label: 'Models' },
  { key: 'prompts', label: 'System Prompts' },
] as const;

interface SettingsPageProps {
  provider: string;
  model: string;
  savedModels: SavedModel[];
  onSave: (provider: string, model: string) => void;
  onAddModel: (provider: string, model: string) => Promise<SavedModel | undefined>;
  onRemoveModel: (id: number) => Promise<void>;
  connections: ProviderConnection[];
  onAddConnection: (provider: string, apiBase?: string | null) => Promise<ProviderConnection | null>;
  onRemoveConnection: (id: number) => void;
  profile: Profile | null;
  onSaveProfile: (data: Partial<Profile>) => Promise<Profile>;
  activeTab: string;
  onChangeTab: (tab: string) => void;
  reasoningEffort: string;
  onChangeReasoningEffort: (value: string) => void;
  isPremium?: boolean;
}

export default function SettingsPage({
  provider,
  model,
  savedModels,
  onSave,
  onAddModel,
  onRemoveModel,
  connections,
  onAddConnection,
  onRemoveConnection,
  profile,
  onSaveProfile,
  activeTab,
  onChangeTab,
  reasoningEffort,
  onChangeReasoningEffort,
  isPremium,
}: SettingsPageProps) {
  const visibleTabs = isPremium
    ? [{ key: 'account', label: 'Account' }]
    : SETTINGS_TABS;

  return (
    <div>
      {visibleTabs.length > 1 && (
        <div className="flex border-b border-border mb-4">
          {visibleTabs.map(t => (
            <button
              key={t.key}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === t.key
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
              onClick={() => onChangeTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'account' && isPremium && <AccountTab />}

      {activeTab === 'models' && !isPremium && (
        <ModelsTab
          provider={provider}
          model={model}
          savedModels={savedModels}
          onSave={onSave}
          onAddModel={onAddModel}
          onRemoveModel={onRemoveModel}
          connections={connections}
          onAddConnection={onAddConnection}
          onRemoveConnection={onRemoveConnection}
          reasoningEffort={reasoningEffort}
          onChangeReasoningEffort={onChangeReasoningEffort}
        />
      )}

      {activeTab === 'prompts' && !isPremium && (
        <SystemPromptsTab profile={profile} onSaveProfile={onSaveProfile} />
      )}
    </div>
  );
}
