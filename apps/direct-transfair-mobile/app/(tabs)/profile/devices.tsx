// apps/direct-transfair-mobile/app/(tabs)/profile/devices.tsx
// =========================================================
// DEVICES v8.0 — Direct Transf'air
// ✅ v8.0 : « SESSIONS OUVERTES » (GET /auth/sessions) — la vraie liste des endroits où le compte est connecté.
//    - Cartes animées (apparition échelonnée), « Cet appareil » repéré par le serveur (identifiant de session du jeton),
//      plus de devinette « le plus récemment utilisé ».
//    - « Déconnecter » ferme réellement la session (le jeton d'accès et le renouvellement sont refusés aussitôt).
//    - « Déconnecter tous les autres appareils » en un geste.
//    - Avant, « Déconnecter » ne touchait que la fiche d'appareil (notifications) : la session restait ouverte, et
//      l'identifiant envoyé (fiche) n'était pas celui que le serveur cherchait (matériel) → rien n'était révoqué.
//      Le serveur accepte désormais les deux et ferme aussi les sessions liées.
//    - La liste des appareils de notifications reste dessous, renommée « Appareils (notifications) ».
// ✅ v7.0 : thème clair, chargement borné via useLoader (20 s) avec squelette et « Réessayer ».
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "../../../components/ui/Icon";
import { api } from "../../../services/api";
import { describeSession, type UserSession } from "../../../services/sessionLabel";
import { useLoader } from "../../../components/wallet/useLoader";
import {
  Button, EmptyView, ErrorView, ListRow, NavBar, Notice, Screen, SectionHeader, SkeletonRows, SlowNote, StatusDot, UText, useUI,
} from "../../../components/ui";

// ─── Icône selon plateforme ───────────────────────────────
function platformIcon(platform?: string): string {
  const p = (platform ?? "").toUpperCase();
  if (p === "WEB") return "desktop-outline";
  if (p === "DESKTOP") return "laptop-outline";
  return "phone-portrait-outline";
}

function errText(e: any, fallback: string): string {
  const raw = e?.response?.data?.message ?? e?.message ?? fallback;
  return Array.isArray(raw) ? String(raw[0]) : String(raw);
}

// ─── Formatage date relative ──────────────────────────────
function relativeTime(isoDate?: string | null): string {
  if (!isoDate) return "Date inconnue";
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    if (diff < 60_000) return "En ligne maintenant";
    if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
    if (diff < 604_800_000) return `Il y a ${Math.floor(diff / 86_400_000)} jour${Math.floor(diff / 86_400_000) > 1 ? "s" : ""}`;
    return new Date(isoDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "Date inconnue"; }
}

function sinceText(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ─── Carte de session (apparition échelonnée) ─────────────
function SessionCard({
  session, index, busy, onRevoke,
}: { session: UserSession; index: number; busy: boolean; onRevoke: (s: UserSession) => void }) {
  const { C, R } = useUI();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 320, delay: Math.min(index, 8) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const label = describeSession(session);
  const meta = [`Connecté ${sinceText(session.createdAt)}`, session.ipAddress, session.country].filter(Boolean).join(" · ");

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        marginTop: 10,
      }}
    >
      <View
        style={{
          backgroundColor: session.current ? C.accentSoft : C.surface,
          borderRadius: R.lg,
          borderWidth: 1.5,
          borderColor: session.current ? C.accent : C.line,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: session.current ? C.surface : C.beige, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={(label.kind === "mobile" ? "phone-portrait-outline" : "desktop-outline") as any} size={22} color={C.dark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="bodyStrong" numberOfLines={1}>{label.title}</UText>
          <UText v="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>{meta}</UText>
          {session.current && (
            <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
              <StatusDot color={C.pos} label="Cet appareil" />
            </View>
          )}
        </View>
        {!session.current && (
          <Pressable
            onPress={() => onRevoke(session)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Déconnecter ${label.title}`}
            style={({ pressed }) => ({
              minWidth: 104, height: 38, paddingHorizontal: 12, borderRadius: 19, alignItems: "center", justifyContent: "center",
              backgroundColor: C.dangerBg, opacity: pressed ? 0.7 : 1,
            })}
          >
            {busy ? <ActivityIndicator size="small" color={C.danger} /> : <UText v="label" color={C.danger}>Déconnecter</UText>}
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default function DevicesScreen() {
  const { C } = useUI();
  const router = useRouter();

  const sessionsLoader = useLoader<UserSession[]>(async () => {
    const list = await api.getSessions();
    return Array.isArray(list) ? list : [];
  });
  const devicesLoader = useLoader<any[]>(async () => {
    const list = await api.getDevices();
    return Array.isArray(list) ? list : [];
  });

  const sessions = sessionsLoader.data ?? [];
  const devices = devicesLoader.data ?? [];

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});
  const [revokingAll, setRevokingAll] = useState(false);

  // Appareil de notifications actuel : identifiant matériel stocké au démarrage
  useEffect(() => {
    AsyncStorage.getItem("deviceId")
      .then((id) => { if (id) setCurrentId(id); })
      .catch(() => {});
  }, []);

  const refreshAll = async () => { await Promise.all([sessionsLoader.refresh(), devicesLoader.refresh()]); };

  // ── Sessions ────────────────────────────────────────────
  const handleRevokeSession = (s: UserSession) => {
    const name = describeSession(s).title;
    Alert.alert("Déconnecter cet appareil", `Voulez-vous fermer la session « ${name} » ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnecter",
        style: "destructive",
        onPress: async () => {
          setRevoking((p) => ({ ...p, [s.id]: true }));
          try {
            await api.revokeSession(s.id);
            await sessionsLoader.refresh();
          } catch (e: any) {
            Alert.alert("Erreur", errText(e, "Erreur lors de la déconnexion"));
          } finally {
            setRevoking((p) => ({ ...p, [s.id]: false }));
          }
        },
      },
    ]);
  };

  const others = sessions.filter((s) => !s.current);

  const handleRevokeOthers = () => {
    Alert.alert(
      "Déconnecter les autres appareils",
      `${others.length} session${others.length > 1 ? "s seront fermées" : " sera fermée"}. Cet appareil reste connecté.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout déconnecter",
          style: "destructive",
          onPress: async () => {
            setRevokingAll(true);
            try {
              const r = await api.revokeOtherSessions();
              await sessionsLoader.refresh();
              Alert.alert("C'est fait", r.revoked > 0 ? `${r.revoked} appareil${r.revoked > 1 ? "s déconnectés" : " déconnecté"}.` : "Aucun autre appareil connecté.");
            } catch (e: any) {
              Alert.alert("Erreur", errText(e, "Erreur lors de la déconnexion"));
            } finally {
              setRevokingAll(false);
            }
          },
        },
      ],
    );
  };

  // ── Appareils de notifications ──────────────────────────
  const handleRevokeDevice = (device: any) => {
    const name = device.deviceName ?? device.deviceModel ?? "cet appareil";
    Alert.alert(
      "Retirer cet appareil",
      `Plus aucune notification ne sera envoyée à "${name}", et ses sessions liées seront fermées.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: async () => {
            setRevoking((prev) => ({ ...prev, [device.id]: true }));
            try {
              await api.revokeDevice(device.id);
              await refreshAll();
            } catch (e: any) {
              Alert.alert("Erreur", errText(e, "Erreur lors de la déconnexion"));
            } finally {
              setRevoking((prev) => ({ ...prev, [device.id]: false }));
            }
          },
        },
      ],
    );
  };

  const sortedDevices = [...devices].sort((a, b) => {
    const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return tb - ta;
  });
  const currentDevice = currentId ? sortedDevices.find((d) => d.id === currentId || d.deviceId === currentId) : undefined;
  const otherDevices = sortedDevices.filter((d) => d.id !== currentDevice?.id);

  const loading = sessionsLoader.status === "loading";
  const failed = sessionsLoader.status === "error";

  const subtitle = loading
    ? "Chargement…"
    : `${sessions.length} session${sessions.length > 1 ? "s" : ""} ouverte${sessions.length > 1 ? "s" : ""}`;

  const deviceRow = (device: any, isCurrent: boolean, last: boolean) => {
    const st = String(device.status ?? "").toUpperCase();
    const revoked = st === "REVOKED";
    const label = device.deviceName ?? device.deviceModel ?? `Appareil ${device.platform ?? "inconnu"}`;
    const detail = [device.osVersion, device.ipAddress, relativeTime(device.lastUsedAt)].filter(Boolean).join(" · ");
    return (
      <ListRow
        key={device.id}
        icon={platformIcon(device.platform)}
        title={label}
        subtitle={detail}
        last={last}
        style={revoked ? { opacity: 0.5 } : undefined}
        right={
          isCurrent ? (
            <StatusDot color={C.pos} label="Cet appareil" />
          ) : (
            <Pressable
              onPress={() => handleRevokeDevice(device)}
              disabled={!!revoking[device.id] || revoked}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${label}`}
              style={({ pressed }) => ({
                minWidth: 96, height: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: "center", justifyContent: "center",
                backgroundColor: C.dangerBg, opacity: pressed ? 0.7 : 1,
              })}
            >
              {revoking[device.id] ? (
                <ActivityIndicator size="small" color={C.danger} />
              ) : (
                <UText v="label" color={C.danger}>{revoked ? "Retiré" : "Retirer"}</UText>
              )}
            </Pressable>
          )
        }
      />
    );
  };

  return (
    <Screen
      header={<NavBar title="Appareils connectés" subtitle={subtitle} onBack={() => router.back()} />}
      refreshing={sessionsLoader.refreshing || devicesLoader.refreshing}
      onRefresh={() => void refreshAll()}
    >
      {loading ? (
        <>
          <SlowNote visible={sessionsLoader.slow} />
          <SkeletonRows rows={3} />
        </>
      ) : failed ? (
        <ErrorView
          title={sessionsLoader.error?.title ?? "Chargement impossible"}
          message={sessionsLoader.error?.message ?? "Réessaie dans un instant."}
          onRetry={() => void refreshAll()}
        />
      ) : (
        <>
          <Notice tone="info" icon="shield-outline">
            Voici les appareils où ton compte est ouvert. Déconnecte ceux que tu ne reconnais pas, puis change ton code secret.
          </Notice>

          <SectionHeader title="Sessions ouvertes" />
          {sessions.length === 0 ? (
            <EmptyView icon="phone-portrait-outline" title="Aucune session ouverte" />
          ) : (
            sessions.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} busy={!!revoking[s.id]} onRevoke={handleRevokeSession} />
            ))
          )}

          {others.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Button
                label="Déconnecter tous les autres appareils"
                icon="log-out-outline"
                kind="danger"
                onPress={handleRevokeOthers}
                loading={revokingAll}
                disabled={revokingAll}
              />
            </View>
          )}

          {devicesLoader.status === "ready" && sortedDevices.length > 0 && (
            <>
              <SectionHeader title="Appareils (notifications)" />
              {currentDevice && deviceRow(currentDevice, true, otherDevices.length === 0)}
              {otherDevices.map((d, i) => deviceRow(d, false, i === otherDevices.length - 1))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
