// apps/direct-transfair-mobile/app/(tabs)/rates.tsx
// =========================================================
// TAUX DU JOUR v9.0 — Direct Transf'air
// ✅ v9.0 : REFONTE THÈME CLAIR — fond crème, trois taux clés en cartes, convertisseur
//    à deux grandes lignes (De / Vers) avec bouton d'inversion rond, sélecteur de devise
//    en feuille basse avec recherche. Couleurs dérivées de la marque du tenant (plus de
//    bleu #1D4ED8 ni de vert en dur), police système. Chargement borné via useLoader
//    (20 s, message d'attente après 4 s, « Réessayer ») — même comportement qu'en v8.4 :
//    jamais de faux taux ; si des taux sont déjà là, ils restent affichés en cas d'échec.
//    Les formules de conversion (findRate, fmtRate…) sont INCHANGÉES.
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v8.5 : WHITE-LABEL — couleurs d'accent suivent la marque du tenant.
// ✅ v8.4 : FIX — plus de faux taux ni de spinner sans fin (appel borné + erreur claire).
// ✅ v8.0 → v8.3 conservés : convertisseur style Wise, 5 devises de l'application,
//    taille de police dégressive (react-native-web n'a pas adjustsFontSizeToFit).
// =========================================================

import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { useLoader } from "../../components/wallet/useLoader";
import {
  Card, EmptyView, ErrorView, IconButton, ListRow, NavBar, Notice, Screen, SearchPill, Sheet, SkeletonRows, SlowNote, UText,
  SYSTEM_FONT, useUI,
} from "../../components/ui";

// ─── 5 devises de l'application ──────────────────────────
const APP_CURRENCIES = [
  { code: "EUR", name: "Euro",             flag: "🇪🇺", symbol: "€"    },
  { code: "USD", name: "Dollar américain", flag: "🇺🇸", symbol: "$"    },
  { code: "GBP", name: "Livre sterling",   flag: "🇬🇧", symbol: "£"    },
  { code: "XOF", name: "Franc CFA BCEAO",  flag: "🌍",  symbol: "FCFA" },
  { code: "GNF", name: "Franc guinéen",    flag: "🇬🇳", symbol: "GNF"  },
] as const;

function getCurrencyMeta(code: string) {
  return APP_CURRENCIES.find((c) => c.code === code) ?? APP_CURRENCIES[0];
}

// ─── Helpers (inchangés) ─────────────────────────────────
function normPair(p: string): string {
  return p.replace("_", "/");
}

function fmt(n: number, cur = "XOF"): string {
  if (!isFinite(n)) return "—";
  const d = cur === "GNF" || cur === "XOF" ? 0 : 4;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return n.toFixed(d);
  }
}

function fmtAmount(n: number, cur: string): string {
  if (!isFinite(n)) return "—";
  const d = cur === "GNF" || cur === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return n.toFixed(d);
  }
}

function fmtRate(rate: number, toCur: string): string {
  if (!isFinite(rate)) return "—";
  if (rate < 0.001) {
    try {
      return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(rate);
    } catch { return rate.toFixed(6); }
  }
  const d = toCur === "GNF" || toCur === "XOF" ? 2 : 4;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(rate);
  } catch { return rate.toFixed(d); }
}

/** Taille de police dégressive selon la longueur affichée (identique sur toutes les plateformes). */
function dynamicFontSize(length: number): number {
  if (length <= 8)  return 34;
  if (length <= 11) return 28;
  if (length <= 14) return 23;
  if (length <= 18) return 19;
  return 15;
}

function findRate(rates: any[], from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = rates.find((r) => normPair(r.pair) === `${from}/${to}` || r.pair === `${from}_${to}`);
  if (direct?.rate > 0) return Number(direct.rate);
  const inverse = rates.find((r) => normPair(r.pair) === `${to}/${from}` || r.pair === `${to}_${from}`);
  if (inverse?.rate > 0) return 1 / Number(inverse.rate);
  return null;
}

// ─── Sélecteur de devise (feuille basse) ─────────────────
function CurrencySheet({
  visible, selectedCode, onSelect, onClose,
}: { visible: boolean; selectedCode: string; onSelect: (code: string) => void; onClose: () => void }) {
  const { C } = useUI();
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q
    ? APP_CURRENCIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : [...APP_CURRENCIES];

  const close = () => { setSearch(""); onClose(); };

  return (
    <Sheet visible={visible} onClose={close} title="Sélectionnez une devise">
      <SearchPill value={search} onChangeText={setSearch} placeholder="Rechercher" style={{ marginTop: 6, marginBottom: 6 }} />
      {filtered.length === 0 ? (
        <EmptyView icon="search-outline" title="Aucune devise trouvée" />
      ) : (
        filtered.map((item, i) => {
          const on = item.code === selectedCode;
          return (
            <ListRow
              key={item.code}
              title={item.name}
              subtitle={item.code}
              last={i === filtered.length - 1}
              left={
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                </View>
              }
              right={on ? <Ionicons name="checkmark-circle" size={24} color={C.ink} /> : undefined}
              onPress={() => { onSelect(item.code); close(); }}
            />
          );
        })
      )}
    </Sheet>
  );
}

// ─── Convertisseur ───────────────────────────────────────
function Converter({ rates }: { rates: any[] }) {
  const { C, R } = useUI();
  const [fromCur, setFromCur] = useState("EUR");
  const [toCur, setToCur] = useState("XOF");
  const [amount, setAmount] = useState("100");
  const [pick, setPick] = useState<null | "from" | "to">(null);

  const rate = findRate(rates, fromCur, toCur);
  const numAmount = parseFloat(String(amount).replace(/\s/g, "").replace(",", ".")) || 0;
  const converted = rate !== null ? numAmount * rate : null;

  const fromMeta = getCurrencyMeta(fromCur);
  const toMeta = getCurrencyMeta(toCur);

  const amountFont = dynamicFontSize((amount || "0").length);
  const resultText = converted !== null ? fmtAmount(converted, toCur) : "—";
  const resultFont = dynamicFontSize(resultText.length);

  const handleSelectFrom = (code: string) => {
    if (code === toCur) setToCur(fromCur);
    setFromCur(code);
  };
  const handleSelectTo = (code: string) => {
    if (code === fromCur) setFromCur(toCur);
    setToCur(code);
  };
  const handleSwap = () => {
    const prevFrom = fromCur;
    setFromCur(toCur);
    setToCur(prevFrom);
    if (converted !== null) setAmount(fmtAmount(converted, toCur).replace(/\s/g, ""));
  };

  const curBtn = (meta: { code: string; flag: string }, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Devise ${meta.code}`}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingLeft: 6, paddingRight: 12,
        borderRadius: R.pill, backgroundColor: C.beige, opacity: pressed ? 0.7 : 1, flexShrink: 0,
      })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18 }}>{meta.flag}</Text>
      </View>
      <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: "800", color: C.ink }}>{meta.code}</Text>
      <Ionicons name="chevron-down" size={14} color={C.muted} />
    </Pressable>
  );

  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      {/* De */}
      <View style={{ padding: 20, paddingBottom: 26 }}>
        <UText v="overline" tone="muted" style={{ marginBottom: 10 }}>Vous convertissez</UText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {curBtn(fromMeta, () => setPick("from"))}
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
            underlineColorAndroid="transparent"
            placeholder="0"
            placeholderTextColor={C.faint}
            selectionColor={C.accent}
            accessibilityLabel="Montant à convertir"
            style={[
              { flex: 1, minWidth: 0, textAlign: "right", padding: 0, fontFamily: SYSTEM_FONT, fontWeight: "800", letterSpacing: -1, color: C.ink, fontSize: amountFont },
              { outlineStyle: "none", outlineWidth: 0, borderWidth: 0 } as any,
            ]}
          />
        </View>
      </View>

      {/* Séparateur + inversion */}
      <View style={{ height: 1, backgroundColor: C.line, zIndex: 2, overflow: "visible" }}>
        <Pressable
          onPress={handleSwap}
          accessibilityRole="button"
          accessibilityLabel="Inverser les devises"
          style={({ pressed }) => ({
            position: "absolute", right: 20, top: -20, width: 40, height: 40, borderRadius: 20,
            backgroundColor: C.dark, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name="swap-vertical" size={20} color={C.darkInk} />
        </Pressable>
      </View>

      {/* Vers */}
      <View style={{ padding: 20, paddingTop: 26, backgroundColor: C.sunken }}>
        <UText v="overline" tone="muted" style={{ marginBottom: 10 }}>Ils reçoivent environ</UText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {curBtn(toMeta, () => setPick("to"))}
          <Text
            numberOfLines={1}
            style={{ flex: 1, minWidth: 0, textAlign: "right", fontFamily: SYSTEM_FONT, fontWeight: "800", letterSpacing: -1, color: C.ink, fontSize: resultFont }}
          >
            {resultText}
          </Text>
        </View>
        <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13, fontWeight: "500", color: C.muted, textAlign: "right", marginTop: 8 }}>
          {rate !== null ? `1 ${fromCur} = ${fmtRate(rate, toCur)} ${toCur}` : `Taux ${fromCur}/${toCur} indisponible`}
        </Text>
      </View>

      <CurrencySheet visible={pick === "from"} selectedCode={fromCur} onSelect={handleSelectFrom} onClose={() => setPick(null)} />
      <CurrencySheet visible={pick === "to"} selectedCode={toCur} onSelect={handleSelectTo} onClose={() => setPick(null)} />
    </Card>
  );
}

// ─── Écran principal ─────────────────────────────────────
export default function RatesScreen() {
  const router = useRouter();
  const { C } = useUI();

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<any[]>(async () => {
    const res = await api.getExchangeRates();
    const list = Array.isArray(res) ? res : [];
    return list.map((r: any) => ({ ...r, pair: normPair(r.pair) }));
  });
  const rates = useMemo(() => data ?? [], [data]);
  const [stamp, setStamp] = useState("");
  React.useEffect(() => {
    if (status === "ready") {
      setStamp(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    }
  }, [data, status]);

  const eurXof = findRate(rates, "EUR", "XOF");
  const eurGnf = findRate(rates, "EUR", "GNF");
  const usdXof = findRate(rates, "USD", "XOF");

  const keyRates = [
    { label: "€ → CFA", value: eurXof ? fmt(eurXof, "XOF") : "—" },
    { label: "€ → GNF", value: eurGnf ? fmt(eurGnf, "GNF") : "—" },
    { label: "$ → CFA", value: usdXof ? fmt(usdXof, "XOF") : "—" },
  ];

  const onRetry = useCallback(() => { void reload(); }, [reload]);

  return (
    <Screen
      header={
        <NavBar
          title="Taux du jour"
          subtitle={stamp ? `Mis à jour à ${stamp}` : "Taux indicatifs du marché"}
          onBack={() => router.back()}
          right={<IconButton icon="refresh" label="Actualiser les taux" onPress={() => void refresh()} />}
        />
      }
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {status === "loading" ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={4} />
        </>
      ) : status === "error" && rates.length === 0 ? (
        <ErrorView title={error?.title ?? "Taux indisponibles"} message={error?.message ?? "Réessaie dans un instant."} onRetry={onRetry} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {keyRates.map((k) => (
              <Card key={k.label} pad={14} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <UText v="overline" tone="muted" numberOfLines={1}>{k.label}</UText>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: SYSTEM_FONT, fontSize: 20, fontWeight: "800", letterSpacing: -0.5, color: C.ink }}>
                  {k.value}
                </Text>
              </Card>
            ))}
          </View>

          <UText v="overline" tone="muted" style={{ marginTop: 28, marginBottom: 10 }}>Convertisseur</UText>
          <Converter rates={rates} />

          <Notice tone="info" icon="information-circle-outline" style={{ marginTop: 16 }}>
            Taux de change moyen du marché, indicatif et non contractuel. Les taux réels peuvent légèrement varier au moment de l'exécution.
          </Notice>
        </>
      )}
    </Screen>
  );
}
