import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/how-to', label: 'How-To' },
] as const;

export default function MarketingLayout() {
  const { authState } = useAuth();
  const isLoggedIn = authState === 'ready';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="flex justify-between items-center px-4 sm:px-8 py-3 bg-linear-to-br from-header-bg-from to-header-bg-to text-header-text shadow-md">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 no-underline text-inherit">
            <img src="/logo.svg" alt="" className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight">porchsongs</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-header-text/80 hover:text-header-text no-underline transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          {isLoggedIn ? (
            <Link
              to="/app/rewrite"
              className="bg-white/20 hover:bg-white/30 text-header-text text-sm px-4 py-2 rounded-full no-underline transition-colors"
            >
              Open App
            </Link>
          ) : (
            <Link
              to="/app/login"
              className="bg-white/20 hover:bg-white/30 text-header-text text-sm px-4 py-2 rounded-full no-underline transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 sm:px-8 py-6 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          {NAV_LINKS.map(link => (
            <Link key={link.to} to={link.to} className="text-muted-foreground hover:text-foreground no-underline">
              {link.label}
            </Link>
          ))}
        </div>
        <p>&copy; {new Date().getFullYear()} porchsongs. All rights reserved.</p>
      </footer>
    </div>
  );
}
