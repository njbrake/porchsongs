import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);

  // Close menu on navigation
  const handleLinkClick = () => closeMenu();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="relative flex justify-between items-center px-4 sm:px-8 py-3 bg-linear-to-r from-header-bg-from to-header-bg-to text-header-text border-b border-header-border">
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
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              to="/app/rewrite"
              className="bg-primary text-white hover:bg-primary-hover text-sm px-4 py-2 rounded-full no-underline transition-colors"
            >
              Go to Studio
            </Link>
          ) : (
            <Link
              to="/app/login"
              className="bg-primary text-white hover:bg-primary-hover text-sm px-4 py-2 rounded-full no-underline transition-colors"
            >
              Sign In
            </Link>
          )}
          <button
            type="button"
            className="sm:hidden flex flex-col justify-center items-center w-8 h-8 gap-1 bg-transparent border-none cursor-pointer"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            <span className={`block w-5 h-0.5 bg-header-text transition-all duration-200 ${menuOpen ? 'translate-y-[3px] rotate-45' : ''}`} />
            <span className={`block w-5 h-0.5 bg-header-text transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-header-text transition-all duration-200 ${menuOpen ? '-translate-y-[3px] -rotate-45' : ''}`} />
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <nav id="mobile-nav" className="sm:hidden bg-card border-t border-header-border shadow-sm" role="navigation" aria-label="Mobile navigation">
          <ul className="list-none m-0 p-0">
            {NAV_LINKS.map(link => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={handleLinkClick}
                  className={`block px-6 py-3 text-sm no-underline transition-colors ${
                    location.pathname === link.to
                      ? 'text-primary bg-primary-light'
                      : 'text-foreground/80 hover:text-foreground hover:bg-panel'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

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
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <Link to="/terms" className="text-muted-foreground hover:text-foreground no-underline">Terms</Link>
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground no-underline">Privacy</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} porchsongs. All rights reserved.</p>
      </footer>

    </div>
  );
}
