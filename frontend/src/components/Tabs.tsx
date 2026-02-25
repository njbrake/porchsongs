import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs as TabsRoot, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_ITEMS = [
  { key: 'rewrite', path: '/app/rewrite', label: 'Rewrite' },
  { key: 'library', path: '/app/library', label: 'Library' },
  { key: 'settings', path: '/app/settings', label: 'Settings' },
] as const;

function activeKeyFromPath(pathname: string): string {
  for (const t of TAB_ITEMS) {
    if (pathname.startsWith(t.path)) return t.key;
  }
  return 'rewrite';
}

export default function Tabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = activeKeyFromPath(pathname);

  const handleChange = (key: string) => {
    const tab = TAB_ITEMS.find(t => t.key === key);
    if (tab) navigate(tab.path);
  };

  return (
    <TabsRoot value={active} onValueChange={handleChange}>
      <TabsList>
        {TAB_ITEMS.map(t => (
          <TabsTrigger
            key={t.key}
            value={t.key}
            onClick={() => { if (t.key === active) handleChange(t.key); }}
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  );
}
