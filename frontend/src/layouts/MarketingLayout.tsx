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
        <div className="flex justify-center gap-4 mb-2">
          <a
            href="https://github.com/njbrake/porchsongs"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
          <a
            href="https://x.com/natebrake"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
        <p>&copy; {new Date().getFullYear()} porchsongs. All rights reserved.</p>
      </footer>

    </div>
  );
}
