// apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// LOCATIONS v8.0 — Direct Transf'air
// ✅ v8.0 : CARTES DE POINTS DE SERVICE compactes et animées — pastille d'icône, nom, adresse, devise, statut, puis puces cliquables
//    Téléphone / Email / Itinéraire. Apparition en cascade (Reveal) et léger effet d'enfoncement au toucher. L'EMAIL de l'agence est
//    affiché : il vient de GET /locations/contacts (réservé aux utilisateurs connectés, société du jeton) ; si cette route n'existe pas
//    encore sur le serveur, on retombe sur GET /locations (sans email). Couleurs 100 % dynamiques (useUI → couleurs du super admin).
//    Le chargement, l'état vide, l'erreur et la logique de repli sont inchangés.
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

import React, { useRef } from "react";
import { Animated, Easing, Linking, Platform, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import type { Agency } from "../../../services/types";
import { useAuth } from "../../../providers/AuthProvider";
import { useTenant } from "../../../providers/TenantProvider";
import { api } from "../../../services/api";
import { useT } from "../../../providers/I18nProvider";
import { useLoader } from "../../../components/wallet/useLoader";
import Reveal from "../../../components/flow/Reveal";
import {
  EmptyView, ErrorView, NavBar, Pill, Screen, SectionHeader, SkeletonRows, SlowNote, StatusDot, UText, useUI,
} from "../../../components/ui";

// v8.0 : d'abord la route « connecté » (avec l'email de l'agence), puis la liste publique (sans email) en repli.
const AGENCY_ENDPOINTS = ["/locations/contacts", "/locations"] as const;

function unwrapAgencies(raw: unknown): Agency[] {
  if (Array.isArray(raw)) return raw as Agency[];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as Agency[];
    if (Array.isArray(r.items)) return r.items as Agency[];
  }
  return [];
}

// Ouvre tel:, mailto: ou une carte sans crash
async function openLink(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  } catch { /* noop */ }
}

const mapsUrl = (query: string) =>
  Platform.OS === "ios"
    ? `http://maps.apple.com/?q=${encodeURIComponent(query)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/** Puce de contact cliquable (téléphone, email, itinéraire). */
function ContactChip({ icon, label, onPress, primary }: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  const { C, R } = useUI();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, height: 32, borderRadius: R.pill,
        backgroundColor: primary ? C.accentSoft : C.beige,
        borderWidth: primary ? 1 : 0, borderColor: C.accentLine,
        maxWidth: "100%", opacity: pressed ? 0.65 : 1,
      })}
    >
      <Ionicons name={icon as any} size={14} color={primary ? C.accentDeep : C.ink} />
      <UText v="label" numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, color: primary ? C.accentDeep : C.ink }}>{label}</UText>
    </Pressable>
  );
}

/** Carte compacte d'un point de service : légère « pression » au toucher. */
function AgencyCard({ item, showCompany }: { item: Agency; showCompany: boolean }) {
  const { C, R, S } = useUI();
  const t = useT();
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

  const ag = item as any;
  const phone = ag.phone || ag.phoneNumber || ag.tel || null;
  const email = ag.email || ag.contactEmail || null;
  const address = [ag.address, item.city, item.country].filter(Boolean).join(", ");

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => press(0.985)}
        onPressOut={() => press(1)}
        accessibilityRole="summary"
        style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, ...S.sm }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="location" size={19} color={C.accentDeep} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <UText v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{item.name}</UText>
              <StatusDot color={item.isActive ? C.pos : C.danger} label={item.isActive ? t("loc.open") : t("loc.closed")} size={6} />
            </View>
            {!!address && <UText v="caption" tone="muted" numberOfLines={1} style={{ marginTop: 1 }}>{address}</UText>}
          </View>
          {!!item.primaryCurrency && <Pill label={item.primaryCurrency} tone="neutral" />}
        </View>

        {showCompany && !!ag.clientName && (
          <View style={{ marginTop: 8, flexDirection: "row" }}><Pill label={String(ag.clientName)} tone="neutral" /></View>
        )}

        {(phone || email || !!address) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {phone ? <ContactChip icon="call-outline" label={String(phone)} onPress={() => openLink(`tel:${String(phone).replace(/\s/g, "")}`)} /> : null}
            {email ? <ContactChip icon="mail-outline" label={String(email)} onPress={() => openLink(`mailto:${email}`)} /> : null}
            {address ? <ContactChip primary icon="navigate-outline" label={t("loc.directions")} onPress={() => openLink(mapsUrl(`${item.name} ${address}`))} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function LocationsScreen() {
  const t = useT();
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
        // « contacts » vide (ex. super admin sans société) ou absent sur un ancien serveur : on essaie la liste publique.
        if (found.length === 0 && endpoint !== AGENCY_ENDPOINTS[AGENCY_ENDPOINTS.length - 1]) { allForbidden = false; continue; }
        allForbidden = false;
        break;
      } catch (err: any) {
        const st = err?.response?.status as number | undefined;
        if (st === 403 || st === 401 || st === 404) continue;
        throw err;
      }
    }
    return allForbidden ? [] : found;
  });
  const agencies = data ?? [];

  const subtitle =
    status === "loading"
      ? t("common.loading")
      : status === "error"
        ? t("loc.loadError")
        : agencies.length === 0
          ? t("loc.none")
          : t("loc.count", { count: agencies.length, brand: branding.name });

  return (
    <Screen
      header={<NavBar title={t("loc.title")} subtitle={subtitle} onBack={() => router.back()} />}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {status === "loading" ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={3} />
        </>
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? t("kycs.loadFail")} message={error?.message ?? t("kycs.retryLater")} onRetry={() => void reload()} />
      ) : agencies.length === 0 ? (
        <EmptyView
          icon="storefront-outline"
          title={t("loc.noneTitle")}
          message={t("loc.noneMsg", { brand: branding.name })}
        />
      ) : (
        <>
          <SectionHeader title={role === "SUPER_ADMIN" ? t("loc.all") : t("loc.points")} style={{ marginTop: 4, marginBottom: 12 }} />
          <View style={{ gap: 10 }}>
            {agencies.map((item, i) => (
              <Reveal key={String(item.id)} delay={Math.min(i, 8) * 70} distance={14}>
                <AgencyCard item={item} showCompany={role === "SUPER_ADMIN"} />
              </Reveal>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
