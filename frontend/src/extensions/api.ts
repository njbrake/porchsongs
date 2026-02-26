export async function tryRestoreSession(): Promise<null> {
  // OSS mode — no session to restore. Premium overrides this.
  return null;
}

export function getSubscription(): Promise<never> {
  throw new Error('Not available in OSS');
}

export function listPlans(): Promise<never> {
  throw new Error('Not available in OSS');
}

export function createCheckout(_plan: string): Promise<never> {
  throw new Error('Not available in OSS');
}

export function createPortal(): Promise<never> {
  throw new Error('Not available in OSS');
}
