// apps/direct-transfair-mobile/app/(tabs)/profile/devices.tsx
// =========================================================
// DEVICES v7.0 — Direct Transf'air
// ✅ v7.0 : REFONTE THÈME CLAIR — grand titre, bandeau d'information, « Appareil actuel »
//    puis « Autres appareils » en lignes à filet (pastille d'icône beige, point de statut),
//    bouton « Déconnecter » discret en rouge. Chargement borné via useLoader (20 s,
//    EXPO_PUBLIC_LOAD_TIMEOUT_MS) avec squelette, message d'attente et « Réessayer ».
//    Plus aucune teinte par rôle codée en dur. Police système.
//    LOGIQUE INCHANGÉE (GET /auth/devices via api.getDevices, api.revokeDevice, appareil
//    actuel = deviceId en AsyncStorage sinon le plus récemment utilisé, confirmation
//    avant déconnexion, rechargement après révocation).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v6.1 : WHITE-LABEL + chargement BORNÉ (20 s) : message clair + « Réessayer ».
// ✅ v6.0 : Zéro donnée en dur — tout vient de GET /auth/devices.
// =========================================================

import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../../services/api";
import { useLoader } from "../../../components/wallet/useLoader";
import {
  EmptyView, ErrorView, ListRow, NavBar, Notice, Screen, SectionHeader, SkeletonRows, SlowNote, StatusDot, UText, useUI,
} from "../../../components/ui";

// ─── Icône selon plateforme ───────────────────────────────
function platformIcon(platform?: string): string {
  const p = (platform ?? "").toUpperCase();
  if (p === "WEB") return "desktop-outline";
  if (p === "DESKTOP") return "laptop-outline";
  return "phone-portrait-outline";
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

export default function DevicesScreen() {
  const { C } = useUI();
  const router = useRouter();

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<any[]>(async () => {
    const list = await api.getDevices();
    return Array.isArray(list) ? list : [];
  });
  const devices = data ?? [];

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});

  // Appareil actuel : identifiant stocké au démarrage
  useEffect(() => {
    AsyncStorage.getItem("deviceId")
      .then((id) => { if (id) setCurrentId(id); })
      .catch(() => {});
  }, []);

  const handleRevoke = (device: any) => {
    const name = device.deviceName ?? device.deviceModel ?? "cet appareil";
    Alert.alert(
      "Déconnecter cet appareil",
      `Voulez-vous déconnecter "${name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            setRevoking((prev) => ({ ...prev, [device.id]: true }));
            try {
              await api.revokeDevice(device.id);
              await refresh();
            } catch (e: any) {
              const raw = e?.response?.data?.message ?? e?.message ?? "Erreur lors de la déconnexion";
              Alert.alert("Erreur", Array.isArray(raw) ? raw[0] : String(raw));
            } finally {
              setRevoking((prev) => ({ ...prev, [device.id]: false }));
            }
          },
        },
      ],
    );
  };

  // Appareil actuel = id stocké, sinon le plus récemment utilisé
  const sorted = [...devices].sort((a, b) => {
    const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return tb - ta;
  });
  const currentDevice = currentId ? sorted.find((d) => d.id === currentId || d.deviceId === currentId) : sorted[0];
  const otherDevices = sorted.filter((d) => d.id !== currentDevice?.id);

  const subtitle =
    status === "loading"
      ? "Chargement…"
      : `${devices.length} appareil${devices.length > 1 ? "s" : ""}${otherDevices.length > 0 ? ` · ${otherDevices.length} autre${otherDevices.length > 1 ? "s" : ""}` : ""}`;

  const row = (device: any, isCurrent: boolean, last: boolean) => {
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
            <StatusDot color={C.pos} label="Actif" />
          ) : (
            <Pressable
              onPress={() => handleRevoke(device)}
              disabled={!!revoking[device.id] || revoked}
              accessibilityRole="button"
              accessibilityLabel={`Déconnecter ${label}`}
              style={({ pressed }) => ({
                minWidth: 104, height: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: "center", justifyContent: "center",
                backgroundColor: C.dangerBg, opacity: pressed ? 0.7 : 1,
              })}
            >
              {revoking[device.id] ? (
                <ActivityIndicator size="small" color={C.danger} />
              ) : (
                <UText v="label" color={C.danger}>{revoked ? "Révoqué" : "Déconnecter"}</UText>
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
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {status === "loading" ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={3} />
        </>
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? "Chargement impossible"} message={error?.message ?? "Réessaie dans un instant."} onRetry={() => void reload()} />
      ) : (
        <>
          <Notice tone="info" icon="shield-outline">
            Gère les appareils ayant accès à ton compte. Déconnecte ceux que tu ne reconnais pas.
          </Notice>

          {currentDevice && (
            <>
              <SectionHeader title="Appareil actuel" />
              {row(currentDevice, true, true)}
            </>
          )}

          {otherDevices.length > 0 && (
            <>
              <SectionHeader title="Autres appareils" />
              {otherDevices.map((d, i) => row(d, false, i === otherDevices.length - 1))}
            </>
          )}

          {devices.length === 0 && (
            <EmptyView icon="phone-portrait-outline" title="Aucun appareil enregistré" />
          )}
        </>
      )}
    </Screen>
  );
}
