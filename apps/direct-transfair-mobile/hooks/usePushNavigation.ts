// apps/direct-transfair-mobile/hooks/usePushNavigation.ts
// =========================================================
// Ouvre l'écran voulu quand l'utilisateur touche une notification push (app en arrière-plan ou fermée).
// Sans effet sur le web ni quand expo-notifications est indisponible. Développé par Thierno Doniko — Doniko Digital.
// =========================================================

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { resolveActionUrl } from "../services/notificationRouting";
import { useAccountSpace } from "./useAccountSpace";

export function usePushNavigation(enabled: boolean) {
  const router = useRouter();
  // Comptes séparés : toucher une notification du compte marchand ouvre l'application sur CE compte (et inversement).
  const { switchTo } = useAccountSpace();
  const switchRef = useRef(switchTo);
  switchRef.current = switchTo;
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    const open = (data: unknown) => {
      const d = (data as { actionUrl?: unknown; space?: unknown } | null) ?? {};
      const target = resolveActionUrl(d.actionUrl);
      if (!target) return;
      const space = d.space === "merchant" || d.space === "client" ? d.space : /^\/merchant(\/|\?|$)/.test(String(target)) ? "merchant" : null;
      if (space) switchRef.current(space);
      router.push(target as any);
    };
    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
      // Application lancée par le toucher d'une notification.
      Notifications.getLastNotificationResponseAsync?.()
        .then((r) => { if (r) open(r.notification.request.content.data); })
        .catch(() => { /* sans incidence */ });
    } catch { /* module indisponible (simulateur, Expo Go) */ }
    return () => { try { sub?.remove(); } catch { /* noop */ } };
  }, [enabled, router]);
}
