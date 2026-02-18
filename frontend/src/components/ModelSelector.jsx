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

  // Find current selection in saved models
  const activeId = savedModels.find(m => m.provider === provider && m.model === model)?.id;
  const hasUnsaved = provider && model && !activeId;

  if (!savedModels.length && !provider) {
    return (
      <div className="model-selector">
        <span className="model-selector-empty">
          No models configured.{' '}
          <button className="link-btn inline" onClick={onOpenSettings}>Open Settings</button> to add one.
        </span>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <select
        value={activeId ? String(activeId) : (hasUnsaved ? '__unsaved__' : '')}
        onChange={handleChange}
        className="model-selector-select"
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
      </select>
    </div>
  );
}
