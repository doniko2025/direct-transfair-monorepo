// apps/direct-transfair-mobile/components/dashboards/AgentDashboard.tsx
// =========================================================
// AGENT DASHBOARD v10.1 — Direct Transf'air
// ✅ v10.1 (cette version) :
//    - SECTION "SUIVI & RAPPORTS" convertie en grille de cartes (2 par
//      ligne), à la demande explicite : les 3 lignes cliquables
//      horizontales (ReportRow — icône + texte + chevron sur toute la
//      largeur) sont remplacées par des cartes verticales ombrées,
//      dans le MÊME langage visuel que OpCard utilisé juste au-dessus
//      (coin décoratif translucide, icône dans un cercle coloré, ombre
//      portée, flèche en bas à droite dans un cercle).
//    - NOUVEAU composant ReportCard (remplace ReportRow, qui est
//      retiré du fichier car plus utilisé nulle part) : mêmes props
//      (title, sub, icon, accent, bg, onPress, value optionnel). Le
//      "value" (ex. "1 EUR" pour Taux du Jour) devient un badge coloré
//      en haut à droite de la carte (même emplacement que le badge
//      "Nouveau" d'OpCard), au lieu d'un texte aligné à droite sur la
//      ligne.
//    - Disposition : 3 cartes → 2 sur la première ligne (Journal de
//      Caisse, Mes Commissions), 1 sur la seconde (Taux du Jour) +
//      un espaceur flex:1 pour garder la carte à mi-largeur (même
//      motif déjà utilisé pour la carte solo "Envoyer vers Admin").
//    - AUCUNE navigation/route touchée : les 3 onPress pointent
//      exactement vers les mêmes écrans qu'avant (/agent/transactions,
//      /agent/commissions, /(tabs)/rates).
// ✅ v10.0 :
//    - HÉRO REFONDU en une seule carte flottante sombre (LinearGradient),
//      inspirée de la capture de référence : salutation + solde regroupés
//      dans le même bloc (au lieu de 2 cartes empilées : topBar blanc +
//      balCard blanche séparée en v9.x).
//    - Carte héro : coins arrondis sur les 4 côtés (28px), marge autour
//      (flotte sur le fond clair du body), ombre portée profonde, dégradé
//      bleu-nuit (#0B1220 → #141F38), glows décoratifs (cercles translucides)
//      + fines lignes topographiques en SVG (purement décoratif, `Path`
//      désormais utilisé — `Rect` reste importé sans usage, comme avant).
//    - Montant du solde en accent bleu clair lumineux (#60A5FA) pour un
//      bon contraste sur fond sombre ; label, agence, footer en blanc/gris
//      translucide ; pill "ESPACE GUICHET", boutons (refresh/notif) et
//      avatar passés en style "glass" (fond blanc translucide) au lieu du
//      gris clair du v9.
//    - Le héro est désormais un premier enfant du ScrollView (au lieu d'un
//      bloc fixe au-dessus) : défilement plus naturel, cohérent avec la
//      référence. Le fond de page (SafeAreaView + ScrollView) passe en
//      off-white (`C.bodyBg`) sur toute la hauteur.
//    - ➕ AJOUT COSMÉTIQUE UNIQUEMENT : icône œil à côté du libellé "solde
//      agence" pour masquer/afficher le montant (state local `hideBalance`,
//      aucun appel API, aucune donnée modifiée — purement un affichage
//      masqué avec des "•"). Dis-moi si tu préfères que je la retire.
//    - StatChip : fine bordure gauche colorée (3px, couleur = accent de la
//      stat) ajoutée pour mieux relier visuellement les 3 chiffres aux
//      cartes/lignes en dessous (même langage visuel que OpCard/ReportRow).
//    - AUCUNE modification logique métier / API / navigation / états
//      existants (loadData, dérivations de balance/currency, stats, etc.
//      strictement identiques à la v9.1).
// ✅ v9.1 conservé : OpCard "Envoyer vers Admin" (additive, /agent/remit-to-admin)
// ✅ v9.0 conservé : design system clair (bodyBg off-white, cartes blanches
//    flottantes, StatChip agrandi, etc.) — toujours utilisé dans le corps
//    de l'écran (stats, opérations, rapports), uniquement le héro change.
// ✅ v8.0 / v7.0 : historique héro (LinearGradient bleu plein cadre, puis
//    arc concave) — remplacés depuis par le header blanc v9, puis par la
//    carte héro sombre flottante v10 ci-dessus.
// =========================================================

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Animated, Platform,
  useWindowDimensions, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg"; // Path utilisé (lignes déco héro) — Rect conservé, toujours inutilisé, OK
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");

// ─── Bleu accent (marque agent) ────────────────────────────
const AGENT_BLUE      = "#2563EB";
const AGENT_BLUE_DARK = "#1D4ED8";

// ─── Design System v10 ─────────────────────────────────────
const C = {
  accent:       AGENT_BLUE,
  accentDark:   AGENT_BLUE_DARK,
  accentPale:   "#EFF6FF",
  accentBorder: "#DBEAFE",

  // Alias compat sous-composants (OpCard / ReportRow / StatChip non modifiés en logique)
  violet:       AGENT_BLUE,
  violetDark:   AGENT_BLUE_DARK,
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",

  pageBg:       "#FFFFFF",
  bodyBg:       "#F7F8FA",   // fond off-white utilisé sur toute la hauteur en v10
  surface:      "#FFFFFF",
  white:        "#FFFFFF",
  cardBorder:   "#E8EDF5",

  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",

  green:        "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0", greenDark: "#065F46",
  red:          "#EF4444", redBg:   "#FEF2F2", redBorder:   "#FECACA",
  blue:         "#3B82F6", blueBg:  "#EFF6FF", blueBorder:  "#BFDBFE",
  amber:        "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  purple:       "#8B5CF6", purpleBg:"#F5F3FF", purpleBorder:"#DDD6FE",

  // ✅ v10.0 : tokens dédiés à la carte héro sombre (référence capture 2)
  heroBgFrom:        "#0B1220",
  heroBgMid:         "#141F38",
  heroBgTo:          "#0B1220",
  heroGlass:         "rgba(255,255,255,0.08)",
  heroGlassBorder:   "rgba(255,255,255,0.14)",
  heroTextPrimary:   "#FFFFFF",
  heroTextSecondary: "rgba(255,255,255,0.55)",
  heroTextFaint:     "rgba(255,255,255,0.35)",
  heroAccent:        "#60A5FA", // bleu clair lumineux, lisible sur fond sombre

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:   Platform.select({ ios: "Avenir Next", android: "sans-serif",        default: "sans-serif" }),
    medium: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:   Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Helpers (inchangés) ──────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}
function fmt(n: number, currency: string): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── Op Card (inchangé en logique / props) ─────────────────
function OpCard({ title, subtitle, icon, accent, bg, onPress, badge }: {
  title: string; subtitle: string; icon: string;
  accent: string; bg: string; onPress: () => void; badge?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={op.card} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[op.corner, { backgroundColor: bg }]} />
        <View style={[op.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={20} color={accent} />
        </View>
        {badge && (
          <View style={[op.badge, { backgroundColor: C.blueBg, borderColor: C.blueBorder }]}>
            <Text style={[op.badgeTxt, { color: C.blue, fontFamily: C.font.sans }]}>{badge}</Text>
          </View>
        )}
        <Text style={[op.title, { fontFamily: C.font.medium }]}>{title}</Text>
        <Text style={[op.sub, { fontFamily: C.font.sans }]} numberOfLines={2}>{subtitle}</Text>
        <View style={[op.arrow, { backgroundColor: bg }]}>
          <Ionicons name="arrow-forward" size={11} color={accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const op = StyleSheet.create({
  card: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 7,
    overflow: "hidden", minHeight: 130,
  },
  corner:   { position: "absolute", top: -16, right: -16, width: 56, height: 56, borderRadius: 28, opacity: 0.45 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  badge:    { position: "absolute", top: 9, right: 9, paddingHorizontal: 6, paddingVertical: 2, borderRadius: C.r.xs, borderWidth: 1 },
  badgeTxt: { fontSize: 7, fontWeight: "600", letterSpacing: 0.3 },
  title:    { fontSize: 13, fontWeight: "600", color: C.ink, marginBottom: 3, lineHeight: 18 },
  sub:      { fontSize: 10, fontWeight: "400", color: C.inkSoft, marginBottom: 10, lineHeight: 14 },
  arrow:    { position: "absolute", bottom: 10, right: 10, width: 22, height: 22, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});

// ─── Report Card — ✅ v10.1 (remplace ReportRow) ────────────
// Même langage visuel qu'OpCard (coin décoratif, icône en cercle,
// ombre portée, flèche en bas à droite) — pensée pour une grille de
// 2 cartes par ligne. Le "value" optionnel (ex. "1 EUR") devient un
// badge coloré en haut à droite, au même emplacement que le badge
// "Nouveau" d'OpCard.
function ReportCard({ title, sub, icon, accent, bg, onPress, value }: {
  title: string; sub: string; icon: string;
  accent: string; bg: string; onPress: () => void; value?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={rc.card} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[rc.corner, { backgroundColor: bg }]} />
        <View style={[rc.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={20} color={accent} />
        </View>
        {value && (
          <View style={[rc.valueBadge, { backgroundColor: bg, borderColor: `${accent}33` }]}>
            <Text style={[rc.valueTxt, { color: accent, fontFamily: C.font.mono }]}>{value}</Text>
          </View>
        )}
        <Text style={[rc.title, { fontFamily: C.font.medium }]}>{title}</Text>
        <Text style={[rc.sub, { fontFamily: C.font.sans }]} numberOfLines={2}>{sub}</Text>
        <View style={[rc.arrow, { backgroundColor: bg }]}>
          <Ionicons name="chevron-forward" size={13} color={accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rc = StyleSheet.create({
  card: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 7,
    overflow: "hidden", minHeight: 130,
  },
  corner:     { position: "absolute", top: -16, right: -16, width: 56, height: 56, borderRadius: 28, opacity: 0.45 },
  iconWrap:   { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  valueBadge: { position: "absolute", top: 9, right: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: C.r.xs, borderWidth: 1 },
  valueTxt:   { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  title:      { fontSize: 13, fontWeight: "600", color: C.ink, marginBottom: 3, lineHeight: 18 },
  sub:        { fontSize: 10, fontWeight: "400", color: C.inkSoft, marginBottom: 10, lineHeight: 14 },
  arrow:      { position: "absolute", bottom: 10, right: 10, width: 22, height: 22, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});

// ─── Stat Chip v10 — bordure gauche colorée ajoutée ────────
function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[sc.chip, { borderLeftColor: accent }]}>
      <Text style={[sc.val, { color: accent, fontFamily: C.font.medium }]}>{value}</Text>
      <Text style={[sc.lbl, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  chip: {
    flex: 1, backgroundColor: C.white, borderRadius: C.r.md, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: C.cardBorder,
    borderLeftWidth: 3, // ✅ v10.0 : couleur définie dynamiquement via `accent`
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  val: { fontSize: 22, fontWeight: "700", marginBottom: 3 },
  lbl: { fontSize: 9, fontWeight: "500", color: C.inkSoft, letterSpacing: 0.5, textTransform: "uppercase" },
});

// ─── Main ─────────────────────────────────────────────────
export default function AgentDashboard() {
  const { user } = useAuth();
  const router   = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // ── États (inchangés) ────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);
  const [stats,      setStats]      = useState({ total: 0, validated: 0, pending: 0 });

  // ✅ v10.0 — état purement cosmétique (masquage visuel du solde, aucune donnée touchée)
  const [hideBalance, setHideBalance] = useState(false);

  // ── Dérivations (inchangées) ─────────────────────────────
  const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    GN:"GNF", SN:"XOF", ML:"XOF", CI:"XOF", BF:"XOF", BJ:"XOF",
    TG:"XOF", NE:"XOF", GW:"XOF", FR:"EUR", DE:"EUR", BE:"EUR",
    IT:"EUR", ES:"EUR", PT:"EUR", NL:"EUR", GB:"GBP", US:"USD",
  };
  const agencyCountryCode = ((agencyData?.country ?? user?.agency?.country ?? "") as string).trim().toUpperCase().substring(0, 2);
  const derivedCurrency   = COUNTRY_CURRENCY_MAP[agencyCountryCode] ?? "XOF";
  const agencyName        = agencyData?.name ?? user?.agency?.name ?? "Mon Agence";
  const currency          = agencyData?.primaryCurrency || agencyData?.wallets?.[0]?.currency || derivedCurrency;

  const agencyWallet = Array.isArray(agencyData?.wallets)
    ? (agencyData.wallets.find((w: any) => w.isDefault) ?? agencyData.wallets[0])
    : null;
  const balance   = toNum(agencyWallet?.balance ?? agencyData?.balance);
  const reserved  = toNum(agencyWallet?.reservedBalance ?? 0);
  const available = balance - reserved;
  const availPct  = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const myId       = String(user?.id ?? "");

  // ── Chargement données (inchangé) ────────────────────────
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.agencyId) {
        const data = await api.getAgency(user.agencyId as string);
        setAgencyData(data);
      }
      const [txRes, wdRes] = await Promise.allSettled([api.getTransactions(), api.getWithdrawals()]);
      const allTx: any[] = txRes.status === "fulfilled" ? txRes.value : [];
      const allWd: any[] = wdRes.status === "fulfilled" ? wdRes.value : [];

      const processedWdTxIds = new Set(
        allWd
          .filter((w) => String(w.processedById ?? "") === myId && w.transactionId)
          .map((w) => String(w.transactionId))
      );
      const agentTxs = allTx.filter((tx) => {
        const type = String(tx.type ?? "").toUpperCase();
        if (type === "AGENCY_REFILL" || type === "REFILL") return true;
        if (type === "DEPOSIT" && String(tx.senderId ?? "") === myId) return true;
        if (processedWdTxIds.has(String(tx.id)))               return true;
        if (String(tx.senderId ?? "") === myId)                 return true;
        return false;
      });
      setStats({
        total:     agentTxs.length,
        validated: agentTxs.filter((tx) => tx.status === "PAID"    || tx.status === "VALIDATED").length,
        pending:   agentTxs.filter((tx) => tx.status === "PENDING" || tx.status === "PROCESSING").length,
      });
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, [user?.agencyId, myId]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [loadData]));

  // ── Initiales agent ──────────────────────────────────────
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => (n as string)[0].toUpperCase())
    .join("")
    .substring(0, 2) || "AG";

  return (
    // ✅ v10.0 : fond off-white sur toute la hauteur (le héro sombre flotte dessus)
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bodyBg} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.body, isDesktop && { maxWidth: 960, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={AGENT_BLUE} />}
      >
        {/* ══════════ HÉRO — carte flottante sombre v10.0 ══════════
            Regroupe salutation + actions + solde dans une seule carte
            (référence capture 2), au lieu de 2 blocs blancs séparés (v9.x).
        */}
        <Animated.View style={{
          opacity:   headerAnim,
          transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
        }}>
          <View style={s.heroWrap}>
            <LinearGradient
              colors={[C.heroBgFrom, C.heroBgMid, C.heroBgTo]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              {/* Décor : glows translucides + fines lignes topographiques (purement cosmétique) */}
              <View style={s.heroGlowTop} pointerEvents="none" />
              <View style={s.heroGlowBottom} pointerEvents="none" />
              <Svg
                width="100%" height="100%" viewBox="0 0 400 220"
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                <Path d="M-20,50 C60,20 140,80 220,45 C300,10 360,60 420,35"   stroke="rgba(255,255,255,0.07)"  strokeWidth={1} fill="none" />
                <Path d="M-20,95 C70,70 150,125 230,90 C310,55 370,105 420,80" stroke="rgba(255,255,255,0.05)"  strokeWidth={1} fill="none" />
                <Path d="M-20,140 C80,115 160,170 240,135 C320,100 380,150 420,125" stroke="rgba(255,255,255,0.035)" strokeWidth={1} fill="none" />
              </Svg>

              {/* ── Ligne du haut : salutation + actions ── */}
              <View style={s.topBar}>
                <View style={{ flex: 1 }}>
                  <View style={s.pill}>
                    <View style={s.pillDot} />
                    <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>ESPACE GUICHET</Text>
                  </View>
                  <Text style={[s.heroName, { fontFamily: C.font.serif }]}>
                    Bonjour, {user?.firstName || "Agent"} 👋
                  </Text>
                  <View style={s.agencyRow}>
                    <Ionicons name="storefront-outline" size={11} color={C.heroTextSecondary} />
                    <Text style={[s.agencyTxt, { fontFamily: C.font.sans }]} numberOfLines={1}>
                      {agencyName}
                    </Text>
                  </View>
                </View>

                <View style={s.topActions}>
                  <TouchableOpacity style={s.iconBtnDark} onPress={loadData}>
                    <Ionicons name="refresh" size={15} color={C.heroTextPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtnDark} onPress={() => router.push("/(tabs)/notifications")}>
                    <Ionicons name="notifications-outline" size={15} color={C.heroTextPrimary} />
                    {stats.pending > 0 && <View style={s.notifBadge} />}
                  </TouchableOpacity>
                  <View style={s.avatarDark}>
                    <Text style={[s.avatarTxt, { fontFamily: C.font.medium }]}>{initials}</Text>
                  </View>
                </View>
              </View>

              {/* ── Solde ── */}
              <View style={s.balBlock}>
                <View style={s.balTop}>
                  <View style={{ flex: 1 }}>
                    <View style={s.balLblRow}>
                      <Text style={[s.balLbl, { fontFamily: C.font.sans }]}>
                        solde agence · {currency.toLowerCase()}
                      </Text>
                      {/* ✅ v10.0 : bascule d'affichage purement visuelle (masque avec des •) */}
                      <TouchableOpacity onPress={() => setHideBalance(v => !v)} hitSlop={8}>
                        <Ionicons name={hideBalance ? "eye-off-outline" : "eye-outline"} size={12} color={C.heroTextFaint} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[s.balAmt, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
                      {hideBalance ? "•• ••• ••" : fmt(balance, currency)}
                    </Text>
                    <Text style={[s.balCur, { fontFamily: C.font.sans }]}>{currency}</Text>
                  </View>
                  <View style={s.onlinePill}>
                    <View style={s.onlineDot} />
                    <Text style={[s.onlineTxt, { fontFamily: C.font.sans }]}>En ligne</Text>
                  </View>
                </View>

                <View style={s.progBg}>
                  <View style={[s.progFill, { width: `${availPct}%` as any }]} />
                </View>

                <View style={s.balFooter}>
                  <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                    Disponible{" "}
                    <Text style={s.balFootVal}>
                      {hideBalance ? "••••" : `${fmt(available, currency)} ${currency}`}
                    </Text>
                  </Text>
                  <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                    Réservé{" "}
                    <Text style={[s.balFootVal, { color: C.heroTextSecondary }]}>
                      {hideBalance ? "••••" : `${fmt(reserved, currency)} ${currency}`}
                    </Text>
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Stats réelles */}
        <View style={s.statsRow}>
          <StatChip label="Opérations" value={String(stats.total)}     accent={AGENT_BLUE} />
          <StatChip label="Validées"   value={String(stats.validated)} accent={C.green}    />
          <StatChip label="En attente" value={String(stats.pending)}   accent={C.amber}    />
        </View>

        {/* Opérations rapides */}
        <View style={s.secRow}>
          <View style={s.secLine} />
          <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>OPÉRATIONS RAPIDES</Text>
        </View>

        <View style={s.opsRow}>
          <OpCard title="Dépôt Client"   subtitle="Recharger un compte" icon="arrow-down-circle-outline" accent={C.green}  bg={C.greenBg}  onPress={() => router.push("/agent/deposit")} />
          <OpCard title="Retrait Client" subtitle="Payer un code"       icon="arrow-up-circle-outline"   accent={C.red}    bg={C.redBg}    onPress={() => router.push("/agent/withdraw")} />
        </View>

        {/* "Envoyer vers Admin" (v9.1, additif, inchangé) */}
        <View style={[s.opsRow, { marginBottom: 12 }]}>
          <OpCard
            title="Envoyer vers Admin"
            subtitle="Remontée de fonds"
            icon="paper-plane-outline"
            accent={C.violet}
            bg={C.violetLight}
            onPress={() => router.push("/agent/remit-to-admin" as any)}
          />
          <View style={{ flex: 1 }} />
        </View>

        <View style={[s.opsRow, { marginBottom: 28 }]}>
          <OpCard title="Envoi Cash"   subtitle="Sans compte"         icon="paper-plane-outline" accent={C.blue}   bg={C.blueBg}   onPress={() => router.push("/agent/send-cash")} badge="Nouveau" />
          <OpCard title="Clôture Jour" subtitle="Bilan & commissions" icon="calculator-outline"  accent={C.purple} bg={C.purpleBg} onPress={() => router.push("/agent/commissions")} />
        </View>

        {/* Suivi & rapports */}
        <View style={[s.secRow, { marginTop: 2 }]}>
          <View style={[s.secLine, { backgroundColor: C.blue }]} />
          <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>SUIVI & RAPPORTS</Text>
        </View>

        <View style={s.opsRow}>
          <ReportCard title="Journal de Caisse" sub="Toutes les opérations du jour" icon="list-outline"      accent={C.amber}  bg={C.amberBg}  onPress={() => router.push("/agent/transactions")} />
          <ReportCard title="Mes Commissions"   sub="Gains, paliers et historique"  icon="bar-chart-outline" accent={C.purple} bg={C.purpleBg} onPress={() => router.push("/agent/commissions")} />
        </View>
        <View style={[s.opsRow, { marginBottom: 12 }]}>
          <ReportCard title="Taux du Jour" sub="Devises & taux de change" icon="trending-up-outline" accent={C.green} bg={C.greenBg} onPress={() => router.push("/(tabs)/rates")} value="1 EUR" />
          <View style={{ flex: 1 }} />
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles v10.0 ─────────────────────────────────────────
const s = StyleSheet.create({

  // ✅ v10.0 : fond off-white sur toute la hauteur (le héro flotte dessus)
  safe: { flex: 1, backgroundColor: C.bodyBg },

  // ── Body / ScrollView ──
  scroll: { flex: 1, backgroundColor: C.bodyBg },
  body: {
    paddingHorizontal: 16,
    paddingTop:    Platform.OS === "android" ? 36 : 14,
    paddingBottom: 4,
  },

  // ── Héro : wrapper (ombre, non clippée) + carte (gradient, clippée) ──
  // ✅ v10.0 : l'ombre est posée sur le wrapper (sans overflow:hidden) pour
  // ne pas être coupée par le borderRadius + overflow:hidden de la carte
  // elle-même (nécessaire pour clipper le SVG déco et les glows).
  heroWrap: {
    marginBottom: 22,
    borderRadius: 28,
    backgroundColor: C.heroBgMid, // requis sur Android pour que l'ombre (elevation) s'affiche
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  hero: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: "hidden",
  },
  heroGlowTop: {
    position: "absolute", top: -70, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(96,165,250,0.20)",
  },
  heroGlowBottom: {
    position: "absolute", bottom: -60, left: -50,
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: "rgba(16,185,129,0.10)",
  },

  // ── Top bar (dans le héro) ──
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 18 },

  // ✅ v10.0 : pill "glass" (fond blanc translucide) sur fond sombre
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBorder,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    alignSelf: "flex-start", marginBottom: 8,
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.heroAccent },
  pillTxt: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.85)", letterSpacing: 1 },

  heroName:  { fontSize: 23, fontWeight: "700", color: C.heroTextPrimary, marginBottom: 4 },
  agencyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  agencyTxt: { fontSize: 10, color: C.heroTextSecondary, fontWeight: "500" },

  // ✅ v10.0 : boutons + avatar "glass" (fond blanc translucide sur fond sombre)
  topActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconBtnDark: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: C.heroGlass,
    borderWidth: 1, borderColor: C.heroGlassBorder,
    justifyContent: "center", alignItems: "center",
  },
  notifBadge: {
    position: "absolute", top: 6, right: 6,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: C.red, borderWidth: 1.5, borderColor: C.heroBgMid,
  },
  avatarDark: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(96,165,250,0.22)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.4)",
    justifyContent: "center", alignItems: "center",
  },
  avatarTxt: { fontSize: 11, fontWeight: "700", color: "#DBEAFE" },

  // ── Solde (dans le héro) ──
  balBlock:   { marginTop: 2 },
  balTop:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  balLblRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  balLbl:     { fontSize: 9, color: C.heroTextSecondary, fontWeight: "500", letterSpacing: 0.5, textTransform: "uppercase" },
  balAmt:     { fontSize: 34, fontWeight: "800", color: C.heroAccent, letterSpacing: -0.5 },
  balCur:     { fontSize: 11, fontWeight: "700", color: C.heroTextSecondary, marginTop: 2 },
  onlinePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(16,185,129,0.14)", borderWidth: 1, borderColor: "rgba(16,185,129,0.35)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  onlineTxt: { fontSize: 9, fontWeight: "600", color: "#A7F3D0" },
  progBg:    { height: 5, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 3, marginBottom: 12, overflow: "hidden" },
  progFill:  { height: 5, backgroundColor: C.heroAccent, borderRadius: 3 },
  balFooter: { flexDirection: "row", justifyContent: "space-between" },
  balFootLbl:{ fontSize: 9, color: C.heroTextSecondary, fontWeight: "500" },
  balFootVal:{ fontWeight: "700", color: C.heroAccent },

  // ── Sections / grilles (inchangé, hors héro) ──
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  secRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secLine: { width: 16, height: 3, borderRadius: 2, backgroundColor: C.accent },
  secLbl:  { fontSize: 10, fontWeight: "700", color: C.inkSoft, letterSpacing: 1.2 },

  opsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
});