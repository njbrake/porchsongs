export default function Header({ profileName, onSettingsClick }) {
  return (
    <header>
      <div className="header-left">
        <img src="/logo.svg" alt="" className="header-logo" />
        <h1>porchsongs</h1>
        <span className="tagline">Make every song yours</span>
      </div>
      <div className="header-right">
        {profileName && (
          <span className="profile-badge" title="Active profile">{profileName}</span>
        )}
        <button className="icon-btn" title="LLM Settings" onClick={onSettingsClick}>
          &#9881;
        </button>
      </div>
    </header>
  );
}
