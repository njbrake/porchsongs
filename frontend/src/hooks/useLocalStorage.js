import { useState } from 'react';

export default function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? item : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    setStoredValue(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  };

  return [storedValue, setValue];
}
