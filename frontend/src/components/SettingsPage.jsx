import { useState, useEffect } from 'react';
import api from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn } from '../lib/utils';

function ProviderCard({ conn, providerModels, activeProvider, activeModel, onActivate, onAddModel, onRemoveModel, onDisconnect }) {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadModels = () => {
    setLoading(true);
    setError('');
    api.listProviderModels(conn.provider, conn.api_base || undefined)
      .then(list => {
        setModels(list);
        // Pre-select first model not already saved
        const savedNames = new Set(providerModels.map(m => m.model));
        const first = list.find(m => !savedNames.has(m)) || list[0] || '';
        setSelectedModel(first);
      })
      .catch(err => { setError(err.message); setModels([]); })
      .finally(() => setLoading(false));
  };

  const handleShowAdd = () => {
    setShowAdd(true);
    loadModels();
  };

  const handleAdd = async () => {
    if (!selectedModel) return;
    setError('');
    try {
      await onAddModel(conn.provider, selectedModel);
      onActivate(conn.provider, selectedModel);
      setShowAdd(false);
      setSelectedModel('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (sm) => {
    try {
      await onRemoveModel(sm.id);
      if (sm.provider === activeProvider && sm.model === activeModel) {
        const remaining = providerModels.filter(m => m.id !== sm.id);
        if (remaining.length > 0) {
          onActivate(remaining[0].provider, remaining[0].model);
        } else {
          onActivate('', '');
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card>
      <CardContent className="pt-5">
        {/* Provider header */}
        <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-border">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-foreground">{conn.provider}</h3>
            {conn.api_base && <span className="text-xs text-muted-foreground">@ {conn.api_base}</span>}
          </div>
          <button
            className="text-xs text-muted-foreground hover:text-danger transition-colors cursor-pointer bg-transparent border-0"
            onClick={() => onDisconnect(conn.id)}
          >
            Disconnect
          </button>
        </div>

        {/* Models list */}
        {providerModels.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground italic mb-3">No models added yet.</p>
        )}
        {providerModels.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3">
            {providerModels.map(sm => {
              const isActive = sm.provider === activeProvider && sm.model === activeModel;
              return (
                <div key={sm.id} className={cn(
                  'flex items-center border border-border rounded-md overflow-hidden transition-colors',
                  isActive && 'border-primary bg-selected-bg'
                )}>
                  <button
                    className="flex-1 flex items-center justify-between bg-transparent border-0 px-3 py-2 cursor-pointer text-left text-sm text-foreground hover:bg-panel transition-colors"
                    onClick={() => onActivate(sm.provider, sm.model)}
                  >
                    <span className="text-muted-foreground">{sm.model}</span>
                    {isActive && <Badge variant="active">Active</Badge>}
                  </button>
                  <button
                    className="bg-transparent border-0 border-l border-border px-2.5 py-2 text-lg text-muted-foreground cursor-pointer leading-none hover:text-danger hover:bg-error-bg transition-colors"
                    onClick={() => handleDelete(sm)}
                    title="Remove model"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add model inline */}
        {showAdd ? (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Model</Label>
              <Select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={loading}>
                {loading && <option value="">Loading...</option>}
                {!loading && models.length === 0 && <option value="">No models found</option>}
                {!loading && models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={!selectedModel || loading}>Add</Button>
            <Button variant="secondary" onClick={() => { setShowAdd(false); setError(''); }}>Cancel</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleShowAdd}>+ Add Model</Button>
        )}
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}

function LLMProvidersTab({ provider, model, savedModels, onSave, onAddModel, onRemoveModel, connections, onAddConnection, onRemoveConnection }) {
  const [providers, setProviders] = useState([]);
  const [connProvider, setConnProvider] = useState('');
  const [connApiBase, setConnApiBase] = useState('');
  const [connVerifying, setConnVerifying] = useState(false);
  const [connError, setConnError] = useState('');

  useEffect(() => {
    api.listProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  const isLocalProvider = (name) => providers.find(p => p.name === name)?.local;
  const connectedProviderNames = new Set(connections.map(c => c.provider));
  const availableProviders = providers.filter(p => !connectedProviderNames.has(p.name));
  const isLocal = isLocalProvider(connProvider);

  const handleAddConnection = async () => {
    if (!connProvider) return;

    setConnVerifying(true);
    setConnError('');
    try {
      await api.listProviderModels(connProvider, connApiBase || undefined);
      const result = await onAddConnection(connProvider, connApiBase || null);
      if (!result) {
        setConnError('Create a profile first (Profile tab) before adding providers.');
        return;
      }
      setConnProvider('');
      setConnApiBase('');
    } catch (err) {
      setConnError(isLocalProvider(connProvider)
        ? 'Could not connect. Check the base URL and that the server is running.'
        : err.message);
    } finally {
      setConnVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* One card per connected provider */}
      {connections.map(conn => (
        <ProviderCard
          key={conn.id}
          conn={conn}
          providerModels={savedModels.filter(m => m.provider === conn.provider)}
          activeProvider={provider}
          activeModel={model}
          onActivate={onSave}
          onAddModel={onAddModel}
          onRemoveModel={onRemoveModel}
          onDisconnect={onRemoveConnection}
        />
      ))}

      {/* Add Provider */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3 pb-1.5 border-b border-border">Add Provider</h3>
          {availableProviders.length === 0 && providers.length > 0 ? (
            <p className="text-sm text-muted-foreground italic">All available providers are connected.</p>
          ) : (
            <>
              <div className="mb-3">
                <Label>Provider</Label>
                <Select value={connProvider} onChange={e => { setConnProvider(e.target.value); setConnApiBase(''); setConnError(''); }}>
                  <option value="">Select provider...</option>
                  {availableProviders.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </Select>
              </div>
              {connProvider && isLocal && (
                <div className="mb-3">
                  <Label>Base URL</Label>
                  <Input
                    value={connApiBase}
                    onChange={e => setConnApiBase(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                </div>
              )}
              {connError && <p className="text-sm text-danger mb-3">{connError}</p>}
              <Button
                onClick={handleAddConnection}
                disabled={!connProvider || connVerifying || (isLocal && !connApiBase)}
              >
                {connVerifying ? 'Verifying...' : 'Connect'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileSubTab({ profile, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setDescription(profile.description || '');
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        is_default: true,
      });
      setStatus('Saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">Your Rewriting Preferences</h2>
        <p className="text-muted-foreground">Describe yourself and your life — every song rewrite will use this to personalize the lyrics for you.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </div>
            <div className="mb-4">
              <Label htmlFor="profile-desc">About you (used in every rewrite)</Label>
              <Textarea
                id="profile-desc"
                rows="8"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={"Anything the LLM should know when rewriting lyrics for you.\n\ne.g., I live in a quiet suburb outside Austin with my wife and two kids (8 and 5). I drive a Subaru Outback, work in software, play acoustic guitar on the porch most evenings. I like cycling, grilling, and coaching Little League. My dog Max is a golden retriever."}
              />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <Button type="submit">Save</Button>
              {status && <span className="text-sm text-success">{status}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const SETTINGS_TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'providers', label: 'LLM Providers' },
];

export default function SettingsPage({ provider, model, savedModels, onSave, onAddModel, onRemoveModel, connections, onAddConnection, onRemoveConnection, profile, onSaveProfile, activeTab, onChangeTab }) {
  return (
    <div>
      <div className="flex border-b border-border mb-4">
        {SETTINGS_TABS.map(t => (
          <button
            key={t.key}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.key
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
            onClick={() => onChangeTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <ProfileSubTab profile={profile} onSave={onSaveProfile} />
      )}

      {activeTab === 'providers' && (
        <LLMProvidersTab
          provider={provider}
          model={model}
          savedModels={savedModels}
          onSave={onSave}
          onAddModel={onAddModel}
          onRemoveModel={onRemoveModel}
          connections={connections}
          onAddConnection={onAddConnection}
          onRemoveConnection={onRemoveConnection}
        />
      )}
    </div>
  );
}
