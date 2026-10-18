// apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// =========================================================
// LOCATIONS v7.0 — Direct Transf'air
// ✅ v7.0 : REFONTE THÈME CLAIR — grand titre, cartes d'agence blanches arrondies (pastille
//    d'icône beige, point de statut « Ouvert / Fermé », devise en pastille), contacts
//    téléphone / email cliquables en puces. Chargement borné via useLoader (20 s) avec
//    squelette, message d'attente et « Réessayer ». Plus de teintes par rôle codées en dur
//    (bleu / ambre / vert) : tout suit la marque du tenant. Police système.
//    LOGIQUE INCHANGÉE (GET /locations uniquement, 401/403 silencieux, formats de réponse
//    tableau | {data} | {items}, tel: / mailto: via Linking, affichage conditionnel des
//    contacts, nom de la société = branding.name).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v6.5 : WHITE-LABEL + chargement borné (20 s).
// ✅ v6.4 (phase 6) : la liste vient uniquement de GET /locations (agences de la société,
//    champs publics) ; l'email d'une agence n'est plus servi (identifiant de connexion).
// ✅ v6.3 : téléphone / email cliquables, affichage conditionnel.
// ✅ v6.2 : fetchAgencies multi-endpoints, 403 silencieux.
// =========================================================

import React from "react";
import { Linking, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Agency } from "../../../services/types";
import { useAuth } from "../../../providers/AuthProvider";
import { useTenant } from "../../../providers/TenantProvider";
import { api } from "../../../services/api";
import { useLoader } from "../../../components/wallet/useLoader";
import {
  Card, EmptyView, ErrorView, NavBar, Pill, Screen, SectionHeader, SkeletonRows, SlowNote, StatusDot, UText, useUI,
} from "../../../components/ui";

// Phase 6 : la liste des agences de la société (champs publics) est servie par /locations,
// avec l'en-tête x-tenant-id que l'application envoie déjà.
const AGENCY_ENDPOINTS = ["/locations"] as const;

function unwrapAgencies(raw: unknown): Agency[] {
  if (Array.isArray(raw)) return raw as Agency[];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as Agency[];
    if (Array.isArray(r.items)) return r.items as Agency[];
  }
  return [];
}

// Ouvre tel: ou mailto: sans crash
async function openLink(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  } catch { /* noop */ }
}

export default function LocationsScreen() {
  const { C, R } = useUI();
  const { branding } = useTenant();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? "USER";

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<Agency[]>(async () => {
    let found: Agency[] = [];
    let allForbidden = true;
    for (const endpoint of AGENCY_ENDPOINTS) {
      try {
        const res = await api.http.get<unknown>(endpoint);
        found = unwrapAgencies(res.data);
        allForbidden = false;
        break;
      } catch (err: any) {
        const st = err?.response?.status as number | undefined;
        if (st === 403 || st === 401) continue;
        throw err;
      }
    }
    return allForbidden ? [] : found;
  });
  const agencies = data ?? [];

  const subtitle =
    status === "loading"
      ? "Chargement…"
      : status === "error"
        ? "Erreur de chargement"
        : agencies.length === 0
          ? "Aucun point disponible pour le moment"
          : `${agencies.length} point${agencies.length > 1 ? "s" : ""} ${branding.name}`;

  const chip = (icon: string, label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: R.pill,
        backgroundColor: C.beige, maxWidth: "100%", opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon as any} size={14} color={C.ink} />
      <UText v="label" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</UText>
    </Pressable>
  );

  return (
    <Screen
      header={<NavBar title="Nos agences" subtitle={subtitle} onBack={() => router.back()} />}
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
      ) : agencies.length === 0 ? (
        <EmptyView
          icon="storefront-outline"
          title="Aucune agence disponible"
          message={`Les points ${branding.name} apparaîtront ici dès leur ouverture.`}
        />
      ) : (
        <>
          <SectionHeader title={role === "SUPER_ADMIN" ? "Toutes les agences" : "Points de service"} style={{ marginTop: 4, marginBottom: 12 }} />
          {agencies.map((item) => {
            const ag = item as any;
            // Champs contact — plusieurs noms possibles selon le backend
            const phone = ag.phone || ag.phoneNumber || ag.tel || null;
            const email = ag.email || ag.contactEmail || null;
            const address = [ag.address, item.city, item.country].filter(Boolean).join(", ");
            return (
              <Card key={String(item.id)} style={{ marginBottom: 12 }} pad={18}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="location" size={21} color={C.ink} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <UText v="subheading" numberOfLines={1}>{item.name}</UText>
                    {!!address && <UText v="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>{address}</UText>}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                      <StatusDot color={item.isActive ? C.pos : C.danger} label={item.isActive ? "Ouvert" : "Fermé"} />
                      {role === "SUPER_ADMIN" && ag.clientName ? <Pill label={String(ag.clientName)} tone="neutral" /> : null}
                    </View>
                  </View>
                  {!!item.primaryCurrency && <Pill label={item.primaryCurrency} tone="neutral" />}
                </View>

                {(phone || email) && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line }}>
                    {phone ? chip("call-outline", String(phone), () => openLink(`tel:${String(phone).replace(/\s/g, "")}`)) : null}
                    {email ? chip("mail-outline", String(email), () => openLink(`mailto:${email}`)) : null}
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
