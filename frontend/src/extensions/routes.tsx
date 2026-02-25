import type { ReactNode } from 'react';

export function getPremiumRouteElements(): ReactNode {
  return null;
}

export function getDefaultSettingsTab(_isPremium: boolean): string {
  return 'models';
}

export function getCatchAllRedirect(_isPremium: boolean): string {
  return '/app';
}

export function shouldRedirectRootToApp(_isPremium: boolean): boolean {
  return true;
}
