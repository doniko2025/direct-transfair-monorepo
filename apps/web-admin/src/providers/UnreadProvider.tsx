// src/providers/UnreadProvider.tsx
// Nombre de notifications non lues : alimente la pastille du menu et se rafraîchit toutes les minutes,
// quand l'onglet revient au premier plan, et à la demande (page Notifications).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

interface UnreadValue {
  unread: number;
  refresh: () => void;
}

const UnreadContext = createContext<UnreadValue>({ unread: 0, refresh: () => undefined });

const EVERY_MS = 60_000;

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const alive = useRef(true);

  const refresh = useCallback(() => {
    // Une erreur (réseau, serveur) laisse le dernier nombre connu : une pastille ne vaut pas une alerte.
    api.notifications
      .unreadCount()
      .then((r) => {
        if (alive.current && typeof r?.count === 'number') setUnread(r.count);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    alive.current = true;
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): UnreadValue {
  return useContext(UnreadContext);
}
