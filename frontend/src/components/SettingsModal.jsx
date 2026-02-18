import { useState, useEffect } from 'react';
import api from '../api';

export default function SettingsModal({ provider, model, apiKey, apiBase, onSave, onClose }) {
  const [providers, setProviders] = useState([]);
  const [localProvider, setLocalProvider] = useState(provider);
  const [localModel, setLocalModel] = useState(model);
  const [localKey, setLocalKey] = useState(apiKey);
  const [localBase, setLocalBase] = useState(apiBase || '');
  const [models, setModels] = useState(model ? [model] : []);
  const [verifyStatus, setVerifyStatus] = useState({ text: '', type: '' });

  useEffect(() => {
    api.listProviders().then(setProviders).catch(() => setProviders([]));
  }, []);

  const handleVerify = async () => {
    if (!localProvider) {
      setVerifyStatus({ text: 'Select a provider first.', type: 'error' });
      return;
    }
    if (!localKey) {
      setVerifyStatus({ text: 'Enter an API key first.', type: 'error' });
      return;
    }

    setVerifyStatus({ text: 'Verifying...', type: '' });

    try {
      const result = await api.verifyConnection({
        provider: localProvider,
        api_key: localKey,
        api_base: localBase || null,
      });
      if (result.ok) {
        setVerifyStatus({ text: 'Connected!', type: 'success' });
        setModels(result.models);
        if (result.models.length && !result.models.includes(localModel)) {
          setLocalModel(result.models[0]);
        }
      } else {
        setVerifyStatus({ text: result.error || 'Connection failed.', type: 'error' });
      }
    } catch (err) {
      setVerifyStatus({ text: err.message, type: 'error' });
    }
  };

  const handleSave = () => {
    onSave(localProvider, localModel, localKey, localBase);
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h2>LLM Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Provider</label>
            <select value={localProvider} onChange={e => setLocalProvider(e.target.value)}>
              <option value="">Select provider...</option>
              {providers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={localKey}
              onChange={e => setLocalKey(e.target.value)}
              placeholder="Your API key (stored locally only)"
            />
          </div>
          <div className="form-group">
            <label>Base URL <span style={{fontWeight: 'normal', color: '#888'}}>(optional)</span></label>
            <input
              type="url"
              value={localBase}
              onChange={e => setLocalBase(e.target.value)}
              placeholder="e.g., http://localhost:8080/v1 for llamafile"
            />
          </div>
          <div className="form-group">
            <button className="btn secondary" onClick={handleVerify}>Verify Connection</button>
            {verifyStatus.text && (
              <span className={`verify-status ${verifyStatus.type}`}>{verifyStatus.text}</span>
            )}
          </div>
          <div className="form-group">
            <label>Model</label>
            <select value={localModel} onChange={e => setLocalModel(e.target.value)}>
              {models.length === 0 && <option value="">Verify connection to load models</option>}
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <button className="btn primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
