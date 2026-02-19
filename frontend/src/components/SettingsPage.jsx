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

function LLMProvidersTab({ provider, model, savedModels, onSave, onAddModel, onRemoveModel }) {
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [localProvider, setLocalProvider] = useState('');
  const [localModel, setLocalModel] = useState('');
  const [localApiBase, setLocalApiBase] = useState('');
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => setLoadingProviders(false));
  }, []);

  const handleProviderChange = (newProvider) => {
    setLocalProvider(newProvider);
    setLocalApiBase('');
    setConnectionVerified(false);
    setModels([]);
    setLocalModel('');
    setError('');
  };

  useEffect(() => {
    if (!localProvider) {
      setModels([]);
      return;
    }
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

  const noProviders = !loadingProviders && !providers.length;

  if (loadingProviders) {
    return (
      <div className="flex items-center gap-3 py-8 text-muted-foreground text-sm">
        <div className="size-5 border-2 border-border border-t-primary rounded-full animate-spin" />
        <span>Loading providers...</span>
      </div>
    );
  }

  if (noProviders) {
    return (
      <p className="text-muted-foreground py-4">
        No LLM providers configured. Add API keys (e.g. OPENAI_API_KEY) to your .env and restart.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Saved Models */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3 pb-1.5 border-b border-border">Saved Models</h3>
          {savedModels.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No models saved yet. Add one below.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {savedModels.map(sm => {
                const isActive = sm.provider === provider && sm.model === model;
                return (
                  <div key={sm.id} className={cn(
                    'flex items-center border border-border rounded-md overflow-hidden transition-colors',
                    isActive && 'border-primary bg-selected-bg'
                  )}>
                    <button
                      className="flex-1 flex items-center justify-between bg-transparent border-0 px-3 py-2 cursor-pointer text-left text-sm text-foreground hover:bg-panel transition-colors"
                      onClick={() => handleActivate(sm)}
                    >
                      <span className="flex items-baseline gap-0.5">
                        <span className="font-semibold">{sm.provider}</span>
                        <span className="text-muted-foreground mx-0.5">/</span>
                        <span className="text-muted-foreground">{sm.model}</span>
                        {sm.api_base && <span className="text-xs text-muted-foreground ml-2">@ {sm.api_base}</span>}
                      </span>
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
        </CardContent>
      </Card>

      {/* Add Model */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3 pb-1.5 border-b border-border">Add Model</h3>
          <div className="mb-3">
            <Label>Provider</Label>
            <Select value={localProvider} onChange={e => handleProviderChange(e.target.value)}>
              <option value="">Select provider...</option>
              {providers.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </Select>
          </div>
          {localProvider && (
            <div className="mb-3">
              <Label>Base URL <span className="font-normal text-muted-foreground">(optional, for local LLMs)</span></Label>
              <div className="flex gap-2">
                <Input
                  value={localApiBase}
                  onChange={e => { setLocalApiBase(e.target.value); setConnectionVerified(false); setModels([]); setLocalModel(''); }}
                  placeholder="http://localhost:11434"
                  className="flex-1"
                />
                {localApiBase && (
                  <Button variant="secondary" onClick={handleVerifyConnection} disabled={loadingModels}>
                    {loadingModels ? 'Verifying...' : 'Verify'}
                  </Button>
                )}
              </div>
            </div>
          )}
          {connectionVerified && (
            <div className="mb-3">
              <Label>Model</Label>
              <Select value={localModel} onChange={e => setLocalModel(e.target.value)} disabled={loadingModels}>
                {loadingModels && <option value="">Loading models...</option>}
                {!loadingModels && models.length === 0 && <option value="">No models found</option>}
                {!loadingModels && models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          <Button onClick={handleAdd} disabled={!localProvider || !localModel}>
            Add Model
          </Button>
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

export default function SettingsPage({ provider, model, savedModels, onSave, onAddModel, onRemoveModel, profile, onSaveProfile }) {
  const [activeTab, setActiveTab] = useState('profile');

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
            onClick={() => setActiveTab(t.key)}
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
        />
      )}
    </div>
  );
}
