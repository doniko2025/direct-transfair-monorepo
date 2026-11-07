// src/lib/useDebounced.ts
import { useEffect, useState } from 'react';

/** Valeur retardée : évite un appel serveur à chaque frappe. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
