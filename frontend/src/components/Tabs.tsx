import { Tabs as TabsRoot, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_ITEMS = [
  { key: 'rewrite', label: 'Rewrite' },
  { key: 'library', label: 'Library' },
  { key: 'settings', label: 'Settings' },
] as const;

interface TabsProps {
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ active, onChange }: TabsProps) {
  return (
    <TabsRoot value={active} onValueChange={onChange}>
      <TabsList>
        {TAB_ITEMS.map(t => (
          <TabsTrigger
            key={t.key}
            value={t.key}
            onClick={() => { if (t.key === active) onChange(t.key); }}
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  );
}
