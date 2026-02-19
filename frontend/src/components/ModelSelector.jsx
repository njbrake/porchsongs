import { Select } from './ui/select';
import { Button } from './ui/button';

export default function ModelSelector({ provider, model, savedModels, onChangeProvider, onChangeModel, onOpenSettings }) {
  const handleChange = (e) => {
    const val = e.target.value;
    if (val === '__manage__') {
      onOpenSettings();
      return;
    }
    if (!val) return;
    const sm = savedModels.find(m => m.id === Number(val));
    if (sm) {
      onChangeProvider(sm.provider);
      onChangeModel(sm.model);
    }
  };

  const activeId = savedModels.find(m => m.provider === provider && m.model === model)?.id;
  const hasUnsaved = provider && model && !activeId;

  if (!savedModels.length && !provider) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-muted-foreground">
          No models configured.{' '}
          <Button variant="link-inline" onClick={onOpenSettings}>Open Settings</Button> to add one.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-3">
      <Select
        value={activeId ? String(activeId) : (hasUnsaved ? '__unsaved__' : '')}
        onChange={handleChange}
        className="w-full sm:w-auto sm:min-w-[220px] py-1.5 px-2.5 text-sm"
      >
        {hasUnsaved && (
          <option value="__unsaved__">{provider} / {model} (unsaved)</option>
        )}
        {!hasUnsaved && !activeId && (
          <option value="">Select model...</option>
        )}
        {savedModels.map(sm => (
          <option key={sm.id} value={String(sm.id)}>
            {sm.provider} / {sm.model}
          </option>
        ))}
        <option value="__manage__">Manage models...</option>
      </Select>
    </div>
  );
}
