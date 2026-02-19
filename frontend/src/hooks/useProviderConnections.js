import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function useProviderConnections(profileId) {
  const [connections, setConnections] = useState([]);

  const refresh = useCallback(() => {
    if (!profileId) {
      setConnections([]);
      return;
    }
    api.listProviderConnections(profileId)
      .then(setConnections)
      .catch(() => setConnections([]));
  }, [profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addConnection = useCallback(async (provider, apiBase = null) => {
    if (!profileId) return null;
    const body = { provider };
    if (apiBase) body.api_base = apiBase;
    const added = await api.addProviderConnection(profileId, body);
    setConnections(prev => {
      const filtered = prev.filter(c => c.provider !== provider);
      return [...filtered, added];
    });
    return added;
  }, [profileId]);

  const removeConnection = useCallback(async (connectionId) => {
    if (!profileId) return;
    await api.deleteProviderConnection(profileId, connectionId);
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  }, [profileId]);

  return { connections, addConnection, removeConnection, refresh };
}
