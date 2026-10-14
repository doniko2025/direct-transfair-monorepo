// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// CLIENT DASHBOARD v10.0 — Direct Transf'air
// ✅ v10.0 : 🔥 REFONTE TOTALE de l'accueil wallet, et correction des chargements infinis.
//    • Design : en-tête de marque (couleur du tenant), carte de solde « bancaire » qui chevauche l'en-tête,
//      actions Envoyer / Recharger / Taux / QR, envoi rapide, bilan du mois, activité récente. Tout vient du
//      kit components/wallet (thème white-label, plus de couleurs codées en dur par écran).
//    • Chargement : useLoader() borne l'attente (20 s, EXPO_PUBLIC_LOAD_TIMEOUT_MS). Plus de spinner qui
//      tourne dans le vide : squelettes, message « le serveur démarre », puis erreur claire + « Réessayer ».
//    • Données : mêmes appels qu'avant (refreshUser, getTransactions, getExchangeRates) ; getTransactions
//      demande { limit: 30 } (ignoré par un ancien backend, pris en compte par le nouveau).
//    • Logique métier inchangée : solde disponible, réservé, stats du mois, contacts récents, navigation.
// ✅ v9.9 : REMPLACEMENT bouton "Historique" → "Recharger"
//    PUREMENT NAVIGATION — aucune ligne de logique métier touchée.
//    "Historique" faisait doublon avec l'onglet "Activité" (barre de
//    nav, voir (tabs)/_layout.tsx) et pointait vers la même route
//    (/(tabs)/transactions). Remplacé par "Recharger", qui ouvre le
//    nouvel écran de recharge wallet (carte bancaire / Orange Money /
//    Sendwave — voir app/(tabs)/recharge.tsx).
// ✅ v9.1 sur base v9.0 :
//    - Vert émeraude #17A45F (plus vif, moins corporate)
//    - Hero réduit : paddingBottom 28→16, nom 22→19
//    - Devise affichée DEVANT le solde (EUR 214,78)
//    - CTA "Envoyer" : bouton BLANC ombré (plus de vert)
//    - Icônes actions rapides : carrés blancs ombrés + icône émeraude
//    - Logique métier 100 % inchangée
// ✅ v9.2 : FIX — liste des transactions cachée derrière la tab bar.
//           Ajout de useSafeAreaInsets + TAB_BAR_HEIGHT pour calculer
//           un paddingBottom dynamique (au lieu du spacer fixe de 24px
//           qui ne suffisait pas à libérer la zone sous la tab bar).
// ✅ v9.3 : REFONTE VISUELLE "Blanc pur · Cartes flottantes · Vert émeraude"
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (loadData, calculs monthSent/monthRecv, recentContacts, wallets,
//    helpers toNum/fmt/fmtDate, navigation : tout identique).
//    - Hero : fond vert plein → fond blanc pur. Le solde passe en texte
//      sombre, le préfixe devise (EUR) repasse en vert émeraude au lieu
//      de blanc semi-transparent.
//    - StatusBar : light-content → dark-content (fond clair désormais).
//    - Notification/avatar : boutons adaptés à un fond clair (cercle
//      gris très pâle + bordure pour la cloche, cercle vert plein pour
//      l'avatar — au lieu des cercles "glass" blanc transparent qui
//      n'étaient visibles que sur fond vert).
//    - NOUVEAU bandeau taux sous le solde ("EUR → XOF · 655,96 · Envoi
//      wallet 0 frais") : réutilise simplement l'état `eurXofRate` déjà
//      récupéré par loadData() (aucun nouvel appel API). Tap → /(tabs)/rates,
//      comme le bouton "Taux" des actions rapides.
//    - En conséquence, la 3ème carte "EUR → XOF" de la rangée de stats
//      est retirée (elle ferait doublon avec ce nouveau bandeau). Le
//      state eurXofRate et son fetch restent inchangés, seul l'endroit
//      où on l'affiche change.
//    - Cartes "Actions rapides" : bordure verte très pâle ajoutée pour
//      l'effet "carte flottante" du mockup, au lieu du blanc + ombre seule.
// ✅ v9.4 : HERO SANS VERT + CARTE FLOTTANTE
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (mêmes states, mêmes calculs, mêmes appels API, mêmes routes).
//    - Plus aucune couleur verte dans le Hero : avatar (vert → encre
//      anthracite), préfixe devise (vert → encre sourdine), pastille
//      "En ligne" (vert → bleu, réutilise le token déjà existant pour
//      le statut "Traitement", donc rien de neuf dans la palette).
//    - Le Hero passe d'un fond blanc plat à un fond gris (même teinte
//      que le corps de page) : Hero et body se fondent en un seul
//      canevas continu, plus de rupture visuelle en bas du Hero.
//    - Le bloc solde devient une carte flottante blanche détachée
//      (nouveau style `balanceCard`) avec une ombre plus marquée
//      (`heroCardShadow`) que les autres cartes, pour bien la mettre
//      en avant comme élément central de l'écran.
//    - Élément signature : léger filigrane (icône "wallet") en
//      arrière-plan de la carte solde, posé en coin, opacité quasi
//      nulle — clin d'œil "carte bancaire premium" sans surcharger.
//    - Bouton notification : fond blanc + légère ombre (au lieu du
//      gris pâle) pour bien se détacher du nouveau fond gris du Hero.
//    - SafeAreaView / StatusBar : fond blanc → fond gris (cohérent
//      avec le nouveau Hero gris, pour une transition invisible sous
//      l'encoche / la barre de statut).
// ✅ v9.5 : FIX — "Bon retour / Fatim" + cloche/avatar recouverts par la
//    barre de statut système (surtout visible sur Android). En cause :
//    SafeAreaView importé depuis "react-native" ne réserve l'espace de
//    la status bar que sur iOS, pas sur Android. Le Hero utilise déjà
//    `insets` (useSafeAreaInsets, importé depuis react-native-safe-area-
//    context et déjà utilisé pour le paddingBottom du ScrollView) : on
//    applique maintenant `insets.top + 8` en paddingTop du Hero, qui
//    fonctionne de façon fiable sur les deux plateformes.
//    Fix annexe : paddingHorizontal du Hero 20 → 10 pour agrandir la
//    carte solde.
// ✅ v9.6 : 2 retouches ponctuelles — paddingHorizontal Hero 10 → 6,
//    et fond marron plein ajouté derrière l'icône wallet.
// ✅ v9.7 : CORRECTIF de la v9.6 — rien d'autre touché.
//    1) Filigrane portefeuille : retour à l'icône SEULE, SANS le carré
//       de fond ajouté en v9.6 (ce carré peignait le CONTENANT de
//       l'icône, pas l'icône elle-même — erreur signalée). Remplacé par
//       l'icône pleine "wallet" (au lieu de "wallet-outline") directement
//       en brun plein #8E562E (même couleur que celle tracée sur le
//       mockup), sans aucun cadre ni case derrière.
//    2) Carte solde élargie davantage : paddingHorizontal du Hero
//       6 → 2, pour coller au rectangle quasi bord-à-bord du mockup.
// ✅ v9.8 : REFONTE HERO — dégradé sombre + solde intégré + sheet arrondie
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (mêmes states, mêmes calculs, mêmes appels API, mêmes routes, mêmes
//    animations heroAnim/contentAnim, même fix insets.top + 8).
//    - Hero : fond gris plat → dégradé sombre (expo-linear-gradient, du
//      quasi-noir #0A0F0D vers un vert forêt #123324) qui redonne une
//      identité de marque forte au premier écran.
//    - La carte solde flottante (`balanceCard` / `heroCardShadow`) est
//      supprimée : le solde vit maintenant à même le hero, en plus
//      grand (32→40), comme le mockup validé.
//    - Filigrane wallet : déplacé à même le hero, couleur adaptée (vert
//      très translucide au lieu de brun, illisible sur fond sombre).
//    - Pastille "En ligne" : bleu → vert translucide (le bleu avait été
//      choisi en v9.4 pour bannir le vert d'un hero clair ; ce n'est
//      plus nécessaire, le hero a maintenant sa propre identité verte).
//    - Avatar : encre → vert plein (même raison).
//    - Bouton notification : style "verre" (fond blanc à 8 % d'opacité)
//      pour rester lisible sur fond sombre.
//    - paddingHorizontal du Hero : 2 → 24. Le 2px de la v9.7 calibrait
//      la CARTE solde au bord ; sans carte flottante, le texte a besoin
//      de sa propre marge pour ne plus toucher les bords de l'écran.
//    - NOUVEAU : le body (ScrollView) est enveloppé dans une "sheet" à
//      coins arrondis (28) qui chevauche le bas du hero (marginTop -28)
//      pour la transition sombre → clair. Fond de la sheet : toujours
//      C.pageBg (gris clair) → AUCUN changement sur les cartes
//      existantes (mainCta, Actions rapides, Envoi rapide, stats,
//      Transactions), leur style reste identique à la v9.7.
//    - StatusBar : dark-content → light-content (hero sombre désormais),
//      backgroundColor aligné sur le premier ton du dégradé.
//    - NOUVELLE DÉPENDANCE : expo-linear-gradient
//      → npx expo install expo-linear-gradient
// =========================================================

import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import BalanceCard from "../wallet/BalanceCard";
import { HeaderIconButton } from "../wallet/ScreenHeader";
import { Avatar, Card, QuickAction, SectionTitle, TransactionRow } from "../wallet/WalletParts";
import { SkeletonCard, SkeletonList } from "../wallet/Skeleton";
import { EmptyState, ErrorState, SlowHint } from "../wallet/StateViews";
import { useLoader } from "../wallet/useLoader";
import {
  FONT, N, RADIUS, TAB_BAR_SPACE, formatMoney, initialsOf, toNum, useWalletTheme,
} from "../wallet/walletTheme";

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

type DashData = { txs: any[]; eurXofRate: number | null };

// ─── Écran ────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { P } = useWalletTheme();
  const [hidden, setHidden] = useState(false);

  const firstName = user?.firstName ?? "Client";
  const fullName  = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

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
    let eurXofRate: number | null = null;
    if (rates.status === "fulfilled" && Array.isArray(rates.value)) {
      const pair = rates.value.find((r: any) => r.pair === "EUR/XOF" || r.pair === "EUR_XOF");
      if (pair?.rate) eurXofRate = Number(pair.rate);
    }
    return { txs, eurXofRate };
  });

  const txs = data?.txs ?? [];
  const eurXofRate = data?.eurXofRate ?? null;

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

  // ── Contacts récents (logique inchangée) ──
  const recentContacts = (() => {
    const seen = new Set<string>();
    const result: Array<{ name: string; phone?: string; beneficiaryId?: string }> = [];
    for (const tx of txs) {
      if (tx.senderId !== user?.id) continue;
      const name  = tx.beneficiary?.fullName ?? tx.recipient?.firstName;
      const phone = tx.beneficiary?.phone ?? tx.recipient?.phone;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({ name, phone, beneficiaryId: tx.beneficiaryId });
      if (result.length >= 6) break;
    }
    return result;
  })();

  const recentTxs = txs.slice(0, 5);
  const rateLabel = eurXofRate != null
    ? `1 EUR = ${formatMoney(eurXofRate, "XOF")} XOF · envoi wallet sans frais`
    : null;

  const topPad = Math.max(insets.top, Platform.OS === "android" ? 28 : 20) + 10;

  return (
    <View style={{ flex: 1, backgroundColor: N.page }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={P.accent} />}
      >
        {/* ── En-tête : salutation + notifications ── */}
        <LinearGradient
          colors={[P.bg1, P.bg2, P.bg3]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad }]}
        >
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.85} accessibilityLabel="Mon compte">
            <Avatar name={fullName || firstName} size={44} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.hello}>{greeting()}</Text>
            <Text style={s.name} numberOfLines={1}>{firstName}</Text>
          </View>
          <HeaderIconButton icon="notifications-outline" label="Notifications" onPress={() => router.push("/(tabs)/notifications")} />
        </LinearGradient>

        <View style={s.body}>
          {/* ── Carte de solde, chevauche l'en-tête ── */}
          <View style={s.balanceWrap}>
            <BalanceCard
              currency={primaryCurrency}
              available={availableBalance}
              reserved={reservedBalance}
              hidden={hidden}
              onToggleHidden={() => setHidden((h) => !h)}
              holder={fullName}
              rateLabel={rateLabel}
              onPressRate={() => router.push("/(tabs)/rates")}
            />
          </View>

          <SlowHint visible={slow} />

          {/* ── Actions ── */}
          <Card>
            <View style={s.actions}>
              <QuickAction primary icon="paper-plane" label="Envoyer" onPress={() => router.push("/(tabs)/send")} />
              <QuickAction icon="add-circle-outline" label="Recharger" onPress={() => router.push("/(tabs)/recharge")} />
              <QuickAction icon="swap-horizontal" label="Taux" onPress={() => router.push("/(tabs)/rates")} />
              <QuickAction icon="qr-code-outline" label="QR Code" onPress={() => router.push("/(tabs)/qr")} />
            </View>
          </Card>

          {/* ── Envoi rapide ── */}
          {recentContacts.length > 0 && (
            <View>
              <SectionTitle title="Envoi rapide" action="Tous les contacts" onAction={() => router.push("/(tabs)/beneficiaries")} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 2 }}>
                {recentContacts.map((c, i) => (
                  <TouchableOpacity
                    key={`${c.name}-${i}`}
                    style={s.contact}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/send",
                        params: c.beneficiaryId ? { beneficiaryId: c.beneficiaryId } : { phone: c.phone, name: c.name },
                      })
                    }
                  >
                    <Avatar name={c.name} size={54} />
                    <Text style={s.contactName} numberOfLines={1}>{c.name.split(" ")[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Ce mois-ci ── */}
          <View style={s.statsRow}>
            <View style={[s.stat, { borderColor: "#EEF2F0" }]}>
              <View style={[s.statIcon, { backgroundColor: "#F2F4F7" }]}><Ionicons name="arrow-up" size={16} color={N.inkSub} /></View>
              <Text style={s.statLabel}>Envoyé ce mois</Text>
              <Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {hidden ? "••••" : formatMoney(monthSent, primaryCurrency)}
              </Text>
              <Text style={s.statCur}>{primaryCurrency}</Text>
            </View>
            <View style={[s.stat, { borderColor: "#EEF2F0" }]}>
              <View style={[s.statIcon, { backgroundColor: N.okBg }]}><Ionicons name="arrow-down" size={16} color={N.ok} /></View>
              <Text style={s.statLabel}>Reçu ce mois</Text>
              <Text style={[s.statVal, { color: N.ok }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {hidden ? "••••" : formatMoney(monthRecv, primaryCurrency)}
              </Text>
              <Text style={s.statCur}>{primaryCurrency}</Text>
            </View>
          </View>

          {/* ── Activité récente ── */}
          <View>
            <SectionTitle title="Activité récente" action="Voir tout" onAction={() => router.push("/(tabs)/transactions")} />
            <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }} padded={false}>
              {status === "loading" ? (
                <SkeletonList rows={3} />
              ) : status === "error" ? (
                <ErrorState compact title={error?.title ?? "Chargement impossible"} message={error?.message ?? ""} onRetry={reload} />
              ) : recentTxs.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title="Aucune transaction"
                  message="Tes envois et réceptions apparaîtront ici."
                  actionLabel="Envoyer de l'argent"
                  onAction={() => router.push("/(tabs)/send")}
                />
              ) : (
                recentTxs.map((tx, i) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    userId={user?.id}
                    last={i === recentTxs.length - 1}
                    onPress={() => router.push(`/(tabs)/transactions/${tx.id}`)}
                  />
                ))
              )}
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 64,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  hello: { fontFamily: FONT.body, fontSize: 13, color: "rgba(255,255,255,0.75)" },
  name:  { fontFamily: FONT.display, fontSize: 22, fontWeight: "700", color: "#fff", letterSpacing: -0.3 },

  body: { paddingHorizontal: 16, gap: 18, marginTop: -48 },
  balanceWrap: {},

  actions: { flexDirection: "row", gap: 6 },

  contact: { alignItems: "center", gap: 7, width: 64 },
  contactName: { fontFamily: FONT.medium, fontSize: 12, fontWeight: "600", color: N.inkSub },

  statsRow: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1, backgroundColor: "#fff", borderRadius: RADIUS.lg + 2, borderWidth: 1, padding: 14, gap: 3,
    shadowColor: "#06231C", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statLabel: { fontFamily: FONT.body, fontSize: 12, color: N.muted },
  statVal: { fontFamily: FONT.display, fontSize: 21, fontWeight: "700", color: N.ink, letterSpacing: -0.4 },
  statCur: { fontFamily: FONT.medium, fontSize: 11, fontWeight: "700", color: N.muted },
});
