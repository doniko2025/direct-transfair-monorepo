// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// CLIENT DASHBOARD v12.0 — Direct Transf'air
// ✅ v12.0 : 🔥 DESIGN « CORRIDOR » — l'accueil devient le formulaire d'envoi : salutation en Fraunces,
//    pastille de solde, « couloir » vert forêt (trame de points, route pointillée jaune, avion, taux du jour,
//    ville de départ → ville d'arrivée), calculateur « Tu envoies / Montant reçu » avec bénéficiaires en pastilles,
//    gros bouton jaune « Envoyer 100,00 € », raccourcis Recharger / Taux / QR Code. Sous le pli : bilan du mois et
//    activité récente (inchangés).
//    Tout est dynamique : devise de départ = devise du portefeuille, villes/pays = pays du client et du
//    bénéficiaire choisi (capitales dans components/ui/Corridor.tsx), devise d'arrivée = celle du pays du
//    bénéficiaire (modifiable), taux = getExchangeRates (direct ou inverse), couleurs = marque de la société.
//    Le bouton « Envoyer » ouvre l'écran d'envoi avec montant + bénéficiaire déjà remplis
//    (corrige au passage l'ancien « Envoi rapide » dont le bénéficiaire était ignoré faute de `mode`).
//    Logique INCHANGÉE : refreshUser + getTransactions({limit:30}) + getExchangeRates en chargement borné
//    (useLoader, 20 s), solde disponible / réservé, stats du mois, contacts récents.
// ✅ v11.0 : refonte thème clair (Flash Transfert). ✅ v10.0 : chargements bornés.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { Ionicons } from '../ui/Icon';
import { Text, TextInput } from '../ui/Text';
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { countriesList, getCountryByName } from "../../data/countries";
import { useLoader } from "../wallet/useLoader";
import { currencySymbol, formatMoney, toNum } from "../wallet/walletTheme";
import { DotGrid, capitalOf } from "../ui/Corridor";
import { ChoiceSheet } from "../ui/ChoiceSheet";
import { SERIF_FONT } from "../ui/theme";
import {
  Card, EmptyView, ErrorView, Screen, SectionHeader, SkeletonRows, SlowNote, TxRow, UText, useUI,
} from "../ui";

// ─── Helpers métier — logique inchangée ───────────────────
function isThisMonth(isoDate: string): boolean {
  const d = new Date(isoDate), now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const COUNTRY_CURRENCY: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
  GB: "GBP", US: "USD",
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}

// ─── Taux & devises (mêmes règles que l'écran « Taux ») ───
const normPair = (p: string) => String(p || "").replace("_", "/");

function findRate(rates: any[], from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = rates.find((r) => normPair(r.pair) === `${from}/${to}`);
  if (direct?.rate > 0) return Number(direct.rate);
  const inverse = rates.find((r) => normPair(r.pair) === `${to}/${from}`);
  if (inverse?.rate > 0) return 1 / Number(inverse.rate);
  return null;
}

/** Devises atteignables depuis `from` (paire directe ou inverse). */
function reachable(rates: any[], from: string): string[] {
  const out = new Set<string>();
  for (const r of rates) {
    const [a, b] = normPair(r.pair).split("/");
    if (a === from && b && Number(r.rate) > 0) out.add(b);
    if (b === from && a && Number(r.rate) > 0) out.add(a);
  }
  return [...out];
}

const CURRENCY_NAMES: Record<string, string> = {
  EUR: "Euro", USD: "Dollar américain", GBP: "Livre sterling", XOF: "Franc CFA (BCEAO)", XAF: "Franc CFA (BEAC)", GNF: "Franc guinéen",
};
/** Pays « type » d'une devise, quand le bénéficiaire n'en fixe pas (EUR → France, GNF → Guinée…). */
const CURRENCY_HOME: Record<string, string> = { EUR: "FR", GBP: "GB", USD: "US", GNF: "GN" };

type Place = { city: string; sub?: string };
function placeOf(countryName?: string | null, currency?: string): Place {
  const byName = countryName ? getCountryByName(countryName) ?? countriesList.find((c) => c.name.toLowerCase() === countryName.toLowerCase()) : undefined;
  const code = byName?.code ?? (currency ? CURRENCY_HOME[currency] : undefined);
  const country = byName?.name ?? (code ? countriesList.find((c) => c.code === code)?.name : undefined);
  const capital = capitalOf(code);
  if (capital) return { city: capital, sub: country };
  if (country) return { city: country };
  if (currency === "XOF" || currency === "XAF") return { city: "Zone CFA", sub: currency === "XOF" ? "Afrique de l'Ouest" : "Afrique centrale" };
  return { city: currency ?? "—" };
}

type Contact = { name: string; phone?: string; beneficiaryId?: string; country?: string };
type DashData = { txs: any[]; rates: any[] };

const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] ?? "" : "")).toUpperCase();
};

// ─── Route pointillée + avion (SVG, proportionnelle à la largeur) ──
function Route({ w, h, sun }: { w: number; h: number; sun: string }) {
  if (!w) return null;
  const k = w / 350;
  const x1 = 52 * k, y1 = 100, cx = 175 * k, cy = -10, x2 = 298 * k, y2 = 50;
  const t = 0.15;
  const px = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const py = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  return (
    <Svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
      <Path d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} fill="none" stroke={sun} strokeWidth={2.6} strokeDasharray="1 9" strokeLinecap="round" />
      <Circle cx={x1} cy={y1} r={7} fill={sun} />
      <Circle cx={x1} cy={y1} r={13} fill="none" stroke={sun} strokeOpacity={0.35} strokeWidth={2} />
      <Circle cx={x2} cy={y2} r={7} fill="#FFFFFF" />
      <Circle cx={x2} cy={y2} r={13} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} />
      <Path
        d="m22 2-7 20-4-9-9-4Z"
        transform={`translate(${px} ${py}) rotate(10) translate(-12 -12)`}
        fill={sun} stroke={sun} strokeWidth={1.6} strokeLinejoin="round"
      />
    </Svg>
  );
}

function CurrencyChip({ code, tone, onPress }: { code: string; tone: "forest" | "sun"; onPress?: () => void }) {
  const { C } = useUI();
  const sym = currencySymbol(code);
  const glyph = tone === "sun" ? (sym.startsWith("F") ? "F" : sym.slice(0, 1)) : sym.slice(0, 1);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Devise ${code}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingLeft: 6, paddingRight: 14, borderRadius: 20, backgroundColor: C.brume }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tone === "sun" ? C.sun : C.forest, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: tone === "sun" ? C.sunInk : "#FFFFFF" }}>{glyph}</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: "800", color: C.ink }}>{code === "XOF" || code === "XAF" ? sym : code}</Text>
      {!!onPress && <Ionicons name="chevron-down" size={14} color={C.muted} />}
    </Pressable>
  );
}

// ─── Écran ────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { C } = useUI();
  const [hidden, setHidden] = useState(false);
  const [amountText, setAmountText] = useState("100");
  const [editing, setEditing] = useState(false);
  const [pickedContact, setPickedContact] = useState<string | null | undefined>(undefined); // undefined = auto, null = aucun
  const [pickedDest, setPickedDest] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  const firstName = user?.firstName ?? "Client";

  // ── Données wallet (identiques à la v9.x) ──
  const rawCountry      = ((user as any)?.country ?? "").trim().toUpperCase().substring(0, 2);
  const primaryCurrency = (user as any)?.primaryCurrency || COUNTRY_CURRENCY[rawCountry] || "XOF";
  const wallets         = (user as any)?.wallets ?? [];
  const mainWallet      = wallets.find((w: any) => w.currency === primaryCurrency)
    ?? wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance          = toNum(mainWallet?.balance ?? (user as any)?.balance);
  const reservedBalance  = toNum(mainWallet?.reservedBalance ?? 0);
  const availableBalance = balance - reservedBalance;

  // ── Chargement borné : transactions + taux (le solde vient de refreshUser) ──
  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<DashData>(async () => {
    const [, rawTxs, rates] = await Promise.allSettled([
      refreshUser(),
      api.getTransactions({ limit: 30 }),
      api.getExchangeRates(),
    ]);
    if (rawTxs.status === "rejected") throw rawTxs.reason;
    const safe = Array.isArray(rawTxs.value) ? rawTxs.value : [];
    const txs = [...safe]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    return { txs, rates: rates.status === "fulfilled" && Array.isArray(rates.value) ? rates.value : [] };
  });

  const txs = data?.txs ?? [];
  const rates = data?.rates ?? [];

  // ── Stats mensuelles (logique inchangée) ──
  const monthTxs  = txs.filter((t) => isThisMonth(t.createdAt));
  const monthSent = monthTxs
    .filter((t) => t.senderId === user?.id && t.status === "PAID")
    .reduce((acc, t) => acc + toNum(t.amount), 0);
  const monthRecv = monthTxs
    .filter((t) => (t.recipientId === user?.id || (t.senderId !== user?.id && !t.beneficiaryId)) && t.status === "PAID")
    .reduce((acc, t) => {
      const hasConv = t.targetCurrency && t.targetCurrency !== t.currency && toNum(t.receivedAmount) > 0;
      return acc + (hasConv ? toNum(t.receivedAmount) : toNum(t.amount));
    }, 0);

  // ── Contacts récents (logique inchangée + pays du bénéficiaire) ──
  const recentContacts = useMemo(() => {
    const seen = new Set<string>();
    const result: Contact[] = [];
    for (const tx of txs) {
      if (tx.senderId !== user?.id) continue;
      const name  = tx.beneficiary?.fullName ?? tx.recipient?.firstName;
      const phone = tx.beneficiary?.phone ?? tx.recipient?.phone;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({ name, phone, beneficiaryId: tx.beneficiaryId, country: tx.beneficiary?.country });
      if (result.length >= 5) break;
    }
    return result;
  }, [txs, user?.id]);

  // ── Calculateur : montant, bénéficiaire choisi, devise d'arrivée, taux ──
  const selected: Contact | null = pickedContact === null ? null : recentContacts.find((c) => c.name === pickedContact) ?? (pickedContact === undefined ? recentContacts[0] ?? null : null);
  const amount = Math.max(0, parseFloat(amountText.replace(/\s/g, "").replace(",", ".")) || 0);

  const destOptions = useMemo(() => reachable(rates, primaryCurrency), [rates, primaryCurrency]);
  const contactCurrency = selected?.country ? getCountryByName(selected.country)?.currency : undefined;
  const dest: string | null =
    (pickedDest && destOptions.includes(pickedDest) ? pickedDest : null)
    ?? (contactCurrency && destOptions.includes(contactCurrency) ? contactCurrency : null)
    ?? ["XOF", "GNF", "EUR", "USD", "GBP"].find((c) => destOptions.includes(c))
    ?? destOptions[0] ?? null;
  const rate = dest ? findRate(rates, primaryCurrency, dest) : null;
  const received = rate != null ? amount * rate : null;

  const from = placeOf((user as any)?.country, primaryCurrency);
  const to = placeOf(selected?.country, dest ?? undefined);
  const sym = currencySymbol(primaryCurrency);
  const destSym = dest ? currencySymbol(dest) : "";
  const rateLabel = rate != null && dest ? `1 ${sym} = ${formatMoney(rate, dest)} ${destSym}` : null;
  const shownAmount = editing ? amountText : formatMoney(amount, primaryCurrency);

  const goSend = () => {
    const params: Record<string, string> = {};
    if (amount > 0) params.amount = String(amount);
    if (selected?.beneficiaryId) { params.mode = "CASH"; params.beneficiaryId = String(selected.beneficiaryId); }
    else if (selected?.phone) { params.mode = "WALLET"; params.phone = selected.phone; params.name = selected.name; }
    router.push({ pathname: "/(tabs)/send", params });
  };

  const recentTxs = txs.slice(0, 5);
  const quick: { icon: string; label: string; route: string }[] = [
    { icon: "add", label: "Recharger", route: "/(tabs)/recharge" },
    { icon: "swap-horizontal", label: "Taux", route: "/(tabs)/rates" },
    { icon: "qr-code-outline", label: "QR Code", route: "/(tabs)/qr" },
  ];

  const [heroW, setHeroW] = useState(0);

  return (
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      {/* ── Salutation + notifications ── */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", paddingTop: 10, paddingHorizontal: 2 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: SERIF_FONT, fontStyle: "italic", fontWeight: "600", fontSize: 17, color: C.muted }}>{greeting()},</Text>
          <UText v="hero" numberOfLines={1} style={{ lineHeight: 34, letterSpacing: -0.5 }}>{firstName}</UText>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/notifications")}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, marginTop: 2, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}
        >
          <Ionicons name="notifications-outline" size={22} color={C.forest} />
        </Pressable>
      </View>

      {/* ── Pastille de solde ── */}
      <Pressable
        onPress={() => setHidden((h) => !h)}
        accessibilityRole="button"
        accessibilityLabel={hidden ? "Afficher le solde" : "Masquer le solde"}
        style={{ alignSelf: "flex-start", marginTop: 8, marginLeft: 2, height: 34, paddingLeft: 12, paddingRight: 14, borderRadius: 17, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={17} color={C.leaf} />
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.muted }}>
          Solde <Text style={{ fontWeight: "800", color: C.ink }}>{hidden ? "••••••" : `${formatMoney(availableBalance, primaryCurrency)} ${sym}`}</Text>
        </Text>
      </Pressable>

      <SlowNote visible={slow} />

      {/* ── Le couloir : départ → arrivée ── */}
      <View
        onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}
        style={{ marginTop: 14, height: 176, borderRadius: 28, backgroundColor: C.forest, overflow: "hidden" }}
      >
        <DotGrid />
        <Route w={heroW} h={176} sun={C.sun} />
        {!!rateLabel && (
          <View style={{ position: "absolute", top: 16, left: 0, right: 0, alignItems: "center" }} pointerEvents="none">
            <View style={{ height: 34, paddingLeft: 10, paddingRight: 14, borderRadius: 17, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 7, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
              <Ionicons name="swap-horizontal" size={16} color={C.leaf} />
              <Text style={{ fontSize: 14, fontWeight: "800", color: C.forest }} numberOfLines={1}>{rateLabel}</Text>
            </View>
          </View>
        )}
        <View style={{ position: "absolute", left: 24, top: 114 }} pointerEvents="none">
          <Text style={{ fontFamily: SERIF_FONT, fontStyle: "italic", fontWeight: "600", fontSize: 21, color: "#FFFFFF" }}>{from.city}</Text>
          {!!from.sub && <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#9FC9B4", marginTop: 1 }}>{from.sub}</Text>}
        </View>
        <View style={{ position: "absolute", right: 20, top: 66, alignItems: "flex-end" }} pointerEvents="none">
          <Text style={{ fontFamily: SERIF_FONT, fontStyle: "italic", fontWeight: "600", fontSize: 21, color: "#FFFFFF", textAlign: "right" }}>{to.city}</Text>
          {!!to.sub && <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#9FC9B4", marginTop: 1, textAlign: "right" }}>{to.sub}</Text>}
        </View>
      </View>

      {/* ── Calculateur ── */}
      <View
        style={{
          marginTop: -14, borderRadius: 28, backgroundColor: C.surface, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 14,
          shadowColor: "#0E3B2D", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted }}>Tu envoies</Text>
            <TextInput
              value={hidden && !editing ? "••••" : shownAmount}
              onChangeText={(t) => setAmountText(t.replace(/[^0-9.,\s]/g, ""))}
              onFocus={() => { setEditing(true); setAmountText(amount ? String(amount).replace(".", ",") : ""); }}
              onBlur={() => setEditing(false)}
              keyboardType="decimal-pad"
              inputMode="decimal"
              selectTextOnFocus
              accessibilityLabel="Montant à envoyer"
              placeholder="0,00"
              placeholderTextColor={C.faint}
              style={{ fontSize: 36, fontWeight: "800", letterSpacing: -1.2, color: C.ink, padding: 0, marginTop: 2, minWidth: 0, ...( { outlineStyle: "none" } as any) }}
            />
          </View>
          <CurrencyChip code={primaryCurrency} tone="forest" />
        </View>

        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 12 }}>
          <View style={{ position: "absolute", left: "50%", top: "50%", width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 17, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
            <View style={{ transform: [{ rotate: "90deg" }] }}>
              <Ionicons name="swap-horizontal" size={16} color={C.forest} />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted }}>Montant reçu</Text>
            <Text style={{ fontSize: 36, fontWeight: "800", letterSpacing: -1.2, lineHeight: 40, color: C.leaf, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {received == null || !dest ? "—" : hidden && !editing ? "••••" : formatMoney(received, dest)}
            </Text>
          </View>
          {!!dest && <CurrencyChip code={dest} tone="sun" onPress={destOptions.length > 1 ? () => setSheet(true) : undefined} />}
        </View>

        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {recentContacts.map((c) => {
              const on = selected?.name === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => { setPickedContact(c.name); setPickedDest(null); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 7, height: 36, paddingLeft: 8, paddingRight: 13, borderRadius: 18, borderWidth: 1.5, borderColor: on ? C.sun : C.line, backgroundColor: on ? C.sunSoft : C.surface }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#F3E3B0", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: "#6A5415" }}>{initialsOf(c.name)}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.forest }} numberOfLines={1}>{c.name.split(" ")[0]}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => router.push("/(tabs)/beneficiaries/create")}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 7, height: 36, paddingLeft: 8, paddingRight: 13, borderRadius: 18, borderWidth: 1.5, borderColor: C.line }}
            >
              <Ionicons name="add" size={15} color={C.forest} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.forest }}>Autre bénéficiaire</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>

      {/* ── Bouton principal ── */}
      <Pressable
        onPress={goSend}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: 20, height: 60, borderRadius: 20, backgroundColor: C.sun, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
          shadowColor: "#A07800", shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 5,
          opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <Ionicons name="send" size={21} color={C.sunInk} />
        <Text style={{ fontSize: 18, fontWeight: "800", color: C.sunInk }}>
          {amount > 0 ? `Envoyer ${formatMoney(amount, primaryCurrency)} ${sym}` : "Envoyer de l'argent"}
        </Text>
      </Pressable>

      {/* ── Raccourcis ── */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        {quick.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => router.push(q.route as any)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name={q.icon} size={18} color={C.forest} />
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.forest }} numberOfLines={1}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Ce mois-ci ── */}
      <SectionHeader title="Ce mois-ci" />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Card style={{ flex: 1 }} pad={16}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="arrow-up" size={14} color={C.muted} />
            <UText v="label" tone="muted">Envoyé</UText>
          </View>
          <UText v="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 6, fontSize: 22 }}>
            {hidden ? "••••" : formatMoney(monthSent, primaryCurrency)}
          </UText>
          <UText v="label" tone="muted">{primaryCurrency}</UText>
        </Card>
        <Card style={{ flex: 1 }} pad={16}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="arrow-down" size={14} color={C.pos} />
            <UText v="label" tone="muted">Reçu</UText>
          </View>
          <UText v="heading" tone="pos" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 6, fontSize: 22 }}>
            {hidden ? "••••" : formatMoney(monthRecv, primaryCurrency)}
          </UText>
          <UText v="label" tone="muted">{primaryCurrency}</UText>
        </Card>
      </View>

      {/* ── Activité récente ── */}
      <SectionHeader title="Activité récente" action="Voir tout" onAction={() => router.push("/(tabs)/transactions")} />
      {status === "loading" ? (
        <SkeletonRows rows={3} />
      ) : status === "error" ? (
        <ErrorView compact title={error?.title ?? "Chargement impossible"} message={error?.message ?? ""} onRetry={reload} />
      ) : recentTxs.length === 0 ? (
        <EmptyView
          icon="receipt-outline"
          title="Aucune transaction"
          message="Tes envois et réceptions apparaîtront ici."
          actionLabel="Envoyer de l'argent"
          onAction={goSend}
        />
      ) : (
        recentTxs.map((tx, i) => (
          <TxRow key={tx.id ?? i} tx={tx} userId={user?.id} last={i === recentTxs.length - 1} onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)} />
        ))
      )}

      <ChoiceSheet<string>
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Devise reçue"
        items={destOptions}
        getKey={(c) => c}
        getLabel={(c) => `${CURRENCY_NAMES[c] ?? c} (${c})`}
        isSelected={(c) => c === dest}
        onPick={(c) => setPickedDest(c)}
        searchPlaceholder="Rechercher une devise"
      />
    </Screen>
  );
}
