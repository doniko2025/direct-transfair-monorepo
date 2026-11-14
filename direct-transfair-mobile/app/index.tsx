// apps/direct-transfair-mobile/app/index.tsx
// =========================================================
// ACCUEIL v6.0 — Direct Transf'air (white-label)
// ✅ v6.0 : REFONTE « esprit Taptap Send » — le logo de la société en haut, une carte avec un SIMULATEUR de taux (vous envoyez / ils
//    reçoivent, calculé avec les taux publiés par la plateforme : GET /exchange-rates, public), puis une carte d'actions
//    « Se connecter » / « S'inscrire ». Le haut de l'écran est teinté par l'accent de la société, le bas porte la couleur d'accent pleine.
//    COULEURS : 100 % dynamiques — aucune couleur écrite en dur. Tout vient de useUI(), donc de la couleur principale et de la couleur
//    d'accent choisies par le super admin pour la société (et du thème clair / sombre).
//    ✅ v6.1 : FRAIS ESTIMÉS avant connexion — sous le taux, deux pastilles (Wallet / Cash Pickup) donnent les frais du barème de la société
//    pour le montant saisi (GET /public-fees/quote, public, même calcul que le serveur). Si l'endpoint ne répond pas (ancien serveur, société
//    sans portail…), les pastilles n'apparaissent simplement pas : l'écran fonctionne comme avant.
//    Les éléments arrivent en cascade (Reveal). Largeur limitée à 480 px : propre sur tablette et sur le web.
//    NAVIGATION : « Se connecter » → /(auth)/login-v2 et « S'inscrire » → /(auth)/account-type, en push (la flèche de retour revient ici).
// ✅ v5.1 : marque « t’ » (TenantMark). Navigation INCHANGÉE.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StatusBar, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUI, SYSTEM_FONT } from "../components/ui/theme";
import { Button } from "../components/ui/Primitives";
import { ChoiceSheet } from "../components/ui/ChoiceSheet";
import { Ionicons } from "../components/ui/Icon";
import { TenantMark } from "../components/brand/BrandMark";
import { CurrencyFlag } from "../components/home/HomeParts";
import Reveal from "../components/flow/Reveal";
import { useTenant } from "../providers/TenantProvider";
import { api } from "../services/api";
import type { ExchangeRate } from "../services/types";
import { lookupRate } from "../utils/rateLookup";
import { decimalsFor, fmtMoney, fmtRate, parseAmount, roundTo, sanitizeAmountInput } from "../utils/amount";

import { Text, TextInput } from "../components/ui/Text";
import { useT } from "../providers/I18nProvider";

const FROM = "EUR";
const PREFERRED_TARGET = "GNF";
/** Pays d'envoi supposé (l'expéditeur n'est pas connu avant la connexion) et pays de réception déduit de la devise quand elle est sans ambiguïté. */
const SEND_COUNTRY: Record<string, string> = { EUR: "FR" };
const RECEIVE_COUNTRY: Record<string, string> = { GNF: "GN" };

type FeeEst = { WALLET: number | null; CASH_PICKUP: number | null };

/** Devises de réception proposées : toutes celles pour lesquelles un taux EUR → devise est publié (sens direct ou inverse). */
function targetsFrom(rates: ExchangeRate[]): string[] {
  const found = new Set<string>();
  for (const r of rates) {
    const [a, b] = String(r.pair || "").toUpperCase().split(/[_/]/);
    if (!a || !b) continue;
    if (a === FROM) found.add(b);
    else if (b === FROM) found.add(a);
  }
  return [...found].filter((c) => lookupRate(rates, FROM, c) !== null).sort();
}

export default function Index() {
  const router = useRouter();
  const t = useT();
  const { C, R, S } = useUI();
  const { branding } = useTenant();
  const insets = useSafeAreaInsets();

  const [rates, setRates] = useState<ExchangeRate[] | null>(null);   // null = chargement
  const [raw, setRaw] = useState("1");
  const [to, setTo] = useState<string>(PREFERRED_TARGET);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getExchangeRates().then((list) => { if (alive) setRates(list); }).catch(() => { if (alive) setRates([]); });
    return () => { alive = false; };
  }, []);

  const targets = useMemo(() => (rates ? targetsFrom(rates) : []), [rates]);
  // Devise de réception : celle choisie si elle est publiée, sinon la préférée, sinon la première disponible.
  const target = targets.includes(to) ? to : targets.includes(PREFERRED_TARGET) ? PREFERRED_TARGET : (targets[0] ?? to);
  const rate = rates ? lookupRate(rates, FROM, target) : null;
  const amount = parseAmount(raw);

  // ── Frais estimés (public) ──
  const [feeEst, setFeeEst] = useState<FeeEst | null>(null);
  useEffect(() => {
    if (!(amount > 0) || rate === null || !branding.code) { setFeeEst(null); return; }
    let alive = true;
    const timer = setTimeout(async () => {
      const ask = async (payoutMethod: "WALLET" | "CASH_PICKUP") => {
        try {
          const params: Record<string, string | number> = { code: branding.code, amount, currency: FROM, payoutMethod };
          if (SEND_COUNTRY[FROM]) params.sendCountry = SEND_COUNTRY[FROM];
          if (RECEIVE_COUNTRY[target]) params.receiveCountry = RECEIVE_COUNTRY[target];
          const res = await (api.http as any).get("/public-fees/quote", { params });
          const body = res?.data?.data ?? res?.data;
          const f = Number(body?.fees);
          return Number.isFinite(f) && f >= 0 ? f : null;
        } catch { return null; }
      };
      const [w, c] = await Promise.all([ask("WALLET"), ask("CASH_PICKUP")]);
      if (!alive) return;
      setFeeEst(w === null && c === null ? null : { WALLET: w, CASH_PICKUP: c });
    }, 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [amount, rate, target, branding.code]);
  const received = rate !== null ? roundTo(amount * rate, decimalsFor(target)) : 0;

  const top = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 12) + 16;
  const bottom = Math.max(insets.bottom, 16) + 12;

  const rateText = rates === null
    ? t("land.rateLoading")
    : rate === null
      ? t("land.rateNone")
      : t("land.rateLine", { rate: `1 ${FROM} = ${fmtRate(rate)} ${target}` });

  // Ligne de montant : valeur à gauche, pastille de devise (drapeau + code) à droite.
  const currencyChip = (cur: string, onPress?: () => void) => {
    const body = (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CurrencyFlag currency={cur} size={26} />
        <Text allowFontScaling={false} style={{ fontFamily: SYSTEM_FONT, fontSize: 18, fontWeight: "700", color: C.text }}>{cur}</Text>
        {onPress ? <Ionicons name="chevron-down" size={18} color={C.muted} /> : null}
      </View>
    );
    return onPress ? (
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("land.pickCurrency")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {body}
      </Pressable>
    ) : body;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.accentSoft }}>
      <StatusBar barStyle={C.isDark ? "light-content" : "dark-content"} backgroundColor={C.accentSoft} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        {/* Panneau du bas : couleur d'accent pleine, coins arrondis (derrière les cartes) */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, backgroundColor: C.accent, borderTopLeftRadius: 36, borderTopRightRadius: 36 }}
        />

        <View style={{ flexGrow: 1, width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 20, paddingTop: top, paddingBottom: bottom }}>
          {/* ── Marque ── */}
          <Reveal delay={0} distance={-12}>
            <View style={{ alignItems: "center", gap: 10 }}>
              <View style={{ width: 76, height: 76, borderRadius: 24, ...S.sm }}>
                <TenantMark size={76} radius={24} background={C.accent} iconColor={C.accentInk} logoScale={0.78} animated />
              </View>
              <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6, color: C.accentDeep }} numberOfLines={1}>
                {branding.name}
              </Text>
              {!!branding.tagline && (
                <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 14, lineHeight: 20, color: C.muted, textAlign: "center" }} numberOfLines={2}>
                  {branding.tagline}
                </Text>
              )}
            </View>
          </Reveal>

          {/* ── Simulateur ── */}
          <Reveal delay={140} style={{ marginTop: 22 }}>
            <View style={[{ backgroundColor: C.surface, borderRadius: R.xl, padding: 20 }, S.md]}>
              <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13, color: C.muted }}>{t("land.youSend")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <TextInput
                  style={{ flex: 1, minWidth: 0, height: 54, padding: 0, fontFamily: SYSTEM_FONT, fontSize: 28, fontWeight: "800", color: C.ink }}
                  value={raw}
                  onChangeText={(v) => setRaw(sanitizeAmountInput(v, decimalsFor(FROM)))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={C.faint}
                  underlineColorAndroid="transparent"
                  selectTextOnFocus
                  accessibilityLabel={t("land.youSend")}
                />
                {currencyChip(FROM)}
              </View>

              <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13, color: C.muted, marginTop: 14 }}>{t("land.theyReceive")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text
                  style={{ flex: 1, minWidth: 0, height: 54, lineHeight: 54, fontFamily: SYSTEM_FONT, fontSize: 28, fontWeight: "800", color: rate === null ? C.faint : C.ink }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {rate === null ? "—" : fmtMoney(received, target)}
                </Text>
                {currencyChip(target, targets.length > 1 ? () => setPickOpen(true) : undefined)}
              </View>

              <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 14, color: C.accentDeep, fontWeight: "600", textAlign: "center", marginTop: 16 }}>{rateText}</Text>

              {feeEst && (
                <Reveal pop style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
                    {([["WALLET", "send.wallet", "phone-portrait-outline"], ["CASH_PICKUP", "send.cash", "cash-outline"]] as const).map(([k, label, icon]) => {
                      const f = feeEst[k];
                      if (f === null) return null;
                      return (
                        <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill ?? 999, backgroundColor: f === 0 ? C.posBg : C.accentSoft, borderWidth: 1, borderColor: f === 0 ? C.posLine : C.accentLine }}>
                          <Ionicons name={icon} size={14} color={f === 0 ? C.pos : C.accentDeep} />
                          <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12.5, fontWeight: "700", color: f === 0 ? C.pos : C.accentDeep }}>
                            {t(label)} · {f === 0 ? t("land.feesFree") : t("land.feesAmount", { amount: fmtMoney(f, FROM) })}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 11, color: C.muted, textAlign: "center", marginTop: 8 }}>{t("land.feesNote")}</Text>
                </Reveal>
              )}
            </View>
          </Reveal>

          <View style={{ flexGrow: 1, minHeight: 24 }} />

          {/* ── Actions ── */}
          <Reveal delay={300} style={{ marginTop: 22 }}>
            <View style={[{ backgroundColor: C.surface, borderRadius: R.xl, padding: 16, gap: 12 }, S.md]}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button label={t("land.signIn")} kind="outline" onPress={() => router.push("/(auth)/login-v2")} testID="land-signin" />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label={t("land.signUp")} onPress={() => router.push("/(auth)/account-type")} testID="land-signup" />
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal delay={400} distance={8} style={{ marginTop: 16 }}>
            <Text style={{ textAlign: "center", fontFamily: SYSTEM_FONT, fontSize: 11.5, color: C.accentInk, lineHeight: 17 }}>
              {t("land.byContinuing")}
              <Text style={{ color: C.accentInk, fontWeight: "700", textDecorationLine: "underline" }} onPress={() => router.push("/(auth)/terms")}>
                {t("land.terms")}
              </Text>
              {t("land.and")}
              <Text style={{ color: C.accentInk, fontWeight: "700", textDecorationLine: "underline" }} onPress={() => router.push("/(auth)/privacy-policy")}>
                {t("land.privacy")}
              </Text>
              .
            </Text>
          </Reveal>
        </View>
      </ScrollView>

      <ChoiceSheet<string>
        visible={pickOpen}
        onClose={() => setPickOpen(false)}
        title={t("land.pickCurrency")}
        items={targets}
        getKey={(c) => c}
        getLabel={(c) => c}
        getLeft={(c) => <CurrencyFlag currency={c} size={34} />}
        isSelected={(c) => c === target}
        onPick={(c) => setTo(c)}
      />
    </View>
  );
}
