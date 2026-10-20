// apps/direct-transfair-mobile/app/(tabs)/notifications.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// NOTIFICATIONS v6.0 — Direct Transf'air
// ✅ v6.0 : REFONTE THÈME CLAIR — fond crème, puces Toutes / Non lues (noire quand
//    sélectionnée), lignes séparées par un filet avec pastille d'icône beige/teintée,
//    point d'accent pour les non lues, états vide / erreur / chargement du design system.
//    Les teintes par rôle (ambre, indigo, bleu codés en dur) disparaissent : l'accent est
//    la couleur de marque du tenant, les types utilisent la palette sémantique commune.
//    LOGIQUE INCHANGÉE (GET /notifications borné 20 s, PATCH /:id/read, PATCH /read-all,
//    marquage optimiste, notifications déjà chargées conservées en cas d'échec).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.3 : WHITE-LABEL — couleurs suivent la marque ; en-tête commun du wallet.
// ✅ v5.2 : FIX — chargement borné et erreur visible (plus de faux « Aucune notification »).
// ✅ v5.1 : fond neutre unifié sur tous les rôles.
// =========================================================

import React, { useState, useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../components/ui/Icon';
import { api } from "../../services/api";
import { withTimeout, explainLoadError, defaultTimeoutMs, type LoadError } from "../../components/wallet/useLoader";
import {
  Chip, EmptyView, ErrorView, IconButton, NavBar, Screen, SkeletonRows, SlowNote, UText, alpha, useUI,
} from "../../components/ui";

interface NotificationItem {
  id: string; title: string; message: string;
  type: string; createdAt: string; isRead: boolean;
}

function fmtDate(iso: string): string {
  const d = new Date(iso), now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "À l'instant";
  if (diff < 3600000) return `Il y a ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.round(diff / 3600000)} h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const TYPE_ICON: Record<string, string> = {
  SUCCESS: "checkmark-circle",
  WARNING: "alert-circle",
  ERROR: "close-circle",
  INFO: "information-circle",
  TRANSACTION: "swap-horizontal",
  SECURITY: "shield-checkmark",
  MARKETING: "megaphone",
  SYSTEM: "settings",
};

export default function NotificationsScreen() {
  const { C } = useUI();
  const router = useRouter();

  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [slow, setSlow] = useState(false);

  /** Couleurs d'un type : palette sémantique commune, marketing = marque du tenant. */
  const tone = (type: string): { fg: string; bg: string } => {
    switch (type) {
      case "SUCCESS": return { fg: C.pos, bg: C.posBg };
      case "WARNING": return { fg: C.warn, bg: C.warnBg };
      case "ERROR": return { fg: C.danger, bg: C.dangerBg };
      case "TRANSACTION": return { fg: C.violet, bg: C.violetBg };
      case "SECURITY":
      case "INFO": return { fg: C.info, bg: C.infoBg };
      case "MARKETING": return { fg: C.accentDeep, bg: C.accentSoft };
      default: return { fg: C.muted, bg: C.beige };
    }
  };

  const fetchNotifs = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await withTimeout(api.http.get("/notifications"), defaultTimeoutMs());
      let list: NotificationItem[] = [];
      if (Array.isArray(res.data)) list = res.data;
      else if (Array.isArray(res.data?.data)) list = res.data.data;
      else if (Array.isArray(res.data?.notifications)) list = res.data.notifications;
      else if (Array.isArray(res.data?.items)) list = res.data.items;
      setNotifs(list);
    } catch (e) { setLoadError(explainLoadError(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void fetchNotifs(); }, [fetchNotifs]);

  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try { await api.http.patch(`/notifications/${id}/read`); }
    catch { void fetchNotifs(); }
  };

  const handleMarkAllAsRead = async () => {
    if (!notifs.some((n) => !n.isRead)) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await api.http.patch("/notifications/read-all"); }
    catch { void fetchNotifs(); }
  };

  const filtered = filter === "ALL" ? notifs : notifs.filter((n) => !n.isRead);
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <Screen
      header={
        <NavBar
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : undefined}
          onBack={() => router.back()}
          right={<IconButton icon="checkmark-done" label="Tout marquer comme lu" onPress={handleMarkAllAsRead} />}
        />
      }
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void fetchNotifs(); }}
    >
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <Chip label="Toutes" active={filter === "ALL"} count={notifs.length} onPress={() => setFilter("ALL")} />
        <Chip label="Non lues" active={filter === "UNREAD"} count={unreadCount} onPress={() => setFilter("UNREAD")} />
      </View>

      {loading ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={5} />
        </>
      ) : loadError && notifs.length === 0 ? (
        <ErrorView title={loadError.title} message={loadError.message} onRetry={() => { setLoading(true); void fetchNotifs(); }} />
      ) : filtered.length === 0 ? (
        <EmptyView
          icon="notifications-off-outline"
          title="Aucune notification"
          message={filter === "UNREAD" ? "Tu as tout lu ✓" : "Tes alertes apparaîtront ici."}
        />
      ) : (
        filtered.map((item, i) => {
          const t = tone(item.type);
          return (
            <Pressable
              key={item.id}
              onPress={() => handleMarkAsRead(item.id, item.isRead)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 16,
                borderBottomWidth: i === filtered.length - 1 ? 0 : 1, borderBottomColor: C.line,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={(TYPE_ICON[item.type] ?? "notifications") as any} size={21} color={t.fg} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <UText v="bodyStrong" numberOfLines={1} style={{ flex: 1, fontWeight: item.isRead ? "600" : "800" }}>
                    {item.title}
                  </UText>
                  <UText v="caption" tone="muted">{fmtDate(item.createdAt)}</UText>
                </View>
                <UText v="caption" tone="muted" numberOfLines={3} style={{ marginTop: 3, lineHeight: 19 }}>
                  {item.message}
                </UText>
              </View>
              {!item.isRead && (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent, marginTop: 6, borderWidth: 2, borderColor: alpha(C.accent, 0.25) }} />
              )}
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
