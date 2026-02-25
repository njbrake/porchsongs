import { useState } from 'react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import ModelRow from '@/components/settings/ModelRow';
import type { SavedModel, ProviderConnection } from '@/types';

interface ProviderModelGroupProps {
  conn: ProviderConnection;
  models: SavedModel[];
  activeProvider: string;
  activeModel: string;
  onActivate: (provider: string, model: string) => void;
  onRemoveModel: (id: number) => Promise<void>;
  onDisconnect: (id: number) => void;
  onAddAnother: (provider: string) => void;
}

export default function ProviderModelGroup({
  conn,
  models,
  activeProvider,
  activeModel,
  onActivate,
  onRemoveModel,
  onDisconnect,
  onAddAnother,
}: ProviderModelGroupProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  const handleRemove = async (sm: SavedModel) => {
    try {
      await onRemoveModel(sm.id);
      if (sm.provider === activeProvider && sm.model === activeModel) {
        const remaining = models.filter(m => m.id !== sm.id);
        if (remaining.length > 0) {
          onActivate(remaining[0]!.provider, remaining[0]!.model);
        } else {
          onActivate('', '');
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-foreground">{conn.provider}</h3>
          {conn.api_base && (
            <span className="text-xs text-muted-foreground">@ {conn.api_base}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          Disconnect
        </Button>
      </div>

      {models.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No models</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {models.map(sm => (
            <ModelRow
              key={sm.id}
              model={sm}
              isActive={sm.provider === activeProvider && sm.model === activeModel}
              onActivate={() => onActivate(sm.provider, sm.model)}
              onRemove={() => handleRemove(sm)}
            />
          ))}
        </div>
      )}

      <Button variant="secondary" size="sm" className="mt-2" onClick={() => onAddAnother(conn.provider)}>
        + Add Model
      </Button>

      {error && <p className="text-sm text-danger mt-2">{error}</p>}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect provider"
        description={`This will remove ${conn.provider} and all its saved models. Continue?`}
        confirmLabel="Disconnect"
        variant="destructive"
        onConfirm={() => onDisconnect(conn.id)}
      />
    </div>
  );
}
