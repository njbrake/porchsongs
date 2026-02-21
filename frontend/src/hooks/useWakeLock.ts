import { useState, useEffect, useCallback, useRef } from 'react';
import NoSleep from 'nosleep.js';
import { STORAGE_KEYS } from '@/api';

const hasNativeWakeLock = 'wakeLock' in navigator;

export default function useWakeLock() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEYS.WAKE_LOCK) === 'true');
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const noSleepRef = useRef<NoSleep | null>(null);

  const getNoSleep = useCallback(() => {
    if (!noSleepRef.current) noSleepRef.current = new NoSleep();
    return noSleepRef.current;
  }, []);

  const acquire = useCallback(async () => {
    if (hasNativeWakeLock) {
      try {
        sentinelRef.current = await navigator.wakeLock.request('screen');
        setActive(true);
        sentinelRef.current.addEventListener('release', () => {
          setActive(false);
        });
      } catch {
        setActive(false);
      }
    } else {
      try {
        await getNoSleep().enable();
        setActive(true);
      } catch {
        setActive(false);
      }
    }
  }, [getNoSleep]);

  const release = useCallback(async () => {
    if (hasNativeWakeLock) {
      if (sentinelRef.current) {
        await sentinelRef.current.release();
        sentinelRef.current = null;
      }
    } else {
      getNoSleep().disable();
    }
    setActive(false);
  }, [getNoSleep]);

  // Acquire/release when enabled changes
  useEffect(() => {
    if (enabled) {
      acquire();
    } else {
      release();
    }
    return () => { release(); };
  }, [enabled, acquire, release]);

  // Re-acquire when tab becomes visible again (browser releases on hide)
  useEffect(() => {
    if (!enabled) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [enabled, acquire]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.WAKE_LOCK, String(next));
      return next;
    });
  }, []);

  return { enabled, active, supported: true, toggle };
}
