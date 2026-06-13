// apps/direct-transfair-mobile/app/wallet-transfer.tsx
// =========================================================
// WALLET TRANSFER v6.1 — Direct Transf'air
// ✅ v6.1 sur base v6.0 :
//    - pageBg #F0FDF8 → #FAFAFA (fond neutre quasi-blanc)
//    - inputBg #F8FFFC → #F8F8F8 (inputsBG neutre)
//    - cardBorder #D1FAE5 → #E5E5EA (bordures neutres)
//    - freeBanner : fond blanc ombré (plus de greenPale)
//    - card : ombre neutre renforcée (#000), padding 16→12, mb 12→8
//    - convInput fontSize 20→14 (montants plus compacts)
//    - convBox padding 12→10
//    - scroll paddingTop 16→8 (moins de vide)
//    - recapCard : ombre neutre
//    - Logique métier 100 % inchangée
// =========================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated, Modal, FlatList,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

const { width: SW } = Dimensions.get("window");
const CONCAVE_H = 60;

// ─── Design System v6.1 ──────────────────────────────────
const C = {
  green:       "#059669", greenDark:   "#047857",
  greenLight:  "#F0FDF4", greenBorder: "#A7F3D0", greenPale: "#ECFDF5",
  heroGlass:   "rgba(255,255,255,0.14)", heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:     "rgba(255,255,255,0.65)", heroGlow: "rgba(255,255,255,0.08)",
  pageBg:      "#FAFAFA",            // ← était #F0FDF8 (vert pâle supprimé)
  white:       "#FFFFFF",
  cardBorder:  "#E5E5EA",            // ← était #D1FAE5 (bordure neutre)
  inputBg:     "#F8F8F8",            // ← était #F8FFFC (input neutre)
  ink:         "#0D2B1F", inkMid: "#1F5C3A", inkSoft: "#6B9E85",
  red:         "#EF4444", redBg:  "#FEF2F2",
  amber:       "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Indicatifs pays ────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+224", flag: "🇬🇳", name: "Guinée",        country: "GN", currency: "GNF" },
  { code: "+221", flag: "🇸🇳", name: "Sénégal",       country: "SN", currency: "XOF" },
  { code: "+225", flag: "🇨🇮", name: "Côte d'Ivoire", country: "CI", currency: "XOF" },
  { code: "+223", flag: "🇲🇱", name: "Mali",          country: "ML", currency: "XOF" },
  { code: "+226", flag: "🇧🇫", name: "Burkina Faso",  country: "BF", currency: "XOF" },
  { code: "+229", flag: "🇧🇯", name: "Bénin",         country: "BJ", currency: "XOF" },
  { code: "+228", flag: "🇹🇬", name: "Togo",          country: "TG", currency: "XOF" },
  { code: "+33",  flag: "🇫🇷", name: "France",        country: "FR", currency: "EUR" },
  { code: "+32",  flag: "🇧🇪", name: "Belgique",      country: "BE", currency: "EUR" },
  { code: "+44",  flag: "🇬🇧", name: "Royaume-Uni",   country: "GB", currency: "GBP" },
  { code: "+1",   flag: "🇺🇸", name: "États-Unis",    country: "US", currency: "USD" },
];
type CountryCode = (typeof COUNTRY_CODES)[number];

interface LookupResult {
  found:           boolean;
  isPlatformUser:  boolean;
  beneficiaryId?:  string;
  fullName?:       string;
  firstName?:      string;
  lastName?:       string;
  displayPhone?:   string;
  country?:        string;
  city?:           string;
  primaryCurrency?:string;
}

function fmt(n: number, currency = "XOF"): string {
  const isWhole = currency === "GNF" || currency === "XOF";
  const value   = isWhole ? Math.round(n) : n;
  const d       = isWhole ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  } catch { return value.toFixed(d); }
}

const QUICK_AMOUNTS: Record<string, number[]> = {
  XOF: [5_000,  10_000,  25_000,  50_000, 100_000, 200_000],
  GNF: [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000],
  EUR: [10,  20,  50, 100, 200, 500],
  USD: [10,  20,  50, 100, 200, 500],
  GBP: [10,  20,  50, 100, 200, 500],
};

// ─── Arc concave vert (transition hero → pageBg #FAFAFA) ──
function HeroConcave() {
  const d  = `M 0 0 L 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H} L ${SW} 0 Z`;
  const bd = `M 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H}`;
  return (
    <Svg width={SW} height={CONCAVE_H} style={{ marginTop: -1 }}>
      <Rect x={0} y={0} width={SW} height={CONCAVE_H} fill={C.pageBg} />
      <Path d={d} fill={C.green} />
      <Path d={bd} fill="none" stroke="rgba(5,150,105,0.18)" strokeWidth={1.5} />
    </Svg>
  );
}

// ─── Avatar helper ────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

// ─── Recipient Card ──────────────────────────────────────
function RecipientCard({ result }: { result: LookupResult }) {
  const name     = result.fullName || `${result.firstName ?? ""} ${result.lastName ?? ""}`.trim();
  const initials = name.split(" ").map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
  const colors   = avatarColor(name || "A");
  return (
    <View style={rc.card}>
      <View style={[rc.avatar, { backgroundColor: colors.bg }]}>
        <Text style={[rc.initials, { color: colors.text, fontFamily: C.font.serif }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[rc.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{name}</Text>
        {(result.city || result.country) && (
          <Text style={[rc.sub, { fontFamily: C.font.sans }]} numberOfLines={1}>
            {result.city ? `${result.city}, ` : ""}{result.country}
          </Text>
        )}
      </View>
      <View style={[rc.badge, {
        backgroundColor: result.isPlatformUser ? C.greenPale : C.amberBg,
        borderColor:     result.isPlatformUser ? C.greenBorder : C.amberBorder,
      }]}>
        <Ionicons name={result.isPlatformUser ? "checkmark-circle" : "person-outline"} size={11} color={result.isPlatformUser ? C.green : C.amber} />
        <Text style={[rc.badgeTxt, { color: result.isPlatformUser ? C.green : C.amber, fontFamily: C.font.sans }]}>
          {result.isPlatformUser ? "Enregistré" : "Contact"}
        </Text>
      </View>
    </View>
  );
}
const rc = StyleSheet.create({
  card:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.greenPale, borderRadius: C.r.md, padding: 12, borderWidth: 1, borderColor: C.greenBorder, marginTop: 8 },
  avatar:   { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  initials: { fontSize: 15, fontWeight: "900" },
  name:     { fontSize: 13, fontWeight: "700", color: C.ink, marginBottom: 2 },
  sub:      { fontSize: 10, color: C.inkSoft, fontWeight: "600" },
  badge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: C.r.pill, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── Not Found Card ──────────────────────────────────────
function NotFoundCard({ onAdd }: { onAdd: () => void }) {
  return (
    <TouchableOpacity style={nfc.card} onPress={onAdd} activeOpacity={0.82}>
      <View style={nfc.iconBox}>
        <Ionicons name="person-add-outline" size={18} color={C.inkSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[nfc.label, { fontFamily: C.font.sans }]}>Contact non trouvé</Text>
        <Text style={[nfc.action, { color: C.green, fontFamily: C.font.sans }]}>Ajouter comme nouveau contact →</Text>
      </View>
    </TouchableOpacity>
  );
}
const nfc = StyleSheet.create({
  card:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: C.r.md, padding: 12, borderWidth: 1, borderColor: C.cardBorder, marginTop: 8 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center" },
  label:   { fontSize: 12, fontWeight: "700", color: C.inkSoft, marginBottom: 2 },
  action:  { fontSize: 12, fontWeight: "800" },
});

// ─── Main Screen ─────────────────────────────────────────
export default function WalletTransferScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [phone,           setPhone]           = useState("");
  const [amount,          setAmount]          = useState("");
  const [loading,         setLoading]         = useState(false);
  const [converting,      setConverting]      = useState(false);
  const [lookupLoading,   setLookupLoading]   = useState(false);
  const [selectedCode,    setSelectedCode]    = useState<CountryCode>(COUNTRY_CODES[0]);
  const [showPicker,      setShowPicker]      = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [convRate,        setConvRate]        = useState<number | null>(null);
  const [lookupResult,    setLookupResult]    = useState<LookupResult | null>(null);
  const [recipientFocused,setRecipientFocused]= useState(false);
  const [amountFocused,   setAmountFocused]   = useState(false);
  const [showBalance,     setShowBalance]     = useState(true);

  const [wallet, setWallet] = useState<{
    currency: string; balance: number; loaded: boolean;
  }>({
    currency: ((user as any)?.primaryCurrency ?? "XOF") as string,
    balance:  0,
    loaded:   false,
  });

  const senderCurrency = wallet.currency;
  const currentBalance = wallet.balance;
  const insufficient   = (parseFloat(amount) || 0) > currentBalance && (parseFloat(amount) || 0) > 0;

  const summaryAnim = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
    api.getMyWallets().then((wallets) => {
      if (Array.isArray(wallets) && wallets.length > 0) {
        const primary = wallets.find((w) => w.isDefault) ?? wallets[0];
        if (primary?.currency) {
          const w = wallets.find((x) => x.currency === primary.currency) ?? primary;
          setWallet({ currency: primary.currency, balance: Number(w?.balance ?? 0), loaded: true });
        } else { setWallet(prev => ({ ...prev, loaded: true })); }
      } else { setWallet(prev => ({ ...prev, loaded: true })); }
    }).catch(() => { setWallet(prev => ({ ...prev, loaded: true })); });
  }, []);

  const numAmount      = parseFloat(amount) || 0;
  const targetCurrency = lookupResult?.primaryCurrency ?? selectedCode.currency;
  const isSameCurrency = targetCurrency === senderCurrency;
  const canSend        = phone.trim().length >= 6 && numAmount > 0 && !insufficient && lookupResult?.found === true;
  const showSummary    = numAmount > 0 && lookupResult?.found === true;
  const quickAmounts   = QUICK_AMOUNTS[senderCurrency] ?? QUICK_AMOUNTS.XOF;

  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 6) { setLookupResult(null); setLookupLoading(false); return; }
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    setLookupLoading(true);
    lookupDebounce.current = setTimeout(async () => {
      try {
        const res = await api.http.get("/beneficiaries/lookup", { params: { phone: `${selectedCode.code}${cleanPhone}` } });
        setLookupResult(res.data ?? { found: false, isPlatformUser: false });
      } catch {
        setLookupResult({ found: false, isPlatformUser: false });
      } finally { setLookupLoading(false); }
    }, 600);
    return () => { if (lookupDebounce.current) clearTimeout(lookupDebounce.current); };
  }, [phone, selectedCode.code]);

  const convertDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchConversion = useCallback(async (amt: number, from: string, to: string) => {
    if (amt <= 0 || from === to) { setConvertedAmount(amt > 0 ? amt : null); setConvRate(1); return; }
    setConverting(true);
    try {
      const result = await api.convertAmount(amt, from, to);
      setConvertedAmount(result.convertedAmount);
      setConvRate(result.rate);
    } catch { setConvertedAmount(null); setConvRate(null); }
    finally { setConverting(false); }
  }, []);

  useEffect(() => {
    if (numAmount <= 0 || !lookupResult?.found) { setConvertedAmount(null); return; }
    if (convertDebounce.current) clearTimeout(convertDebounce.current);
    convertDebounce.current = setTimeout(() => { void fetchConversion(numAmount, senderCurrency, targetCurrency); }, 500);
    return () => { if (convertDebounce.current) clearTimeout(convertDebounce.current); };
  }, [numAmount, senderCurrency, targetCurrency, lookupResult?.found]);

  useEffect(() => {
    Animated.timing(summaryAnim, { toValue: showSummary ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showSummary]);

  const handleTransfer = () => {
    if (!canSend) return;
    const recipientName = lookupResult?.fullName || `${lookupResult?.firstName ?? ""} ${lookupResult?.lastName ?? ""}`.trim() || phone.trim();
    const receivedDisplay = isSameCurrency
      ? `${fmt(numAmount, senderCurrency)} ${senderCurrency}`
      : `${convertedAmount !== null ? fmt(convertedAmount, targetCurrency) : "…"} ${targetCurrency}`;
    Alert.alert(
      "Confirmation",
      `Envoyer ${fmt(numAmount, senderCurrency)} ${senderCurrency} à ${recipientName}\nDestinataire reçoit : ${receivedDisplay}\nFrais : GRATUIT`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "CONFIRMER", onPress: () => void processTransfer() },
      ],
    );
  };

  const processTransfer = async () => {
    setLoading(true);
    try {
      if (!lookupResult?.found) {
        Alert.alert("Destinataire non enregistré", "Ce numéro n'est pas inscrit sur la plateforme.");
        return;
      }
      const fullPhone = `${selectedCode.code}${phone.trim().replace(/^0+/, "")}`;
      let beneficiaryId: string | undefined;

      if (lookupResult.beneficiaryId) {
        beneficiaryId = lookupResult.beneficiaryId;
      } else {
        const country = lookupResult.country?.trim() || selectedCode.name;
        const city    = lookupResult.city?.trim()    || country;
        const name    = lookupResult.fullName || `${lookupResult.firstName ?? ""} ${lookupResult.lastName ?? ""}`.trim() || fullPhone;
        try {
          const newBenef = await api.createBeneficiary({ fullName: name, phone: fullPhone, country, city });
          beneficiaryId = String(newBenef.id);
        } catch (createErr: any) {
          const msg = createErr?.response?.data?.message ?? "Erreur lors de l'enregistrement du contact.";
          Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
          return;
        }
      }

      await api.createTransaction({
        amount: numAmount, currency: senderCurrency,
        payoutMethod: "WALLET", beneficiaryId,
        senderFirstName: (user as any)?.firstName,
        senderLastName:  (user as any)?.lastName,
      } as any);

      await refreshUser?.();

      const recipientName = lookupResult.fullName || `${lookupResult.firstName ?? ""} ${lookupResult.lastName ?? ""}`.trim() || phone.trim();
      Alert.alert(
        "✅ Transfert réussi !",
        `${fmt(numAmount, senderCurrency)} ${senderCurrency} envoyé à ${recipientName}.` +
        (!isSameCurrency && convertedAmount !== null ? `\nMontant reçu : ${fmt(convertedAmount, targetCurrency)} ${targetCurrency}` : ""),
        [{ text: "Super !", onPress: () => router.back() }],
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Le transfert a échoué. Réessayez.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ══ HÉRO + ARC CONCAVE ══ */}
      <Animated.View style={{
        opacity:   headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }}>
        <View style={s.hero}>
          <View style={s.glow} />
          <View style={s.heroRow}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={20} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Transfert Wallet</Text>
              <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>Wallet → Wallet · 0 frais</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowBalance(!showBalance)}>
              <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={18} color={C.white} />
            </TouchableOpacity>
          </View>

          {/* Carte solde */}
          <View style={s.balCard}>
            <View style={{ flex: 1 }}>
              <Text style={[s.balLbl, { fontFamily: C.font.sans }]}>SOLDE DISPONIBLE</Text>
              <Text style={[s.balAmt, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {!wallet.loaded ? "—" : showBalance ? fmt(currentBalance, senderCurrency) : "••••••"}
              </Text>
              <Text style={[s.balCur, { fontFamily: C.font.sans }]}>{senderCurrency}</Text>
            </View>
            <View style={[s.balBadge, insufficient && { backgroundColor: C.amberBg, borderColor: C.amberBorder }]}>
              {insufficient ? (
                <>
                  <Ionicons name="warning-outline" size={12} color={C.amber} />
                  <Text style={[s.balBadgeTxt, { color: C.amber, fontFamily: C.font.sans }]}>Insuffisant</Text>
                </>
              ) : (
                <>
                  <View style={s.balDot} />
                  <Text style={[s.balBadgeTxt, { color: C.greenDark, fontFamily: C.font.sans }]}>Disponible</Text>
                </>
              )}
            </View>
          </View>
        </View>
        <HeroConcave />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Bannière gratuit — fond blanc ombré */}
          <View style={s.freeBanner}>
            <View style={s.freeIconBox}>
              <Ionicons name="flash" size={15} color={C.green} />
            </View>
            <Text style={[s.freeTxt, { fontFamily: C.font.sans }]}>
              Transfert instantané · <Text style={{ fontWeight: "900", color: C.green }}>0 frais</Text> · Conversion automatique
            </Text>
          </View>

          {/* ── Destinataire ── */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: C.green }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>DESTINATAIRE</Text>
            </View>

            <View style={[s.phoneRow, recipientFocused && { borderColor: C.green }]}>
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowPicker(true)}>
                <Text style={{ fontSize: 17 }}>{selectedCode.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>{selectedCode.code}</Text>
                <Ionicons name="chevron-down" size={11} color={C.inkSoft} />
              </TouchableOpacity>
              <View style={s.dialDivider} />
              <TextInput
                style={[s.phoneInput, { fontFamily: C.font.sans }]}
                value={phone}
                onChangeText={(v) => { setPhone(v); setLookupResult(null); }}
                placeholder="775 099 995"
                placeholderTextColor={C.inkSoft}
                keyboardType="phone-pad"
                onFocus={() => setRecipientFocused(true)}
                onBlur={() => setRecipientFocused(false)}
              />
              {lookupLoading ? (
                <ActivityIndicator size={13} color={C.green} style={{ marginRight: 12 }} />
              ) : phone.length > 0 ? (
                <TouchableOpacity onPress={() => { setPhone(""); setLookupResult(null); }} style={{ padding: 10 }}>
                  <Ionicons name="close-circle" size={15} color={C.inkSoft} />
                </TouchableOpacity>
              ) : null}
            </View>

            {!lookupLoading && lookupResult !== null && (
              lookupResult.found ? (
                <RecipientCard result={lookupResult} />
              ) : (
                phone.replace(/[^0-9]/g, "").length >= 6 && (
                  <NotFoundCard onAdd={() => router.push("/(tabs)/beneficiaries/create" as any)} />
                )
              )
            )}
          </View>

          {/* ── Montant ── */}
          {lookupResult?.found && (
            <View style={s.card}>
              <View style={s.secRow}>
                <View style={[s.secDot, { backgroundColor: C.green }]} />
                <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>MONTANT</Text>
              </View>

              {/* Boîte de conversion compacte */}
              <View style={[s.convBox, amountFocused && { borderColor: C.green }, insufficient && { borderColor: C.amber }]}>
                <View style={s.convSide}>
                  <Text style={[s.convLabel, { fontFamily: C.font.sans }]}>VOUS ENVOYEZ</Text>
                  <TextInput
                    style={[s.convInput, { fontFamily: C.font.serif, color: C.ink }]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    placeholderTextColor={C.inkSoft}
                    keyboardType="numeric"
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                  />
                  <Text style={[s.convCur, { color: C.green, fontFamily: C.font.mono }]}>{senderCurrency}</Text>
                </View>

                <View style={s.convArrow}>
                  {converting
                    ? <ActivityIndicator size={13} color={C.green} />
                    : <Ionicons name="swap-horizontal" size={16} color={C.green} />
                  }
                </View>

                <View style={[s.convSide, { alignItems: "flex-end" }]}>
                  <Text style={[s.convLabel, { fontFamily: C.font.sans }]}>
                    {lookupResult.firstName ?? "REÇOIT"}
                  </Text>
                  <Text style={[s.convInput, { fontFamily: C.font.serif, color: convertedAmount !== null ? C.greenDark : C.inkSoft }]}>
                    {converting ? "…" : convertedAmount !== null ? fmt(convertedAmount, targetCurrency) : numAmount > 0 ? "?" : "0"}
                  </Text>
                  <Text style={[s.convCur, { color: C.greenDark, fontFamily: C.font.mono }]}>{targetCurrency}</Text>
                </View>
              </View>

              {/* Taux de conversion */}
              {convRate !== null && !isSameCurrency && numAmount > 0 && (
                <View style={s.rateRow}>
                  <Ionicons name="information-circle-outline" size={11} color={C.green} />
                  <Text style={[s.rateTxt, { fontFamily: C.font.mono }]}>1 {senderCurrency} = {fmt(convRate, targetCurrency)} {targetCurrency}</Text>
                </View>
              )}

              <Text style={[s.quickLbl, { fontFamily: C.font.sans }]}>MONTANTS RAPIDES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
                {quickAmounts.map((v) => {
                  const active = numAmount === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[s.quickPill, active && { backgroundColor: C.greenPale, borderColor: C.green }]}
                      onPress={() => setAmount(String(v))}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.quickTxt, { color: active ? C.green : C.inkSoft, fontFamily: C.font.mono }]}>
                        {fmt(v, senderCurrency)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Récap animé */}
          <Animated.View style={[s.recapCard, {
            opacity:   summaryAnim,
            transform: [{ translateY: summaryAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }]}>
            <View style={s.recapHead}>
              <View style={[s.recapIconBox, { backgroundColor: C.greenPale }]}>
                <Ionicons name="receipt-outline" size={14} color={C.green} />
              </View>
              <Text style={[s.recapTitle, { fontFamily: C.font.sans }]}>Récapitulatif</Text>
            </View>
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Destinataire</Text>
              <Text style={[s.recapVal, { fontFamily: C.font.sans }]} numberOfLines={1}>
                {lookupResult?.fullName || `${lookupResult?.firstName ?? ""} ${lookupResult?.lastName ?? ""}`.trim() || `${selectedCode.flag} ${phone.trim()}`}
              </Text>
            </View>
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Montant envoyé</Text>
              <Text style={[s.recapVal, { fontFamily: C.font.mono }]}>{fmt(numAmount, senderCurrency)} {senderCurrency}</Text>
            </View>
            {!isSameCurrency && convertedAmount !== null && (
              <>
                <View style={s.recapDivider} />
                <View style={s.recapRow}>
                  <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Montant reçu</Text>
                  <Text style={[s.recapVal, { color: C.green, fontFamily: C.font.mono, fontWeight: "700" }]}>
                    {fmt(convertedAmount, targetCurrency)} {targetCurrency}
                  </Text>
                </View>
              </>
            )}
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Frais</Text>
              <View style={[s.freePill, { backgroundColor: C.greenPale, borderColor: C.greenBorder }]}>
                <Ionicons name="checkmark-circle" size={10} color={C.green} />
                <Text style={[s.freePillTxt, { fontFamily: C.font.sans }]}>Offerts</Text>
              </View>
            </View>
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapTotalLbl, { fontFamily: C.font.sans }]}>TOTAL DÉBITÉ</Text>
              <Text style={[s.recapTotalVal, { color: insufficient ? C.amber : C.green, fontFamily: C.font.serif }]}>
                {fmt(numAmount, senderCurrency)} {senderCurrency}
              </Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSend || loading) && { opacity: 0.4 }]}
            onPress={handleTransfer} disabled={!canSend || loading} activeOpacity={0.88}
          >
            <View style={[s.ctaInner, insufficient && { backgroundColor: C.amber }]}>
              {loading ? <ActivityIndicator color={C.white} /> : (
                <>
                  <Ionicons name="paper-plane-outline" size={17} color={C.white} />
                  <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>
                    {insufficient ? "SOLDE INSUFFISANT" : !lookupResult?.found ? "ENTREZ UN NUMÉRO ENREGISTRÉ" : "ENVOYER SANS FRAIS"}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          <View style={s.secNote}>
            <Ionicons name="shield-checkmark-outline" size={11} color={C.green} />
            <Text style={[s.secTxt, { fontFamily: C.font.sans }]}>Transfert sécurisé · Uniquement entre membres enregistrés</Text>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal sélecteur pays */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={pk.overlay}>
          <View style={pk.sheet}>
            <View style={pk.handle} />
            <Text style={[pk.title, { fontFamily: C.font.sans }]}>Choisir un pays</Text>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const active = selectedCode.code === item.code;
                return (
                  <TouchableOpacity
                    style={[pk.item, active && { backgroundColor: C.greenPale }]}
                    onPress={() => { setSelectedCode(item); setShowPicker(false); setLookupResult(null); }}
                  >
                    <Text style={{ fontSize: 22, marginRight: 12 }}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[pk.itemName, { fontFamily: C.font.sans }]}>{item.name}</Text>
                      <Text style={[pk.itemCur, { fontFamily: C.font.mono }]}>{item.currency}</Text>
                    </View>
                    <Text style={[pk.itemCode, { fontFamily: C.font.mono, color: active ? C.green : C.inkSoft }]}>{item.code}</Text>
                    {active && <Ionicons name="checkmark-circle" size={17} color={C.green} style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const pk = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:    { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: "70%", paddingBottom: Platform.OS === "ios" ? 36 : 18 },
  handle:   { width: 40, height: 4, borderRadius: 99, backgroundColor: "#E5E5EA", alignSelf: "center", marginBottom: 14 },
  title:    { fontSize: 16, fontWeight: "900", color: C.ink, marginBottom: 10 },
  item:     { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, marginBottom: 3 },
  itemName: { fontSize: 14, fontWeight: "700", color: C.ink },
  itemCur:  { fontSize: 10, color: C.inkSoft, marginTop: 1 },
  itemCode: { fontSize: 13, fontWeight: "800" },
});

// ─── Styles v6.1 ──────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },  // ← #FAFAFA

  // Héro (reste vert)
  hero: {
    backgroundColor: C.green,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 44 : 14,
    paddingBottom: 14,
    overflow:      "hidden",
  },
  glow:     { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:  { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBtn:  { width: 36, height: 36, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  heroTitle:{ color: C.white, fontSize: 19, fontWeight: "700" },
  heroSub:  { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 1 },

  balCard: {
    backgroundColor: C.white, borderRadius: C.r.xl,
    padding: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  balLbl:     { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 3, textTransform: "uppercase" },
  balAmt:     { fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },
  balCur:     { fontSize: 11, fontWeight: "800", color: C.green, marginTop: 2 },
  balBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenPale, borderWidth: 1, borderColor: C.greenBorder, borderRadius: C.r.pill, paddingHorizontal: 10, paddingVertical: 5 },
  balDot:     { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: C.green },
  balBadgeTxt:{ fontSize: 10, fontWeight: "700" },

  // ← paddingTop 16→8 (moins de vide en haut du scroll)
  scroll: { paddingHorizontal: 18, paddingTop: 8 },

  // ← fond blanc + ombre neutre (était greenPale + greenBorder, pas d'ombre)
  freeBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.white,
    borderRadius: C.r.md, padding: 11,
    borderWidth: 1, borderColor: C.cardBorder,
    marginBottom: 10,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  freeIconBox:{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.greenPale, justifyContent: "center", alignItems: "center" },
  freeTxt:    { flex: 1, color: C.inkMid, fontSize: 11, fontWeight: "600", lineHeight: 17 },

  // ← padding 16→12, mb 12→8, shadowColor "#000" (était C.green)
  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
      android: { elevation: 3 },
    }),
  },
  secRow:  { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  secDot:  { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl:  { fontSize: 9, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },

  phoneRow:    { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden" },
  dialBtn:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 11, paddingVertical: 11 },
  dialCode:    { fontSize: 12, fontWeight: "800", color: C.ink },
  dialDivider: { width: 1, height: 28, backgroundColor: C.cardBorder },
  phoneInput:  { flex: 1, paddingHorizontal: 11, paddingVertical: 11, fontSize: 14, color: C.ink, fontWeight: "600" },

  // ← padding 12→10
  convBox:   { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, padding: 10, marginBottom: 8 },
  convSide:  { flex: 1 },
  convLabel: { fontSize: 8, fontWeight: "900", color: C.inkSoft, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" },
  // ← fontSize 20→14 (montants plus compacts, les "000" ne débordent plus)
  convInput: { fontSize: 14, fontWeight: "800", letterSpacing: -0.3 },
  convCur:   { fontSize: 9, fontWeight: "900", marginTop: 3, letterSpacing: 1 },
  convArrow: { width: 32, alignItems: "center" },

  rateRow:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenPale, borderRadius: C.r.xs, padding: 7, marginBottom: 10, borderWidth: 1, borderColor: C.greenBorder },
  rateTxt:  { fontSize: 10, fontWeight: "700", color: C.greenDark },

  quickLbl: { fontSize: 8, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 7, textTransform: "uppercase", marginTop: 4 },
  quickRow: { gap: 7, paddingBottom: 2 },
  quickPill:{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: C.r.md, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  quickTxt: { fontSize: 11, fontWeight: "800" },

  // ← shadowColor "#000" (était C.green)
  recapCard: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: C.greenBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  recapHead:     { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  recapIconBox:  { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  recapTitle:    { fontSize: 11, fontWeight: "900", color: C.green, letterSpacing: 0.5 },
  recapRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recapLbl:      { color: C.inkSoft, fontSize: 11, fontWeight: "700" },
  recapVal:      { color: C.ink, fontSize: 12, fontWeight: "700", maxWidth: "55%" },
  recapDivider:  { height: 1, backgroundColor: C.greenBorder, marginVertical: 9 },
  recapTotalLbl: { color: C.ink, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  recapTotalVal: { fontSize: 19, fontWeight: "900" },
  freePill:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: C.r.pill, borderWidth: 1 },
  freePillTxt:   { color: C.green, fontSize: 9, fontWeight: "800" },

  cta:     { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10 },
  ctaInner:{ backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8, borderRadius: C.r.md },
  ctaTxt:  { color: C.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },

  secNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  secTxt:  { color: C.inkSoft, fontSize: 10, fontWeight: "600" },
});