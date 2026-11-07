// apps/direct-transfair-mobile/hooks/usePushNavigation.ts
// =========================================================
// Ouvre l'écran voulu quand l'utilisateur touche une notification push (app en arrière-plan ou fermée).
// Sans effet sur le web ni quand expo-notifications est indisponible. Développé par Thierno Doniko — Doniko Digital.
// =========================================================

import { useEffect } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { resolveActionUrl } from "../services/notificationRouting";

export function usePushNavigation(enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    const open = (data: unknown) => {
      const target = resolveActionUrl((data as { actionUrl?: unknown } | null)?.actionUrl);
      if (target) router.push(target as any);
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
