// apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// LOCATIONS v9.0 — Direct Transf'air
// ✅ v9.0 : (1) RECHERCHE RAPIDE (nom, ville, pays, devise, adresse ; sans accents) + SÉLECTEUR DE PAYS sur la MÊME ligne ; (2) cartes TRÈS compactes : à vue
//    d'œil seulement le nom, le pays et la pastille devise ; (3) un appui sur la carte ouvre une fenêtre avec tout le reste (statut, adresse complète,
//    téléphone, email, itinéraire — chaque ligne est cliquable). Mêmes routes API qu'en v8.0 ; couleurs 100 % dynamiques (useUI).
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

import React, { useMemo, useRef, useState } from "react";
import { Animated, Easing, Linking, Platform, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import type { Agency } from "../../../services/types";
import { useAuth } from "../../../providers/AuthProvider";
import { useTenant } from "../../../providers/TenantProvider";
import { api } from "../../../services/api";
import { useT } from "../../../providers/I18nProvider";
import { useI18n } from "../../../providers/I18nProvider";
import { AUTH_COUNTRIES, fold } from "../../../components/auth/authCountries";
import { ChoiceSheet } from "../../../components/ui/ChoiceSheet";
import { SearchPill } from "../../../components/ui/Field";
import { Button } from "../../../components/ui/Primitives";
import { Sheet } from "../../../components/ui/Layout";
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

// ─── Pays d'une agence ───────────────────────────────────
type CountryInfo = { key: string; label: string; flag: string };

/** Drapeau à partir d'un code ISO à 2 lettres (indicateurs régionaux Unicode). */
const flagFromCode = (code: string) =>
  String.fromCodePoint(...code.toUpperCase().split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** Pays de l'agence : champ `country` (nom ou code ISO) ; à défaut, code de pays en fin d'adresse (« …, SN »). */
function countryOf(ag: any, locale: string): CountryInfo | null {
  let raw = String(ag.country ?? "").trim();
  if (!raw) {
    const m = /(?:,|\s)([A-Za-z]{2})\s*$/.exec(String(ag.address ?? "").trim());
    if (m) raw = m[1]!;
  }
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    let label = code;
    try {
      const dn = new (Intl as any).DisplayNames([locale || "fr"], { type: "region" });
      label = dn.of(code) || code;
    } catch { /* Intl.DisplayNames indisponible : on garde le code */ }
    return { key: code, label, flag: flagFromCode(code) };
  }
  const f = AUTH_COUNTRIES.find((c) => fold(c.name) === fold(raw));
  return { key: fold(raw), label: f?.name ?? raw, flag: f?.flag ?? "🌍" };
}

/** Ligne de détail dans la fenêtre : pastille d'icône, intitulé, valeur ; cliquable si `onPress`. */
function DetailRow({ icon, label, value, onPress }: { icon: string; label: string; value: React.ReactNode; onPress?: () => void }) {
  const { C, R } = useUI();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as any} size={18} color={C.accentDeep} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <UText v="caption" tone="muted">{label}</UText>
        {typeof value === "string" ? <UText v="bodyStrong" style={{ marginTop: 1 }}>{value}</UText> : value}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={C.faint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${label}`} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, borderRadius: R.md })}>
      {body}
    </Pressable>
  );
}

/** Carte TRÈS compacte : nom, pays, pastille devise. Tout le reste s'ouvre au toucher. */
function AgencyCard({ item, country, onOpen }: { item: Agency; country: CountryInfo | null; onOpen: () => void }) {
  const { C, R, S } = useUI();
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onOpen}
        onPressIn={() => press(0.985)}
        onPressOut={() => press(1)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}${country ? `, ${country.label}` : ""}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, minHeight: 60, ...S.sm }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          {country ? <UText style={{ fontSize: 20 }}>{country.flag}</UText> : <Ionicons name="location" size={19} color={C.accentDeep} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="bodyStrong" numberOfLines={1}>{item.name}</UText>
          {!!country && <UText v="caption" tone="muted" numberOfLines={1} style={{ marginTop: 1 }}>{country.label}</UText>}
        </View>
        {!!item.primaryCurrency && <Pill label={item.primaryCurrency} tone="neutral" />}
        <Ionicons name="chevron-forward" size={16} color={C.faint} />
      </Pressable>
    </Animated.View>
  );
}

/** Fenêtre de détail d'une agence. */
function AgencySheet({ item, country, showCompany, onClose }: { item: Agency | null; country: CountryInfo | null; showCompany: boolean; onClose: () => void }) {
  const { C } = useUI();
  const t = useT();
  const ag = (item ?? {}) as any;
  const phone = ag.phone || ag.phoneNumber || ag.tel || null;
  const email = ag.email || ag.contactEmail || null;
  const address = item ? [ag.address, item.city, ag.country].filter(Boolean).join(", ") : "";

  return (
    <Sheet
      visible={!!item}
      onClose={onClose}
      title={item?.name ?? ""}
      footer={address && item ? <Button label={t("loc.directions")} icon="navigate-outline" onPress={() => openLink(mapsUrl(`${item.name} ${address}`))} /> : undefined}
    >
      {item ? (
        <View style={{ paddingTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8, flexWrap: "wrap" }}>
            {!!item.primaryCurrency && <Pill label={item.primaryCurrency} tone="neutral" />}
            <StatusDot color={item.isActive ? C.pos : C.danger} label={item.isActive ? t("loc.open") : t("loc.closed")} size={7} />
          </View>
          {!!country && <DetailRow icon="flag-outline" label={t("loc.country")} value={`${country.flag}  ${country.label}`} />}
          {!!address && <DetailRow icon="location-outline" label={t("loc.address")} value={address} onPress={() => openLink(mapsUrl(`${item.name} ${address}`))} />}
          {phone ? <DetailRow icon="call-outline" label={t("loc.phone")} value={String(phone)} onPress={() => openLink(`tel:${String(phone).replace(/\s/g, "")}`)} /> : null}
          {email ? <DetailRow icon="mail-outline" label={t("loc.email")} value={String(email)} onPress={() => openLink(`mailto:${email}`)} /> : null}
          {showCompany && !!ag.clientName && <DetailRow icon="business-outline" label={t("loc.company")} value={String(ag.clientName)} />}
        </View>
      ) : null}
    </Sheet>
  );
}

/** Sélecteur de pays compact (drapeau + flèche) : tient sur la ligne de la recherche. */
function CountryChip({ label, active, accessibilityLabel, onPress }: { label: string; active: boolean; accessibilityLabel: string; onPress: () => void }) {
  const { C, R } = useUI();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 6, height: 46, paddingHorizontal: 14, borderRadius: R.pill,
        backgroundColor: active ? C.accentSoft : C.beige, borderWidth: active ? 1 : 0, borderColor: C.accentLine, opacity: pressed ? 0.7 : 1,
      })}
    >
      <UText style={{ fontSize: 20 }}>{label}</UText>
      <Ionicons name="chevron-down" size={16} color={active ? C.accentDeep : C.muted} />
    </Pressable>
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
  const { locale } = useI18n();

  const [q, setQ] = useState("");
  const [countryKey, setCountryKey] = useState<string | null>(null);   // null = tous les pays
  const [pickOpen, setPickOpen] = useState(false);
  const [selected, setSelected] = useState<Agency | null>(null);

  // Pays calculé une fois par agence ; liste des pays présents (avec nombre d'agences) pour le sélecteur.
  const withCountry = useMemo(() => agencies.map((a) => ({ a, c: countryOf(a, locale) })), [agencies, locale]);
  const countries = useMemo(() => {
    const m = new Map<string, CountryInfo & { n: number }>();
    for (const { c } of withCountry) if (c) m.set(c.key, { ...c, n: (m.get(c.key)?.n ?? 0) + 1 });
    return [...m.values()].sort((x, y) => x.label.localeCompare(y.label, locale));
  }, [withCountry, locale]);
  const currentCountry = countries.find((c) => c.key === countryKey) ?? null;

  const shown = useMemo(() => {
    const needle = fold(q);
    return withCountry.filter(({ a, c }) => {
      if (countryKey && c?.key !== countryKey) return false;
      if (!needle) return true;
      const hay = fold([a.name, a.city, a.address, a.primaryCurrency, c?.label].filter(Boolean).join(" "));
      return hay.includes(needle);
    });
  }, [withCountry, q, countryKey]);

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
          {/* Recherche + pays sur la MÊME ligne */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, marginBottom: 12 }}>
            <SearchPill value={q} onChangeText={setQ} placeholder={t("loc.search")} style={{ flex: 1, minWidth: 0, height: 46 }} />
            {countries.length > 0 ? (
              <CountryChip
                label={currentCountry ? currentCountry.flag : "🌍"}
                active={!!currentCountry}
                accessibilityLabel={currentCountry ? currentCountry.label : t("loc.allCountries")}
                onPress={() => setPickOpen(true)}
              />
            ) : null}
          </View>

          {shown.length === 0 ? (
            <EmptyView icon="search-outline" title={t("state.noResult")} />
          ) : (
            <View style={{ gap: 8 }}>
              {shown.map(({ a, c }, i) => (
                <Reveal key={String(a.id)} delay={Math.min(i, 8) * 50} distance={12}>
                  <AgencyCard item={a} country={c} onOpen={() => setSelected(a)} />
                </Reveal>
              ))}
            </View>
          )}

          <ChoiceSheet<{ key: string | null; label: string; flag: string; n: number }>
            visible={pickOpen}
            onClose={() => setPickOpen(false)}
            title={t("loc.pickCountry")}
            items={[{ key: null, label: t("loc.allCountries"), flag: "🌍", n: agencies.length }, ...countries]}
            getKey={(c) => c.key ?? "all"}
            getLabel={(c) => c.label}
            getLeft={(c) => <UText style={{ fontSize: 22 }}>{c.flag}</UText>}
            getRight={(c) => String(c.n)}
            isSelected={(c) => c.key === countryKey}
            onPick={(c) => setCountryKey(c.key)}
            searchPlaceholder={t("loc.pickCountry")}
          />
          <AgencySheet item={selected} country={selected ? countryOf(selected, locale) : null} showCompany={role === "SUPER_ADMIN"} onClose={() => setSelected(null)} />
        </>
      )}
    </Screen>
  );
}
