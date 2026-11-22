// apps/direct-transfair-mobile/components/home/ExpressSendCard.tsx
// =========================================================
// CARTE « ENVOYER DE L'ARGENT » v1.1 — accueil client (design E)
// ✅ v1.1 : espaces de milliers automatiques dans « Vous envoyez » (1 000 000 000), l'état garde le texte brut.
// Deux champs façon Ria / Wise : « Vous envoyez » (saisie) et « Ils reçoivent » (calculé au taux du jour), un seul bouton
// « Continuer ». Le bouton ouvre l'écran d'envoi habituel avec le montant déjà rempli (?amount=, déjà géré par send.tsx) :
// la logique d'envoi (destinataire, frais du serveur, taux garanti, code secret, KYC) reste ENTIÈREMENT dans send.tsx.
//   • taux : api.getExchangeRates() (chargement borné useLoader) — même formule que « Taux du jour » (paire directe ou inverse) ;
//     jamais de faux taux : sans taux, « Ils reçoivent » reste vide et la ligne d'aide le dit ;
//   • devise du destinataire : celles pour lesquelles un taux existe depuis la devise du compte ; la dernière choisie est
//     mémorisée sur l'appareil (par défaut GNF, puis XOF) ; le vrai pays est choisi à l'étape « destinataire » de l'envoi ;
//   • « Taux du jour » ouvre l'écran des taux.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { ExchangeRate } from "../../services/types";
import { useLoader } from "../wallet/useLoader";
import { Text, TextInput } from "../ui/Text";
import { Ionicons } from "../ui/Icon";
import { ChoiceSheet } from "../ui/ChoiceSheet";
import { useUI } from "../ui";
import { CurrencyFlag, HomeButton } from "./HomeParts";
import { amountFontFor, decimalsFor, fmtMoney, fmtRate, groupAmount, parseAmount, roundTo, sanitizeAmountInput, toInputText } from "../../utils/amount";
import { useT } from "../../providers/I18nProvider";
import { customerFactor } from "../../utils/rateLookup";

const TARGET_KEY = "dt.homeTarget";
const PREFERRED_TARGETS = ["GNF", "XOF"];

const normPair = (p: string) => String(p ?? "").replace("_", "/");

/** Même formule que app/(tabs)/rates.tsx : paire directe, sinon l'inverse de la paire opposée — NET de la marge de change de la société. */
function findRate(rates: ExchangeRate[], from: string, to: string): number | null {
  if (from === to) return 1;
  const f = customerFactor(rates);
  const direct = rates.find((r) => normPair(r.pair) === `${from}/${to}`);
  if (direct && Number(direct.rate) > 0) return Number(direct.rate) * f;
  const inverse = rates.find((r) => normPair(r.pair) === `${to}/${from}`);
  if (inverse && Number(inverse.rate) > 0) return (1 / Number(inverse.rate)) * f;
  return null;
}

export default function ExpressSendCard({ currency, countryName, style }: { currency: string; countryName?: string | null; style?: StyleProp<ViewStyle> }) {
  const { C, S } = useUI();
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<any>(null);

  const { data } = useLoader<ExchangeRate[]>(() => api.getExchangeRates());
  const rates = data ?? [];

  // Devises vers lesquelles on sait convertir depuis la devise du compte (GNF et XOF d'abord).
  const targets = useMemo(() => {
    const set = new Set<string>();
    for (const r of rates) {
      for (const c of normPair(r.pair).split("/")) {
        if (c && c !== currency && findRate(rates, currency, c) !== null) set.add(c);
      }
    }
    const rank = (c: string) => { const i = PREFERRED_TARGETS.indexOf(c); return i === -1 ? PREFERRED_TARGETS.length : i; };
    return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [rates, currency]);

  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TARGET_KEY).then((v) => { if (alive && v) setChosen(v); }).catch(() => { /* sans incidence */ });
    return () => { alive = false; };
  }, []);
  const target = chosen && targets.includes(chosen) ? chosen : targets[0] ?? null;

  const [raw, setRaw] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const dS = decimalsFor(currency);
  const amount = parseAmount(raw);
  const rate = target ? findRate(rates, currency, target) : null;
  const received = rate !== null && amount > 0 && target ? roundTo(amount * rate, decimalsFor(target)) : null;

  const goSend = () => {
    router.push({ pathname: "/(tabs)/send", params: amount > 0 ? { amount: toInputText(amount, dS) } : {} } as any);
  };
  const pick = (c: string) => {
    setChosen(c);
    setPickerOpen(false);
    AsyncStorage.setItem(TARGET_KEY, c).catch(() => { /* sans incidence */ });
  };
  const curLabel = (c: string) => {
    const key = `rt.cur.${c}`;
    const name = t(key as any);
    return name && name !== key ? `${c} · ${name}` : c;
  };

  const field = { borderRadius: 14, backgroundColor: C.field, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10 };
  const chip = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: C.surface };

  return (
    <View style={[{ borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, padding: 14 }, S.md, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: "700", color: C.ink, flexShrink: 1 }}>{t("home.send")}</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/rates" as any)}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingLeft: 8, paddingRight: 10, borderRadius: 13, backgroundColor: C.accentSoft, opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="swap-horizontal" size={13} color={C.accentDeep} />
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: C.accentDeep }}>{t("home.rateOfDay")}</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 10, gap: 8 }}>
        {/* Vous envoyez */}
        <Pressable style={field} onPress={() => inputRef.current?.focus()} accessible={false}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11.5, lineHeight: 14, fontWeight: "500", color: C.muted }}>{t("home.youSend")}</Text>
            <TextInput
              ref={inputRef}
              value={groupAmount(raw)}
              onChangeText={(v: string) => setRaw(sanitizeAmountInput(v, dS))}
              placeholder="0"
              placeholderTextColor={C.faint}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={goSend}
              accessibilityLabel={t("home.amountField")}
              maxLength={24}
              style={{ fontSize: amountFontFor(groupAmount(raw), 20), lineHeight: 26, fontWeight: "700", color: C.ink, padding: 0, marginTop: 2 }}
            />
          </View>
          <View style={chip}>
            <CurrencyFlag currency={currency} countryName={countryName} size={18} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink }}>{currency}</Text>
          </View>
        </Pressable>

        {/* Ils reçoivent */}
        <View style={field}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11.5, lineHeight: 14, fontWeight: "500", color: C.muted }}>{t("home.theyGet")}</Text>
            {received !== null && target ? (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize: 20, lineHeight: 26, fontWeight: "700", color: C.ink, marginTop: 2 }}>
                {fmtMoney(received, target)}
              </Text>
            ) : (
              <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 26, fontWeight: "500", color: C.muted, marginTop: 2 }}>
                {t("home.theyGetHint")}
              </Text>
            )}
          </View>
          {target ? (
            <Pressable
              onPress={targets.length > 1 ? () => setPickerOpen(true) : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${t("home.pickTarget")} : ${target}`}
              style={({ pressed }) => [chip, { opacity: pressed ? 0.7 : 1 }]}
            >
              <CurrencyFlag currency={target} size={18} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink }}>{target}</Text>
              {targets.length > 1 ? <Ionicons name="chevron-down" size={14} color={C.muted} /> : null}
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={{ marginTop: 9, fontSize: 12, lineHeight: 16, color: C.muted }}>
        {rate !== null && target ? t("home.rateLine", { from: currency, to: target, rate: fmtRate(rate) }) : t("home.rateLater")}
      </Text>

      <View style={{ marginTop: 10 }}>
        <HomeButton label={t("common.continue")} onPress={goSend} testID="home-send" />
      </View>

      <ChoiceSheet<string>
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t("home.pickTarget")}
        items={targets}
        getKey={(c) => c}
        getLabel={curLabel}
        getLeft={(c) => <CurrencyFlag currency={c} size={30} />}
        isSelected={(c) => c === target}
        onPick={pick}
      />
    </View>
  );
}
