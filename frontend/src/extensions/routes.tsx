import type { ReactNode } from 'react';
import { Route } from 'react-router-dom';
import MarketingLayout from '@/layouts/MarketingLayout';
import LoginPage from '@/components/LoginPage';
import HomePage from '@/pages/marketing/HomePage';
import PricingPage from '@/pages/marketing/PricingPage';
import AboutPage from '@/pages/marketing/AboutPage';
import HowToIndex from '@/pages/marketing/HowToIndex';
import HowToArticle from '@/pages/marketing/HowToArticle';
import TermsPage from '@/pages/marketing/TermsPage';
import PrivacyPage from '@/pages/marketing/PrivacyPage';

export function getLoginPageElement(): ReactNode {
  return <LoginPage />;
}

export function getPremiumRouteElements(): ReactNode {
  return (
    <Route element={<MarketingLayout />}>
      <Route index element={<HomePage />} />
      <Route path="pricing" element={<PricingPage />} />
      <Route path="about" element={<AboutPage />} />
      <Route path="how-to" element={<HowToIndex />} />
      <Route path="how-to/:slug" element={<HowToArticle />} />
      <Route path="terms" element={<TermsPage />} />
      <Route path="privacy" element={<PrivacyPage />} />
    </Route>
  );
}

export function getDefaultSettingsTab(isPremium: boolean): string {
  return isPremium ? 'account' : 'models';
}

export function getCatchAllRedirect(isPremium: boolean): string {
  return isPremium ? '/' : '/app';
}

export function shouldRedirectRootToApp(isPremium: boolean): boolean {
  return !isPremium;
}
