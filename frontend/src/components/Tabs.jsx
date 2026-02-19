import { Tabs as TabsRoot, TabsList, TabsTrigger } from './ui/tabs';

const TAB_ITEMS = [
  { key: 'rewrite', label: 'Rewrite' },
  { key: 'library', label: 'Library' },
  { key: 'settings', label: 'Settings' },
];

export default function Tabs({ active, onChange }) {
  return (
    <TabsRoot value={active} onValueChange={onChange}>
      <TabsList>
        {TAB_ITEMS.map(t => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  );
}
