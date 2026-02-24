import { useState, useEffect, useCallback } from 'react';
import api from '@/api';
import type { ProviderConnection } from '@/types';

export default function useProviderConnections(profileId: number | undefined, skip = false) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);

  const refresh = useCallback(() => {
    if (!profileId || skip) {
      setConnections([]);
      return;
    }
    api.listProviderConnections(profileId)
      .then(setConnections)
      .catch(() => setConnections([]));
  }, [profileId, skip]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addConnection = useCallback(async (provider: string, apiBase: string | null = null): Promise<ProviderConnection | null> => {
    if (!profileId) return null;
    const body: { provider: string; api_base?: string } = { provider };
    if (apiBase) body.api_base = apiBase;
    const added = await api.addProviderConnection(profileId, body);
    setConnections(prev => {
      const filtered = prev.filter(c => c.provider !== provider);
      return [...filtered, added];
    });
    return added;
  }, [profileId]);

  const removeConnection = useCallback(async (connectionId: number) => {
    if (!profileId) return;
    await api.deleteProviderConnection(profileId, connectionId);
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  }, [profileId]);

  return { connections, addConnection, removeConnection, refresh };
}
