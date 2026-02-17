const TABS = [
  { key: 'rewrite', label: 'Rewrite' },
  { key: 'library', label: 'Library' },
  { key: 'profile', label: 'Profile' },
];

export default function Tabs({ active, onChange }) {
  return (
    <nav className="tabs">
      {TABS.map(t => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
