import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function useSavedModels(profileId) {
  const [savedModels, setSavedModels] = useState([]);
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

  const addModel = useCallback(async (provider, model) => {
    if (!profileId) return;
    const added = await api.addProfileModel(profileId, { provider, model });
    setSavedModels(prev => {
      // Replace if same provider+model already exists, otherwise append
      const filtered = prev.filter(m => !(m.provider === provider && m.model === model));
      return [...filtered, added];
    });
    return added;
  }, [profileId]);

  const removeModel = useCallback(async (modelId) => {
    if (!profileId) return;
    await api.deleteProfileModel(profileId, modelId);
    setSavedModels(prev => prev.filter(m => m.id !== modelId));
  }, [profileId]);

  return { savedModels, loading, refresh, addModel, removeModel };
}
