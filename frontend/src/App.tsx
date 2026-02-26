import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Spinner from '@/components/ui/spinner';
import LoginPage from '@/components/LoginPage';
import NotFoundPage from '@/components/NotFoundPage';
import AppShell from '@/layouts/AppShell';
import RewriteTab from '@/components/RewriteTab';
import LibraryTab from '@/components/LibraryTab';
import SettingsPage from '@/components/SettingsPage';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPremiumRouteElements,
  getDefaultSettingsTab,
  shouldRedirectRootToApp,
} from '@/extensions';

/** Redirects legacy routes like /library/:id to /app/library/:id */
function LegacyRedirect({ prefix }: { prefix: string }) {
  const params = useParams();
  const suffix = params['*'] ?? Object.values(params)[0] ?? '';
  return <Navigate to={`${prefix}/${suffix}`} replace />;
}

export default function App() {
  const { authState, isPremium } = useAuth();

  if (authState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <Spinner />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <Routes>
      {/* Premium route elements (marketing pages, etc.) */}
      {getPremiumRouteElements()}

      {/* Login */}
      <Route path="/app/login" element={<LoginPage />} />

      {/* Authenticated app */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/app/rewrite" replace />} />
        <Route path="rewrite" element={<RewriteTab />} />
        <Route path="library" element={<LibraryTab />} />
        <Route path="library/:id" element={<LibraryTab />} />
        <Route path="settings/:tab" element={<SettingsPage />} />
        <Route path="settings" element={<Navigate to={`/app/settings/${getDefaultSettingsTab(isPremium)}`} replace />} />
      </Route>

      {/* OSS root redirects to app; premium root handled by extension routes */}
      {shouldRedirectRootToApp(isPremium) && <Route path="/" element={<Navigate to="/app" replace />} />}

      {/* Legacy routes redirect to new paths */}
      <Route path="/rewrite" element={<Navigate to="/app/rewrite" replace />} />
      <Route path="/library" element={<Navigate to="/app/library" replace />} />
      <Route path="/library/:id" element={<LegacyRedirect prefix="/app/library" />} />
      <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
      <Route path="/settings/:tab" element={<LegacyRedirect prefix="/app/settings" />} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
