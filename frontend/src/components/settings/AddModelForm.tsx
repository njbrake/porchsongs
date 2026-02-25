import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import api from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { Provider, ProviderConnection, SavedModel } from '@/types';

interface AddModelFormProps {
  providers: Provider[];
  connections: ProviderConnection[];
  savedModels: SavedModel[];
  /** When set, pre-selects this provider and fetches its models. Cleared after consumption. */
  prefillProvider?: string | null;
  onPrefillConsumed?: () => void;
  onAddConnection: (provider: string, apiBase?: string | null) => Promise<ProviderConnection | null>;
  onAddModel: (provider: string, model: string) => Promise<SavedModel | undefined>;
  onActivate: (provider: string, model: string) => void;
}

export default function AddModelForm({
  providers,
  connections,
  savedModels,
  prefillProvider,
  onPrefillConsumed,
  onAddConnection,
  onAddModel,
  onActivate,
}: AddModelFormProps) {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const isLocal = providers.find(p => p.name === selectedProvider)?.local ?? false;

  const fetchModels = useCallback((prov: string, base: string) => {
    const saved = new Set(savedModels.filter(m => m.provider === prov).map(m => m.model));
    setLoading(true);
    setError('');
    api.listProviderModels(prov, base || undefined)
      .then(list => {
        const available = list.filter(m => !saved.has(m));
        setModels(available);
        setSelectedModel(available[0] ?? '');
      })
      .catch(err => {
        setError((err as Error).message);
        setModels([]);
        setSelectedModel('');
      })
      .finally(() => setLoading(false));
  }, [savedModels]);

  // For non-local providers, fetch immediately when provider changes
  useEffect(() => {
    if (!selectedProvider || isLocal) {
      setModels([]);
      setSelectedModel('');
      return;
    }
    fetchModels(selectedProvider, '');
  }, [selectedProvider, isLocal, fetchModels]);

  // Handle prefill from "+ Add Model" buttons on provider groups
  useEffect(() => {
    if (!prefillProvider) return;
    const conn = connections.find(c => c.provider === prefillProvider);
    setSelectedProvider(prefillProvider);
    setApiBase(conn?.api_base ?? '');
    setError('');
    // For non-local, fetchModels triggers via the selectedProvider effect above.
    // For local with an existing api_base, fetch immediately.
    const provIsLocal = providers.find(p => p.name === prefillProvider)?.local ?? false;
    if (provIsLocal && conn?.api_base) {
      fetchModels(prefillProvider, conn.api_base);
    }
    onPrefillConsumed?.();
  }, [prefillProvider, connections, providers, fetchModels, onPrefillConsumed]);

  const handleAdd = async () => {
    if (!selectedProvider || !selectedModel) return;
    setAdding(true);
    setError('');
    try {
      // Auto-connect if no existing connection for this provider
      const hasConnection = connections.some(c => c.provider === selectedProvider);
      if (!hasConnection) {
        const result = await onAddConnection(selectedProvider, apiBase || null);
        if (!result) {
          setError('Failed to connect provider.');
          return;
        }
      }
      await onAddModel(selectedProvider, selectedModel);
      onActivate(selectedProvider, selectedModel);
      // Remove from available list and reset
      setModels(prev => prev.filter(m => m !== selectedModel));
      setSelectedModel(models.filter(m => m !== selectedModel)[0] ?? '');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-panel rounded-lg p-4 border border-border">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Add Model</h3>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-[160px] flex-1">
          <Label>Provider</Label>
          <Select
            value={selectedProvider}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setSelectedProvider(e.target.value);
              setApiBase('');
              setModels([]);
              setSelectedModel('');
              setError('');
            }}
          >
            <option value="">Select provider...</option>
            {providers.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </Select>
        </div>

        {selectedProvider && isLocal && (
          <>
            <div className="min-w-[200px] flex-1">
              <Label>Base URL</Label>
              <Input
                value={apiBase}
                onChange={e => setApiBase(e.target.value)}
                placeholder="e.g. http://100.80.227.1:8123/v1"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => fetchModels(selectedProvider, apiBase)}
              disabled={!apiBase || loading}
            >
              {loading ? 'Fetching...' : 'Fetch Models'}
            </Button>
          </>
        )}

        {models.length > 0 && (
          <div className="min-w-[200px] flex-1">
            <Label>Model</Label>
            <Select
              value={selectedModel}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedModel(e.target.value)}
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
        )}

        {/* For non-local: show loading state inline */}
        {selectedProvider && !isLocal && loading && (
          <div className="min-w-[200px] flex-1">
            <Label>Model</Label>
            <Select disabled>
              <option value="">Loading...</option>
            </Select>
          </div>
        )}

        <Button
          onClick={handleAdd}
          disabled={!selectedProvider || !selectedModel || loading || adding}
        >
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
