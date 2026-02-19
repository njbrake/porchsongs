import { useState, useCallback } from 'react';

export default function useLocalStorage(key: string, initialValue: string): [string, (value: string) => void] {
  const [storedValue, setStoredValue] = useState<string>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? item : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: string) => {
    setStoredValue(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }, [key]);

  return [storedValue, setValue];
}
