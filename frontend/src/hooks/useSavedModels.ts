import { useState, useEffect, useCallback } from 'react';
import api from '@/api';
import type { SavedModel } from '@/types';

export default function useSavedModels(profileId: number | undefined) {
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!profileId) {
      setSavedModels([]);
      return;
    }
    setLoading(true);
    api.listProfileModels(profileId)
      .then(setSavedModels)
      .catch(() => setSavedModels([]))
      .finally(() => setLoading(false));
  }, [profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addModel = useCallback(async (provider: string, model: string): Promise<SavedModel | undefined> => {
    if (!profileId) return;
    const body = { provider, model };
    const added = await api.addProfileModel(profileId, body);
    setSavedModels(prev => {
      const filtered = prev.filter(m => !(m.provider === provider && m.model === model));
      return [...filtered, added];
    });
    return added;
  }, [profileId]);

  const removeModel = useCallback(async (modelId: number) => {
    if (!profileId) return;
    await api.deleteProfileModel(profileId, modelId);
    setSavedModels(prev => prev.filter(m => m.id !== modelId));
  }, [profileId]);

  return { savedModels, loading, refresh, addModel, removeModel };
}
