// apps/direct-transfair-mobile/app/index.tsx
// =========================================================
// ACCUEIL v6.6 — Direct Transf'air (white-label)
// ✅ v6.6 : (1) SANS DÉFILEMENT : la carte du simulateur est plus compacte (marges, lignes de 48, montants 28) et la page s'adapte à la hauteur réelle de
//    l'écran — si le contenu dépasse encore, le bandeau « 3 étapes » disparaît d'abord, puis les tailles se resserrent (niveaux 0 → 2) ; le défilement
//    n'est actif que clavier ouvert ; (2) ombre de la carte plus marquée (Android compris : élévation + liseré teinté) ;
//    (3) après déconnexion (client ou marchand) cette page est la page de repli — voir AuthProvider v7.5.
// ✅ v6.5 : proposition « B » — la carte du simulateur CHEVAUCHE le panneau du bas (lueur teintée par la couleur de la société) ; le panneau
//    contient le bandeau « 3 étapes » (icônes), les boutons et les conditions, et descend jusqu'en bas de l'écran (plus de vide). Logo / montants
//    plus grands sur les écrans hauts. Couleurs toujours 100 % dynamiques.
// ✅ v6.4 : (1) OMBRE MARQUÉE sous la carte du simulateur (double ombre + liseré) et sous la carte d'actions ; (2) MOINS DE VIDE : le panneau de couleur
//    enveloppe maintenant exactement les boutons (au lieu d'une hauteur fixe de 330) et les éléments sont plus grands (logo 64, montants 28) ;
//    (3) bandeau « 3 étapes » (Créez votre compte · Ajoutez un bénéficiaire · Envoyez votre argent) dans l'espace libre — masqué clavier ouvert et sur petit écran (< 700 px de haut).
//    COULEURS : toujours 100 % dynamiques (couleur principale / accent de la société, thème clair / sombre). Taux, frais, navigation : inchangés.
// ✅ v6.3 : page COMPACTE sans défilement — marque 20, montants 22 (comme les cartes de l'accueil), pastilles et boutons `compact` (48), marges réduites.
// ✅ v6.2 : (1) l'accueil est enfin la page PAR DÉFAUT (le garde de navigation d'AuthProvider ne renvoie plus vers la connexion : il faut un appui sur
//    « Se connecter » / « S'inscrire ») ; (2) boutons EMPILÉS pleine largeur : « Se connecter » n'est plus tronqué ; (3) le montant « Ils reçoivent »
//    est SAISISSABLE (calcul dans les deux sens : on tape l'un, l'autre se met à jour) ; (4) le taux vient de la table que l'admin de la société met à jour (taux par société)
//    (GET /exchange-rates) et se rafraîchit tout seul (toutes les 60 s et au retour dans l'app) ; (5) logo via <BrandLogo size={56} /> : taille standard, ratio
//    automatique, sans tuile d'une autre forme ; (6) marge haute sûre (jamais sous la barre d'état).
// ✅ v6.0 : REFONTE « esprit Taptap Send » — le logo de la société en haut, une carte avec un SIMULATEUR de taux (vous envoyez / ils
//    reçoivent, calculé avec les taux publiés par la société : GET /exchange-rates?code=…, public), puis une carte d'actions
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
import { AppState, Platform, Pressable, ScrollView, StatusBar, View, useWindowDimensions, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUI, SYSTEM_FONT, alpha } from "../components/ui/theme";
import { Button } from "../components/ui/Primitives";
import { ChoiceSheet } from "../components/ui/ChoiceSheet";
import { Ionicons } from "../components/ui/Icon";
import { useKeyboardOpen } from "../components/ui/Layout";
import BrandLogo from "../components/brand/BrandLogo";
import { safeTop } from "../utils/safeArea";
import { CurrencyFlag } from "../components/home/HomeParts";
import Reveal from "../components/flow/Reveal";
import { useTenant } from "../providers/TenantProvider";
import { getPlatformName, isPlatformCode } from "../services/platformConfig";
import { api } from "../services/api";
import { useServerStatus } from "../services/serverWarmup";
import type { ExchangeRate } from "../services/types";
import { lookupRate } from "../utils/rateLookup";
import { amountFontFor, decimalsFor, fmtMoney, fmtRate, groupAmount, parseAmount, roundTo, sanitizeAmountInput, toInputText } from "../utils/amount";

import { Text, TextInput } from "../components/ui/Text";
import { useT } from "../providers/I18nProvider";

const FROM = "EUR";
const PREFERRED_TARGET = "GNF";
/** Pays d'envoi supposé (l'expéditeur n'est pas connu avant la connexion) et pays de réception déduit de la devise quand elle est sans ambiguïté. */
const SEND_COUNTRY: Record<string, string> = { EUR: "FR" };
const RECEIVE_COUNTRY: Record<string, string> = { GNF: "GN" };

type FeeEst = { WALLET: number | null; CASH_PICKUP: number | null };

/** Lueur de la carte du simulateur : ombre longue teintée par la couleur principale de la société + ombre courte neutre (v6.5). */
function glowShadow(color: string): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 22px 46px -10px ${alpha(color, 0.5)}, 0 6px 14px rgba(0,0,0,0.12)` } as any,
    default: { shadowColor: color, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.42, shadowRadius: 26, elevation: 18 },
  }) as ViewStyle;
}

/** Hauteur de la carte qui « déborde » sur le panneau du bas. */
const OVERLAP = 44;

/** Les 3 étapes affichées entre le simulateur et les boutons. */
const STEPS = [
  { icon: "person-outline", label: "land.step1" },
  { icon: "people-outline", label: "land.step2" },
  { icon: "paper-plane-outline", label: "land.step3" },
] as const;

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
  const kb = useKeyboardOpen();                         // clavier ouvert : on masque le bandeau « 3 étapes » pour garder la place aux montants
  const { height: winH } = useWindowDimensions();
  // ── Pas de défilement : on mesure la zone visible et la hauteur réelle du contenu. Si ça dépasse, on resserre par niveaux :
  //    0 = tout (bandeau « 3 étapes » + tailles normales) · 1 = sans bandeau · 2 = sans bandeau + tailles resserrées.
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [level, setLevel] = useState(0);
  const showSteps = !kb && level === 0;
  const tight = level >= 2;                              // tailles resserrées (très petits écrans / police agrandie)

  const [rates, setRates] = useState<ExchangeRate[] | null>(null);   // null = chargement
  const [raw, setRaw] = useState("1");                 // montant tapé dans « Vous envoyez »
  const [rawRecv, setRawRecv] = useState("");            // montant tapé dans « Ils reçoivent »
  const [source, setSource] = useState<"SEND" | "RECV">("SEND");   // quel champ la personne est en train de saisir
  const [to, setTo] = useState<string>(PREFERRED_TARGET);
  const [pickOpen, setPickOpen] = useState(false);

  // Taux = ceux que la société publie (GET /exchange-rates?code=…, taux PAR SOCIÉTÉ). On les relit toutes les 60 s et au retour dans l'app : un changement
  // fait côté admin apparaît ici sans relancer l'application. Un échec ponctuel ne vide pas un taux déjà affiché.
  useEffect(() => {
    let alive = true;
    const load = () => api.getExchangeRates()
      .then((list) => { if (alive) setRates((prev) => (list.length > 0 || prev === null ? list : prev)); })
      .catch(() => { if (alive) setRates((prev) => prev ?? []); });
    void load();
    const timer = setInterval(() => void load(), 60_000);
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") void load(); });
    return () => { alive = false; clearInterval(timer); sub.remove(); };
  }, []);

  // Réveil du serveur dès l'ouverture de l'app (hébergement gratuit : veille après ~15 min). Dès qu'il répond, on relit les taux TOUT DE SUITE :
  // sans ça, un premier appel parti pendant le réveil échouait et il fallait attendre jusqu'à 60 s pour voir le taux.
  const { status: serverStatus } = useServerStatus();
  useEffect(() => {
    if (serverStatus !== "ready") return;
    let alive = true;
    api.getExchangeRates()
      .then((list) => { if (alive && list.length > 0) setRates(list); })
      .catch(() => {});
    return () => { alive = false; };
  }, [serverStatus]);

  const targets = useMemo(() => (rates ? targetsFrom(rates) : []), [rates]);
  // Devise de réception : celle choisie si elle est publiée, sinon la préférée, sinon la première disponible.
  const target = targets.includes(to) ? to : targets.includes(PREFERRED_TARGET) ? PREFERRED_TARGET : (targets[0] ?? to);
  const rate = rates ? lookupRate(rates, FROM, target) : null;
  const dRecv = decimalsFor(target);
  // Le champ saisi fait foi ; l'autre est calculé avec le taux publié.
  const amount = source === "SEND"
    ? parseAmount(raw)
    : (rate ? roundTo(parseAmount(rawRecv) / rate, decimalsFor(FROM)) : 0);

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
  const received = source === "RECV" ? parseAmount(rawRecv) : (rate !== null ? roundTo(amount * rate, dRecv) : 0);
  // Texte affiché dans chaque champ : celui qu'on saisit reste tel quel (pas de reformatage pendant la frappe), l'autre est calculé.
  const sendText = source === "SEND" ? raw : (rate && amount > 0 ? toInputText(amount, decimalsFor(FROM)) : "");
  const recvText = source === "RECV" ? rawRecv : (rate && received > 0 ? toInputText(received, dRecv) : "");

  const top = safeTop(insets.top) + 6;
  const bottom = Math.max(insets.bottom, 10) + 8;

  // Serveur en veille : on le dit au lieu d'un « Chargement du taux… » muet (le réveil prend 30 à 60 s au plus).
  const rateText = (rates === null || (rate === null && serverStatus === "waking"))
    ? (serverStatus === "waking" ? t("land.rateWaking") : t("land.rateLoading"))
    : rate === null
      ? t("land.rateNone")
      : t("land.rateLine", { rate: `1 ${FROM} = ${fmtRate(rate)} ${target}` });

  // Ligne de montant : valeur à gauche, pastille de devise (drapeau + code) à droite.
  // Nouveau calcul de mise en page quand l'écran, le clavier ou la présence des pastilles de frais changent (la carte change alors de hauteur).
  const hasFees = !!feeEst;
  useEffect(() => { setLevel(0); }, [winH, kb, hasFees, branding.name]);
  useEffect(() => {
    if (kb || !viewH || !contentH) return;
    if (contentH > viewH + 2 && level < 2) setLevel((l) => l + 1);   // ça dépasse : on resserre d'un cran
  }, [contentH, viewH, level, kb]);

  const currencyChip = (cur: string, onPress?: () => void) => {
    const body = (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <CurrencyFlag currency={cur} size={22} />
        <Text allowFontScaling={false} style={{ fontFamily: SYSTEM_FONT, fontSize: 15, fontWeight: "700", color: C.text }}>{cur}</Text>
        {onPress ? <Ionicons name="chevron-down" size={16} color={C.muted} /> : null}
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
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentH(h)}
        scrollEnabled={kb}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ flexGrow: 1 }}>
          {/* ── Partie haute : marque + simulateur ── */}
          <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 20, paddingTop: top, zIndex: 2 }}>
            {/* ── Marque ── */}
            <Reveal delay={0} distance={-12}>
              <View style={{ alignItems: "center", gap: tight ? 3 : 5 }}>
                <BrandLogo size={tight ? 52 : 64} />
                <Text style={{ fontFamily: SYSTEM_FONT, fontSize: tight ? 19 : 21, lineHeight: tight ? 24 : 26, fontWeight: "800", letterSpacing: -0.4, color: C.accentDeep }} numberOfLines={1}>
                  {branding.name}
                </Text>
                {!!branding.tagline && (
                  <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12, lineHeight: 16, color: C.muted, textAlign: "center" }} numberOfLines={2}>
                    {branding.tagline}
                  </Text>
                )}
              </View>
            </Reveal>

            {/* ── Simulateur ── */}
            <Reveal delay={140} style={{ marginTop: tight ? 10 : 14 }}>
              <View style={[{ backgroundColor: C.surface, borderRadius: R.xl, padding: tight ? 12 : 16, borderWidth: 1, borderColor: alpha(C.sun, 0.12) }, glowShadow(C.sun)]}>
                <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12, color: C.muted }}>{t("land.youSend")}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <TextInput
                    style={{ flex: 1, minWidth: 0, height: tight ? 40 : 48, padding: 0, fontFamily: SYSTEM_FONT, fontSize: amountFontFor(groupAmount(sendText), tight ? 24 : 28), fontWeight: "800", color: C.ink }}
                    value={groupAmount(sendText)}
                    onChangeText={(v) => { setSource("SEND"); setRaw(sanitizeAmountInput(v, decimalsFor(FROM))); }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={C.faint}
                    underlineColorAndroid="transparent"
                    selectTextOnFocus
                    accessibilityLabel={t("land.youSend")}
                  />
                  {currencyChip(FROM)}
                </View>

                <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12, color: C.muted, marginTop: tight ? 6 : 10 }}>{t("land.theyReceive")}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <TextInput
                    style={{ flex: 1, minWidth: 0, height: tight ? 40 : 48, padding: 0, fontFamily: SYSTEM_FONT, fontSize: amountFontFor(groupAmount(recvText), tight ? 24 : 28), fontWeight: "800", color: rate === null ? C.faint : C.ink }}
                    value={rate === null ? "" : groupAmount(recvText)}
                    onChangeText={(v) => { setSource("RECV"); setRawRecv(sanitizeAmountInput(v, dRecv)); }}
                    keyboardType="decimal-pad"
                    placeholder={rate === null ? "—" : "0"}
                    placeholderTextColor={C.faint}
                    editable={rate !== null}
                    underlineColorAndroid="transparent"
                    selectTextOnFocus
                    accessibilityLabel={t("land.theyReceive")}
                  />
                  {currencyChip(target, targets.length > 1 ? () => setPickOpen(true) : undefined)}
                </View>

                <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12.5, color: C.accentDeep, fontWeight: "600", textAlign: "center", marginTop: tight ? 8 : 10 }}>{rateText}</Text>

                {feeEst && (
                  <Reveal pop style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
                      {([["WALLET", "send.wallet", "phone-portrait-outline"], ["CASH_PICKUP", "send.cash", "cash-outline"]] as const).map(([k, label, icon]) => {
                        const f = feeEst[k];
                        if (f === null) return null;
                        return (
                          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill ?? 999, backgroundColor: f === 0 ? C.posBg : C.accentSoft, borderWidth: 1, borderColor: f === 0 ? C.posLine : C.accentLine }}>
                            <Ionicons name={icon} size={14} color={f === 0 ? C.pos : C.accentDeep} />
                            <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 11.5, fontWeight: "700", color: f === 0 ? C.pos : C.accentDeep }}>
                              {t(label)} · {f === 0 ? t("land.feesFree") : t("land.feesAmount", { amount: fmtMoney(f, FROM) })}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 10.5, color: C.muted, textAlign: "center", marginTop: 6 }}>{t("land.feesNote")}</Text>
                  </Reveal>
                )}
              </View>
            </Reveal>
          </View>

          {/* ── Panneau du bas : démarre derrière la carte (elle le chevauche) et descend jusqu'au bas de l'écran ── */}
          <View style={{ flexGrow: 1, marginTop: -OVERLAP, zIndex: 1, backgroundColor: C.accent, borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingTop: OVERLAP + 14, paddingBottom: Math.max(bottom, 12) }}>
            <View style={{ flexGrow: 1, minHeight: 8 }} />

            {/* ── 3 étapes (masquées clavier ouvert et sur les petits écrans) ── */}
            {showSteps && (
              <Reveal delay={240}>
                <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 24, flexDirection: "row", gap: 6 }}>
                  {STEPS.map((st) => (
                    <View key={st.label} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      <View style={[{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }, S.md]}>
                        <Ionicons name={st.icon} size={19} color={C.sun} />
                      </View>
                      <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 11.5, lineHeight: 14, fontWeight: "700", color: C.accentInk, textAlign: "center" }} numberOfLines={3}>
                        {t(st.label)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Reveal>
            )}

            <View style={{ flexGrow: showSteps ? 0.8 : 0, minHeight: showSteps ? 18 : 0 }} />

            <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 20 }}>
              {/* ── Actions ── */}
              <Reveal delay={300}>
                <View style={[{ backgroundColor: C.surface, borderRadius: R.xl, padding: 12, gap: 8 }, S.lg]}>
                  {/* Empilés, pleine largeur : les libellés ne sont jamais tronqués (quelle que soit la langue ou la taille de police). */}
                  <Button compact label={t("land.signUp")} onPress={() => router.push("/(auth)/account-type")} testID="land-signup" />
                  <Button compact label={t("land.signIn")} kind="outline" onPress={() => router.push("/(auth)/login-v2")} testID="land-signin" />
                </View>
              </Reveal>

              <Reveal delay={400} distance={8} style={{ marginTop: 12 }}>
                <Text style={{ textAlign: "center", fontFamily: SYSTEM_FONT, fontSize: 11, color: C.accentInk, lineHeight: 15 }}>
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
                {/* Société hébergée : la plateforme (société mère) est citée en texte, jamais avec son logo (celui de la société reste seul). */}
                {!isPlatformCode(branding.code) && (
                  <Text style={{ textAlign: "center", fontFamily: SYSTEM_FONT, fontSize: 10, color: C.accentInk, opacity: 0.6, lineHeight: 14, marginTop: 4 }}>
                    {t("land.poweredBy", { name: getPlatformName() })}
                  </Text>
                )}
              </Reveal>
            </View>
          </View>
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
