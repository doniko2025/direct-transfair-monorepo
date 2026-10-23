// apps/direct-transfair-mobile/app/(tabs)/notifications.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// NOTIFICATIONS v6.2 — Direct Transf'air
// ✅ v6.2 : confirmation de suppression CENTRÉE à l'écran (fenêtre au milieu, plus de feuille en bas) et toast de succès centré
//    (« N notifications supprimées »). Si le serveur répond 404 (route /notifications/delete absente : backend pas encore
//    redéployé), un message explicite remplace l'ancien « Cannot POST … ».
// ✅ v6.1 : SUPPRESSION — bouton corbeille dans l'en-tête (ou appui long sur une notification) : mode sélection avec
//    cases à cocher, « Tout sélectionner », compteur et « Supprimer (N) » ; confirmation dans une fenêtre (Sheet, car
//    Alert.alert à boutons ne fonctionne pas sur le web). Appelle POST /notifications/delete { ids }.
//    Suppression instantanée à l'écran, rechargement si le serveur refuse.
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

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../components/ui/Icon';
import { api } from "../../services/api";
import { withTimeout, explainLoadError, defaultTimeoutMs, type LoadError } from "../../components/wallet/useLoader";
import {
  Button, Chip, EmptyView, ErrorView, IconButton, NavBar, Screen, SkeletonRows, SlowNote, UText, alpha, useUI,
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

  // Sélection / suppression
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

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

  // Ne garde que les notifications qui existent encore (après un rechargement ou une suppression).
  const selectedIds = selected.filter((id) => notifs.some((n) => n.id === id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((n) => selectedIds.includes(n.id));

  const exitSelectMode = () => { setSelectMode(false); setSelected([]); setDeleteError(null); };

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const startSelecting = (id?: string) => {
    setDeleteError(null);
    setSelectMode(true);
    if (id) setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelected((prev) => prev.filter((id) => !filtered.some((n) => n.id === id)));
    else setSelected((prev) => Array.from(new Set([...prev, ...filtered.map((n) => n.id)])));
  };

  const handleDeleteSelected = async () => {
    const ids = selectedIds;
    if (ids.length === 0 || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await withTimeout(api.http.post("/notifications/delete", { ids }), defaultTimeoutMs());
      setNotifs((prev) => prev.filter((n) => !ids.includes(n.id)));
      setConfirmOpen(false);
      exitSelectMode();
      showToast(ids.length > 1 ? `${ids.length} notifications supprimées` : "Notification supprimée");
      void fetchNotifs(); // fait remonter d'éventuelles notifications plus anciennes
    } catch (e) {
      setConfirmOpen(false);
      const status = (e as { response?: { status?: number } })?.response?.status;
      setDeleteError(
        status === 404
          ? "La suppression n'est pas encore disponible sur le serveur. Réessaie un peu plus tard."
          : explainLoadError(e).message,
      );
      void fetchNotifs();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen
      header={
        <NavBar
          title={selectMode ? (selectedIds.length === 0 ? "Sélectionner" : `${selectedIds.length} sélectionnée${selectedIds.length > 1 ? "s" : ""}`) : "Notifications"}
          subtitle={!selectMode && unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : undefined}
          onBack={selectMode ? exitSelectMode : () => router.back()}
          right={
            selectMode ? (
              <IconButton icon="close" label="Annuler la sélection" onPress={exitSelectMode} />
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {notifs.length > 0 && <IconButton icon="trash-outline" label="Supprimer des notifications" onPress={() => startSelecting()} />}
                <IconButton icon="checkmark-done" label="Tout marquer comme lu" onPress={handleMarkAllAsRead} />
              </View>
            )
          }
        />
      }
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void fetchNotifs(); }}
    >
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <Chip label="Toutes" active={filter === "ALL"} count={notifs.length} onPress={() => setFilter("ALL")} />
        <Chip label="Non lues" active={filter === "UNREAD"} count={unreadCount} onPress={() => setFilter("UNREAD")} />
      </View>

      {!!deleteError && (
        <View style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <UText v="caption" tone="danger">{deleteError}</UText>
        </View>
      )}

      {selectMode && !loading && filtered.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4, paddingVertical: 6 }}>
          <Pressable
            onPress={toggleSelectAll}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allFilteredSelected }}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.6 : 1, flex: 1 })}
          >
            <View style={{
              width: 24, height: 24, borderRadius: 12, borderWidth: 2,
              borderColor: allFilteredSelected ? C.accent : C.lineStrong,
              backgroundColor: allFilteredSelected ? C.accent : "transparent",
              alignItems: "center", justifyContent: "center",
            }}>
              {allFilteredSelected && <Ionicons name="checkmark" size={15} color={C.accentInk} />}
            </View>
            <UText v="bodyStrong">{allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}</UText>
          </Pressable>
          <Button
            label={selectedIds.length > 0 ? `Supprimer (${selectedIds.length})` : "Supprimer"}
            icon="trash-outline"
            kind="danger"
            small
            full={false}
            disabled={selectedIds.length === 0}
            onPress={() => setConfirmOpen(true)}
          />
        </View>
      )}

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
          const checked = selectedIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => (selectMode ? toggleSelected(item.id) : handleMarkAsRead(item.id, item.isRead))}
              onLongPress={() => { if (!selectMode) startSelecting(item.id); }}
              delayLongPress={350}
              accessibilityRole={selectMode ? "checkbox" : "button"}
              accessibilityState={selectMode ? { checked } : undefined}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 16,
                paddingHorizontal: selectMode ? 8 : 0, borderRadius: selectMode ? 14 : 0,
                backgroundColor: checked ? C.accentSoft : "transparent",
                borderBottomWidth: i === filtered.length - 1 || selectMode ? 0 : 1, borderBottomColor: C.line,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {selectMode && (
                <View style={{
                  width: 24, height: 24, borderRadius: 12, borderWidth: 2, marginTop: 10,
                  borderColor: checked ? C.accent : C.lineStrong,
                  backgroundColor: checked ? C.accent : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <Ionicons name="checkmark" size={15} color={C.accentInk} />}
                </View>
              )}
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

      {/* Confirmation : fenêtre centrée */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => { if (!deleting) setConfirmOpen(false); }} statusBarTranslucent>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]}
            onPress={() => { if (!deleting) setConfirmOpen(false); }}
            accessibilityLabel="Fermer"
          />
          <View
            accessibilityRole="alert"
            style={{ width: "100%", maxWidth: 360, backgroundColor: C.bg, borderRadius: 24, padding: 22, alignItems: "center", gap: 6 }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.dangerBg, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <Ionicons name="trash-outline" size={24} color={C.danger} />
            </View>
            <UText v="title" align="center">
              {selectedIds.length > 1 ? `Supprimer ${selectedIds.length} notifications ?` : "Supprimer cette notification ?"}
            </UText>
            <UText v="body" tone="muted" align="center" style={{ marginBottom: 14 }}>
              {selectedIds.length > 1 ? "Ces notifications seront supprimées définitivement." : "Cette notification sera supprimée définitivement."}
            </UText>
            <View style={{ alignSelf: "stretch", gap: 10 }}>
              <Button label="Supprimer" icon="trash-outline" kind="danger" loading={deleting} onPress={handleDeleteSelected} />
              <Button label="Annuler" kind="outline" disabled={deleting} onPress={() => setConfirmOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast de succès : centré à l'écran, disparaît seul */}
      <Modal visible={toast !== null} transparent animationType="fade" statusBarTranslucent>
        <View pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.dark, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 20, maxWidth: 340 }}>
            <Ionicons name="checkmark-circle" size={22} color={C.sun} />
            <UText v="bodyStrong" color={C.darkInk}>{toast ?? ""}</UText>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
