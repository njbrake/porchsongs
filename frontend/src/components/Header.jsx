export default function Header({ profileName, onSettingsClick, onHomeClick, authActive, onLogout }) {
  return (
    <header>
      <div className="header-left">
        <a className="home-link" href="/" onClick={e => { e.preventDefault(); onHomeClick(); }}>
          <img src="/logo.svg" alt="" className="header-logo" />
          <h1>porchsongs</h1>
        </a>
        <span className="tagline">Make every song yours</span>
      </div>
      <div className="header-right">
        {profileName && (
          <span className="profile-badge" title="Active profile">{profileName}</span>
        )}
        <button className="icon-btn" title="LLM Settings" onClick={onSettingsClick}>
          &#9881;
        </button>
        {authActive && (
          <button className="logout-btn" onClick={onLogout}>Log out</button>
        )}
      </div>
    </header>
  );
}
