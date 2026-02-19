import { useState, useEffect, useCallback } from 'react';
import type { PharmacySettings } from '@/types';
import { getSettings, updateSettings } from '@/db/queries/settings';

/**
 * Hook to access pharmacy settings from any component.
 * Loads settings from DB on mount and provides an update function.
 */
export function useSettings() {
  const [settings, setSettings] = useState<PharmacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async (data: Parameters<typeof updateSettings>[0]) => {
    await updateSettings(data);
    await loadSettings();
  }, [loadSettings]);

  return { settings, loading, error, saveSettings, refetch: loadSettings };
}
