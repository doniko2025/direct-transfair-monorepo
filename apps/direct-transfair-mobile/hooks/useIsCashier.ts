// apps/direct-transfair-mobile/hooks/useIsCashier.ts
// Lot 13 — vrai si la personne est caissier actif d'au moins un commerce (affiche l'entrée « Caisse » du profil).
// Un échec réseau ne montre simplement pas l'entrée : rien ne casse.

import { useEffect, useState } from "react";
import { api } from "../services/api";

export function useIsCashier(enabled: boolean, userId?: string | null): boolean {
  const [is, setIs] = useState(false);
  useEffect(() => {
    if (!enabled || !userId) { setIs(false); return; }
    let alive = true;
    api.getStaffMemberships().then((l) => { if (alive) setIs(l.length > 0); }).catch(() => { if (alive) setIs(false); });
    return () => { alive = false; };
  }, [enabled, userId]);
  return is;
}
