// src/providers/UrgentProvider.tsx
// Alertes urgentes (dossiers à valider, litiges, remboursements, retraits, signalements…).
// Source : les compteurs que le serveur calcule déjà ; rafraîchis toutes les 45 s, au retour sur l'onglet et à la demande.
// Mémoire : par utilisateur, dans le stockage local du navigateur (voir lib/urgentRules.ts : « déjà vu » par catégorie).
// Une panne réseau laisse les derniers compteurs : une alerte ne doit jamais disparaître à cause d'une coupure.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { can, type WebRole } from '@direct-transfair/shared';
import { api } from '../lib/api';
import { needsAttention } from '../lib/dashboardRules';
import {
  parseSeen,
  reconcileSeen,
  totalFresh,
  visibleItems,
  type UrgentCounts,
  type UrgentItem,
  type UrgentKind,
  type UrgentSeen,
} from '../lib/urgentRules';
import { useCurrentUser } from './AuthProvider';

interface UrgentValue {
  items: UrgentItem[];
  /** Nombre total de nouvelles demandes (pastille, titre de l'onglet). */
  fresh: number;
  /** Cache l'alerte de cette catégorie jusqu'à l'arrivée d'une nouvelle demande. */
  dismiss: (kind: UrgentKind) => void;
  dismissAll: () => void;
  refresh: () => void;
}

const UrgentContext = createContext<UrgentValue>({ items: [], fresh: 0, dismiss: () => undefined, dismissAll: () => undefined, refresh: () => undefined });

const EVERY_MS = 45_000;
const storageKey = (userId: string | number): string => `dt.urgent.seen.${userId}`;

function readSeen(userId: string | number): UrgentSeen {
  try {
    return parseSeen(window.localStorage.getItem(storageKey(userId)));
  } catch {
    return {};
  }
}

function writeSeen(userId: string | number, seen: UrgentSeen): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(seen));
  } catch {
    /* stockage plein ou interdit : l'alerte réapparaîtra au prochain chargement, sans gravité */
  }
}

const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

export function UrgentProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const role = user.role as WebRole;
  const userId = user.id;
  const permKey = (user.supportPermissions ?? []).join(',');

  const [counts, setCounts] = useState<UrgentCounts>({});
  const [seen, setSeen] = useState<UrgentSeen>(() => readSeen(userId));
  const alive = useRef(true);
  const countsRef = useRef<UrgentCounts>({});

  // Changement de compte sur le même navigateur : on repart de la mémoire de ce compte.
  useEffect(() => {
    setSeen(readSeen(userId));
    setCounts({});
    countsRef.current = {};
  }, [userId]);

  const load = useCallback(async () => {
    const next: UrgentCounts = {};
    const jobs: Promise<void>[] = [];
    const isAdmin = role === 'COMPANY_ADMIN';

    if (role === 'SUPER_ADMIN') {
      jobs.push(
        safe(api.supervision.overview()).then((o) => {
          if (o) next.alerts = o.alerts.critical;
        }),
      );
    }

    if (isAdmin || role === 'SUPPORT') {
      jobs.push(
        safe(api.support.overview()).then((o) => {
          const c = o?.counts;
          if (!c) return;
          if (c.disputes != null) next.disputes = c.disputes;
          // « tickets » inclut les litiges : on ne garde que les demandes ordinaires pour ne pas compter deux fois.
          if (c.tickets != null) next.tickets = Math.max(0, c.tickets - (c.disputes ?? 0));
          if (c.refunds != null) next.refunds = c.refunds;
          if (c.kyc != null) next.kyc = c.kyc;
        }),
      );
    }

    if (isAdmin) {
      jobs.push(
        safe(api.merchants.payouts({ status: 'PENDING', limit: 1 })).then((r) => {
          if (r && typeof r.pendingCount === 'number') next.payouts = r.pendingCount;
        }),
        safe(api.transactions.listAdmin()).then((list) => {
          if (Array.isArray(list)) next.flagged = list.filter((t) => Boolean(t.isFlagged) && needsAttention(t)).length;
        }),
      );
    }

    // Les administrateurs qui n'ont pas la vue « service client » complète : KYC directement.
    if (role === 'SUPER_ADMIN' && can(user, 'KYC_REVIEW')) {
      jobs.push(
        safe(api.kyc.adminStats()).then((s) => {
          if (s) next.kyc = s.pending;
        }),
      );
    }

    await Promise.all(jobs);
    if (!alive.current) return;

    // Une catégorie dont la lecture a échoué garde sa dernière valeur connue.
    const merged: UrgentCounts = { ...countsRef.current, ...next };
    countsRef.current = merged;
    setCounts(merged);
    setSeen((prev) => {
      const reconciled = reconcileSeen(prev, merged);
      if (JSON.stringify(reconciled) !== JSON.stringify(prev)) writeSeen(userId, reconciled);
      return reconciled;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userId, permKey]);

  useEffect(() => {
    alive.current = true;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const dismiss = useCallback(
    (kind: UrgentKind) => {
      setSeen((prev) => {
        const next: UrgentSeen = { ...prev, [kind]: countsRef.current[kind] ?? 0 };
        writeSeen(userId, next);
        return next;
      });
    },
    [userId],
  );

  const dismissAll = useCallback(() => {
    setSeen(() => {
      const next: UrgentSeen = { ...countsRef.current };
      writeSeen(userId, next);
      return next;
    });
  }, [userId]);

  const items = useMemo(() => visibleItems(counts, seen), [counts, seen]);
  const fresh = totalFresh(items);

  const value = useMemo<UrgentValue>(() => ({ items, fresh, dismiss, dismissAll, refresh: () => void load() }), [items, fresh, dismiss, dismissAll, load]);
  return <UrgentContext.Provider value={value}>{children}</UrgentContext.Provider>;
}

export function useUrgent(): UrgentValue {
  return useContext(UrgentContext);
}
