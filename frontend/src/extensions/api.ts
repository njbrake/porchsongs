import client, { tryRefresh } from '@/lib/api-client';
import type { AuthUser } from '@/types';
import type { SubscriptionInfo, PlanInfo, CheckoutResponse, PortalResponse } from './types';

export async function tryRestoreSession(): Promise<AuthUser | null> {
  const refreshed = await tryRefresh();
  if (!refreshed) return null;
  try {
    const { data, error } = await client.GET('/api/auth/me');
    if (error) return null;
    return data as AuthUser;
  } catch {
    return null;
  }
}

function throwApiError(error: unknown, fallback: string): never {
  const b = error as { detail?: string | { message?: string; error?: string } };
  let message = fallback;
  if (b.detail) {
    message = typeof b.detail === 'object'
      ? (b.detail.message || b.detail.error || fallback)
      : b.detail;
  }
  throw new Error(message);
}

export async function getSubscription(): Promise<SubscriptionInfo> {
  const { data, error } = await client.GET('/api/subscriptions/me');
  if (error) throwApiError(error, 'Failed to get subscription');
  return data as SubscriptionInfo;
}

export async function listPlans(): Promise<PlanInfo[]> {
  const { data, error } = await client.GET('/api/subscriptions/plans');
  if (error) throwApiError(error, 'Failed to list plans');
  return data as PlanInfo[];
}

export async function createCheckout(plan: string): Promise<CheckoutResponse> {
  const { data, error } = await client.POST('/api/billing/checkout', {
    body: { plan } as never,
  });
  if (error) throwApiError(error, 'Failed to create checkout');
  return data as CheckoutResponse;
}

export async function createPortal(): Promise<PortalResponse> {
  const { data, error } = await client.POST('/api/billing/portal');
  if (error) throwApiError(error, 'Failed to create portal');
  return data as PortalResponse;
}

export async function deleteAccount(): Promise<void> {
  const { error } = await client.DELETE('/api/auth/me');
  if (error) throwApiError(error, 'Failed to delete account');
}
