import { useState, useEffect } from 'react';
import api from '../api';

export default function SettingsModal({ provider, model, savedModels, onSave, onAddModel, onRemoveModel, onClose }) {
  const [providers, setProviders] = useState([]);
  const [localProvider, setLocalProvider] = useState('');
  const [localModel, setLocalModel] = useState('');
  const [localApiBase, setLocalApiBase] = useState('');
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState('');

  // Fetch configured providers on mount
  useEffect(() => {
    api.listProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  // Reset connection state when provider or base URL text changes
  const handleProviderChange = (newProvider) => {
    setLocalProvider(newProvider);
    setLocalApiBase('');
    setConnectionVerified(false);
    setModels([]);
    setLocalModel('');
    setError('');
  };

  // For providers without a base URL, auto-fetch models on provider select
  useEffect(() => {
    if (!localProvider) {
      setModels([]);
      return;
    }
    // If a base URL is present, wait for explicit verify
    if (localApiBase) return;
    setLoadingModels(true);
    setError('');
    setConnectionVerified(false);
    api.listProviderModels(localProvider)
      .then(modelList => {
        setModels(modelList);
        setConnectionVerified(true);
        if (modelList.length && !modelList.includes(localModel)) {
          setLocalModel(modelList[0]);
        }
      })
      .catch(err => {
        setError(err.message);
        setModels([]);
      })
      .finally(() => setLoadingModels(false));
  }, [localProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerifyConnection = () => {
    if (!localProvider) return;
    setLoadingModels(true);
    setError('');
    setConnectionVerified(false);
    api.listProviderModels(localProvider, localApiBase || undefined)
      .then(modelList => {
        setModels(modelList);
        setConnectionVerified(true);
        if (modelList.length && !modelList.includes(localModel)) {
          setLocalModel(modelList[0]);
        }
      })
      .catch(err => {
        setError(err.message);
        setModels([]);
      })
      .finally(() => setLoadingModels(false));
  };

  const handleAdd = async () => {
    if (!localProvider || !localModel) return;
    setError('');
    try {
      const result = await onAddModel(localProvider, localModel, localApiBase || null);
      if (!result) {
        setError('Create a profile first (Profile tab) before adding models.');
        return;
      }
      onSave(localProvider, localModel);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleActivate = (sm) => {
    onSave(sm.provider, sm.model);
  };

  const handleDelete = async (sm) => {
    try {
      await onRemoveModel(sm.id);
      // If deleted model was the active one, clear selection
      if (sm.provider === provider && sm.model === model) {
        const remaining = savedModels.filter(m => m.id !== sm.id);
        if (remaining.length > 0) {
          onSave(remaining[0].provider, remaining[0].model);
        } else {
          onSave('', '');
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const noProviders = !providers.length;

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content settings-modal">
        <div className="modal-header">
          <h2>LLM Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {noProviders ? (
            <p style={{ color: '#888' }}>
              No LLM providers configured. Add API keys (e.g. OPENAI_API_KEY) to your .env and restart.
            </p>
          ) : (
            <>
              {/* Section A: Saved Models */}
              <div className="settings-section">
                <h3>Saved Models</h3>
                {savedModels.length === 0 ? (
                  <p className="settings-empty">No models saved yet. Add one below.</p>
                ) : (
                  <div className="saved-models-list">
                    {savedModels.map(sm => {
                      const isActive = sm.provider === provider && sm.model === model;
                      return (
                        <div key={sm.id} className={`saved-model-item${isActive ? ' active' : ''}`}>
                          <button className="saved-model-use" onClick={() => handleActivate(sm)}>
                            <span className="saved-model-label">
                              <span className="saved-model-provider">{sm.provider}</span>
                              <span className="saved-model-sep">/</span>
                              <span className="saved-model-name">{sm.model}</span>
                              {sm.api_base && <span className="saved-model-base" style={{ fontSize: '0.8em', color: '#888', marginLeft: '0.5em' }}>@ {sm.api_base}</span>}
                            </span>
                            {isActive && <span className="saved-model-active-badge">Active</span>}
                          </button>
                          <button className="saved-model-delete" onClick={() => handleDelete(sm)} title="Remove model">&times;</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section B: Add Model */}
              <div className="settings-section">
                <h3>Add Model</h3>
                <div className="form-group">
                  <label>Provider</label>
                  <select value={localProvider} onChange={e => handleProviderChange(e.target.value)}>
                    <option value="">Select provider...</option>
                    {providers.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {localProvider && (
                  <div className="form-group">
                    <label>Base URL <span style={{ fontWeight: 'normal', color: '#888' }}>(optional, for local LLMs)</span></label>
                    <div style={{ display: 'flex', gap: '0.5em' }}>
                      <input
                        type="text"
                        value={localApiBase}
                        onChange={e => { setLocalApiBase(e.target.value); setConnectionVerified(false); setModels([]); setLocalModel(''); }}
                        placeholder="http://localhost:11434"
                        style={{ flex: 1 }}
                      />
                      {localApiBase && (
                        <button className="btn" onClick={handleVerifyConnection} disabled={loadingModels}>
                          {loadingModels ? 'Verifying...' : 'Verify'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {connectionVerified && (
                  <div className="form-group">
                    <label>Model</label>
                    <select value={localModel} onChange={e => setLocalModel(e.target.value)} disabled={loadingModels}>
                      {loadingModels && <option value="">Loading models...</option>}
                      {!loadingModels && models.length === 0 && <option value="">No models found</option>}
                      {!loadingModels && models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
                {error && <p style={{ color: '#c33' }}>{error}</p>}
                <button className="btn primary" onClick={handleAdd} disabled={!localProvider || !localModel}>
                  Add Model
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
