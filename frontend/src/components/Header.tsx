interface HeaderProps {
  onHomeClick: () => void;
  authActive: boolean;
  onLogout: () => void;
}

export default function Header({ onHomeClick, authActive, onLogout }: HeaderProps) {
  return (
    <header className="flex justify-between items-center px-3 sm:px-8 py-1 sm:py-1.5 bg-linear-to-br from-header-bg-from to-header-bg-to text-header-text shadow-md">
      <div className="flex items-baseline gap-0 min-w-0">
        <a
          className="flex items-baseline gap-0 no-underline text-inherit cursor-pointer shrink-0"
          href="/"
          onClick={e => { e.preventDefault(); onHomeClick(); }}
        >
          <img src="/logo.svg" alt="" className="w-7 h-7 sm:w-9 sm:h-9 mr-2 sm:mr-2.5 self-center" />
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">porchsongs</h1>
        </a>
        <span className="text-sm opacity-70 ml-4 hidden md:inline">Make every song yours</span>
      </div>
      {authActive && (
        <div className="flex items-center shrink-0">
          <button
            className="bg-white/15 border border-white/25 text-header-text text-xs px-2 sm:px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/25 transition-colors"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
