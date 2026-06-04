// apps/direct-transfair-mobile/app/wallet-transfer.tsx
// =========================================================
// WALLET TRANSFER v5.2 — Direct Transf'air
// ✅ v5.1 : vrai appel API + sélecteur indicatif + conversion temps réel
// ✅ FIX v5.2 : "beneficiaryId should not be empty"
//    AVANT : createBeneficiary({ city: "" }) → validation DTO rejetée
//    MAINTENANT : utilise le lookup pour récupérer country+city valides
// ✅ NEW v5.2 : Auto-suggestion destinataire par numéro de téléphone
//    - Appel GET /beneficiaries/lookup?phone=... (debounce 600ms)
//    - Si trouvé : RecipientCard avec nom, pays, badge "Enregistré"
//    - Si non trouvé : NotFoundCard "Ajouter comme contact →"
//    - Devise cible issue de primaryCurrency du destinataire (lookup)
//    - Section montant masquée jusqu'à ce qu'un destinataire soit trouvé
//    - Transfert bloqué si destinataire non enregistré sur la plateforme
// =========================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated, Modal, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

// ─── Design System ──────────────────────────────────────
const C = {
  green:       "#059669",
  greenDark:   "#047857",
  greenLight:  "#F0FDF4",
  greenBorder: "#A7F3D0",
  greenPale:   "#ECFDF5",
  heroGlass:   "rgba(255,255,255,0.14)",
  heroGlassBdr:"rgba(255,255,255,0.22)",
  heroDim:     "rgba(255,255,255,0.65)",
  heroGlow:    "rgba(255,255,255,0.08)",
  pageBg:      "#F0FDF8",
  white:       "#FFFFFF",
  cardBorder:  "#D1FAE5",
  inputBg:     "#F8FFFC",
  ink:         "#0D2B1F",
  inkMid:      "#1F5C3A",
  inkSoft:     "#6B9E85",
  red:         "#EF4444",
  redBg:       "#FEF2F2",
  amber:       "#F59E0B",
  amberBg:     "#FFFBEB",
  amberBorder: "#FDE68A",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",            default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Indicatifs pays → devise ────────────────────────────
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

// ─── Type résultat lookup ─────────────────────────────────
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
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

// ─── Avatar helper ────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

// ─── Recipient Card ───────────────────────────────────────
function RecipientCard({ result }: { result: LookupResult }) {
  const name     = result.fullName ||
    `${result.firstName ?? ""} ${result.lastName ?? ""}`.trim();
  const initials = name
    .split(" ").map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
  const colors = avatarColor(name || "A");

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
        <Ionicons
          name={result.isPlatformUser ? "checkmark-circle" : "person-outline"}
          size={11}
          color={result.isPlatformUser ? C.green : C.amber}
        />
        <Text style={[rc.badgeTxt, {
          color:      result.isPlatformUser ? C.green : C.amber,
          fontFamily: C.font.sans,
        }]}>
          {result.isPlatformUser ? "Enregistré" : "Contact"}
        </Text>
      </View>
    </View>
  );
}
const rc = StyleSheet.create({
  card:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.greenPale, borderRadius: C.r.md, padding: 13, borderWidth: 1, borderColor: C.greenBorder, marginTop: 8 },
  avatar:   { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  initials: { fontSize: 16, fontWeight: "900" },
  name:     { fontSize: 14, fontWeight: "700", color: C.ink, marginBottom: 2 },
  sub:      { fontSize: 10, color: C.inkSoft, fontWeight: "600" },
  badge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: C.r.pill, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── Not Found Card ───────────────────────────────────────
function NotFoundCard({ onAdd }: { onAdd: () => void }) {
  return (
    <TouchableOpacity style={nfc.card} onPress={onAdd} activeOpacity={0.82}>
      <View style={nfc.iconBox}>
        <Ionicons name="person-add-outline" size={20} color={C.inkSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[nfc.label, { fontFamily: C.font.sans }]}>Contact non trouvé</Text>
        <Text style={[nfc.action, { color: C.green, fontFamily: C.font.sans }]}>
          Ajouter comme nouveau contact →
        </Text>
      </View>
    </TouchableOpacity>
  );
}
const nfc = StyleSheet.create({
  card:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8FFFC", borderRadius: C.r.md, padding: 13, borderWidth: 1, borderColor: C.cardBorder, marginTop: 8 },
  iconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center" },
  label:   { fontSize: 12, fontWeight: "700", color: C.inkSoft, marginBottom: 2 },
  action:  { fontSize: 12, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function WalletTransferScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [phone,            setPhone]            = useState("");
  const [amount,           setAmount]           = useState("");
  const [loading,          setLoading]          = useState(false);
  const [converting,       setConverting]       = useState(false);
  const [lookupLoading,    setLookupLoading]    = useState(false);
  const [selectedCode,     setSelectedCode]     = useState<CountryCode>(COUNTRY_CODES[0]);
  const [showPicker,       setShowPicker]       = useState(false);
  const [convertedAmount,  setConvertedAmount]  = useState<number | null>(null);
  const [convRate,         setConvRate]         = useState<number | null>(null);
  const [lookupResult,     setLookupResult]     = useState<LookupResult | null>(null);
  const [recipientFocused, setRecipientFocused] = useState(false);
  const [amountFocused,    setAmountFocused]    = useState(false);
  const [senderCurrency,   setSenderCurrency]   = useState<string>(
    (user as any)?.primaryCurrency ?? "EUR"
  );
  const [currentBalance,   setCurrentBalance]   = useState(0);

  const summaryAnim = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
    api.getMyWallets().then((wallets) => {
      if (wallets?.length) {
        const primary = wallets.find((w) => w.isDefault) ?? wallets[0];
        if (primary?.currency) {
          setSenderCurrency(primary.currency);
          const w = wallets.find((x) => x.currency === primary.currency);
          if (w) setCurrentBalance(Number(w.balance ?? 0));
        }
      }
    }).catch(() => {});
  }, []);

  const numAmount     = parseFloat(amount) || 0;
  const insufficient  = numAmount > currentBalance && numAmount > 0;

  // Devise cible : priorité au primaryCurrency du destinataire (lookup)
  const targetCurrency = lookupResult?.primaryCurrency ?? selectedCode.currency;
  const isSameCurrency = targetCurrency === senderCurrency;

  const canSend =
    phone.trim().length >= 6 &&
    numAmount > 0 &&
    !insufficient &&
    lookupResult?.found === true;

  const showSummary = numAmount > 0 && lookupResult?.found === true;

  // ── Lookup par téléphone (debounce 600ms) ────────────
  const lookupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 6) {
      setLookupResult(null);
      setLookupLoading(false);
      return;
    }

    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    setLookupLoading(true);

    lookupDebounce.current = setTimeout(async () => {
      try {
        const fullPhone = `${selectedCode.code}${cleanPhone}`;
        const res = await api.http.get("/beneficiaries/lookup", {
          params: { phone: fullPhone },
        });
        setLookupResult(res.data ?? { found: false, isPlatformUser: false });
      } catch {
        setLookupResult({ found: false, isPlatformUser: false });
      } finally {
        setLookupLoading(false);
      }
    }, 600);

    return () => {
      if (lookupDebounce.current) clearTimeout(lookupDebounce.current);
    };
  }, [phone, selectedCode.code]);

  // ── Conversion temps réel (debounce 500ms) ───────────
  const convertDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversion = useCallback(
    async (amt: number, from: string, to: string) => {
      if (amt <= 0 || from === to) {
        setConvertedAmount(amt > 0 ? amt : null);
        setConvRate(1);
        return;
      }
      setConverting(true);
      try {
        const result = await api.convertAmount(amt, from, to);
        setConvertedAmount(result.convertedAmount);
        setConvRate(result.rate);
      } catch {
        setConvertedAmount(null);
        setConvRate(null);
      } finally {
        setConverting(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (numAmount <= 0 || !lookupResult?.found) {
      setConvertedAmount(null);
      return;
    }
    if (convertDebounce.current) clearTimeout(convertDebounce.current);
    convertDebounce.current = setTimeout(() => {
      void fetchConversion(numAmount, senderCurrency, targetCurrency);
    }, 500);
    return () => {
      if (convertDebounce.current) clearTimeout(convertDebounce.current);
    };
  }, [numAmount, senderCurrency, targetCurrency, lookupResult?.found]);

  useEffect(() => {
    Animated.timing(summaryAnim, {
      toValue: showSummary ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showSummary]);

  // ── Soumission ───────────────────────────────────────
  const handleTransfer = () => {
    if (!canSend) return;

    const recipientName =
      lookupResult?.fullName ||
      `${lookupResult?.firstName ?? ""} ${lookupResult?.lastName ?? ""}`.trim() ||
      phone.trim();

    const receivedDisplay = isSameCurrency
      ? `${fmt(numAmount, senderCurrency)} ${senderCurrency}`
      : `${convertedAmount !== null ? fmt(convertedAmount, targetCurrency) : "…"} ${targetCurrency}`;

    Alert.alert(
      "Confirmation",
      `Envoyer ${fmt(numAmount, senderCurrency)} ${senderCurrency} à ${recipientName}\n` +
      `Destinataire reçoit : ${receivedDisplay}\nFrais : GRATUIT`,
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
        Alert.alert(
          "Destinataire non enregistré",
          "Ce numéro n'est pas inscrit sur la plateforme. Le transfert wallet est uniquement possible entre membres enregistrés.",
        );
        return;
      }

      const fullPhone = `${selectedCode.code}${phone.trim().replace(/^0+/, "")}`;
      let beneficiaryId: string | undefined;

      // ── Cas 1 : bénéficiaire déjà enregistré ─────────
      if (lookupResult.beneficiaryId) {
        beneficiaryId = lookupResult.beneficiaryId;
      }
      // ── Cas 2 : utilisateur plateforme → créer bénéficiaire ─
      else {
        // ✅ FIX v5.2 : country + city valides (lookup fournit les données du profil)
        const country = lookupResult.country?.trim() || selectedCode.name;
        const city    = lookupResult.city?.trim()    || country; // country en fallback si city vide
        const name    =
          lookupResult.fullName ||
          `${lookupResult.firstName ?? ""} ${lookupResult.lastName ?? ""}`.trim() ||
          fullPhone;

        try {
          const newBenef = await api.createBeneficiary({
            fullName: name,
            phone:    fullPhone,
            country,  // ✅ Non vide : vient du profil utilisateur
            city,     // ✅ Non vide : vient du profil ou = country
          });
          beneficiaryId = String(newBenef.id);
        } catch (createErr: any) {
          const msg = createErr?.response?.data?.message ?? "Erreur lors de l'enregistrement du contact.";
          Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
          return;
        }
      }

      // ── Création de la transaction ────────────────────
      await api.createTransaction({
        amount:          numAmount,
        currency:        senderCurrency,
        payoutMethod:    "WALLET",
        beneficiaryId,
        senderFirstName: (user as any)?.firstName,
        senderLastName:  (user as any)?.lastName,
      } as any);

      await refreshUser?.();

      const recipientName =
        lookupResult.fullName ||
        `${lookupResult.firstName ?? ""} ${lookupResult.lastName ?? ""}`.trim() ||
        phone.trim();

      Alert.alert(
        "✅ Transfert réussi !",
        `${fmt(numAmount, senderCurrency)} ${senderCurrency} envoyé à ${recipientName}.` +
        (!isSameCurrency && convertedAmount !== null
          ? `\nMontant reçu : ${fmt(convertedAmount, targetCurrency)} ${targetCurrency}`
          : ""),
        [{ text: "Super !", onPress: () => router.back() }],
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Le transfert a échoué. Réessayez.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, {
        opacity:   headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Transfert Wallet</Text>
            <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>Wallet → Wallet · Sans aucun frais</Text>
          </View>
          <View style={s.heroBadge}>
            <Ionicons name="flash" size={16} color={C.white} />
          </View>
        </View>

        {/* Balance card */}
        <View style={s.balCard}>
          <View>
            <Text style={[s.balLbl, { fontFamily: C.font.sans }]}>SOLDE DISPONIBLE</Text>
            <Text style={[s.balAmt, { fontFamily: C.font.serif }]}>
              {fmt(currentBalance, senderCurrency)}
            </Text>
            <Text style={[s.balCur, { fontFamily: C.font.sans }]}>{senderCurrency}</Text>
          </View>
          <View style={[
            s.balBadge,
            insufficient && { backgroundColor: C.amberBg, borderColor: C.amberBorder },
          ]}>
            {insufficient ? (
              <>
                <Ionicons name="warning-outline" size={13} color={C.amber} />
                <Text style={[s.balBadgeTxt, { color: C.amber, fontFamily: C.font.sans }]}>
                  Insuffisant
                </Text>
              </>
            ) : (
              <>
                <View style={s.balDot} />
                <Text style={[s.balBadgeTxt, { color: C.greenDark, fontFamily: C.font.sans }]}>
                  Disponible
                </Text>
              </>
            )}
          </View>
        </View>
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Bannière gratuit */}
          <View style={s.freeBanner}>
            <View style={s.freeIconBox}>
              <Ionicons name="flash" size={16} color={C.green} />
            </View>
            <Text style={[s.freeTxt, { fontFamily: C.font.sans }]}>
              Transfert instantané ·{" "}
              <Text style={{ fontWeight: "900", color: C.green }}>0 frais</Text>
              {" "}· Conversion automatique
            </Text>
          </View>

          {/* ── Destinataire ── */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: C.green }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>DESTINATAIRE</Text>
            </View>

            {/* Phone row avec indicatif */}
            <View style={[s.phoneRow, recipientFocused && { borderColor: C.green }]}>
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowPicker(true)}>
                <Text style={{ fontSize: 18 }}>{selectedCode.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>{selectedCode.code}</Text>
                <Ionicons name="chevron-down" size={12} color={C.inkSoft} />
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
                <ActivityIndicator size={14} color={C.green} style={{ marginRight: 12 }} />
              ) : phone.length > 0 ? (
                <TouchableOpacity
                  onPress={() => { setPhone(""); setLookupResult(null); }}
                  style={{ padding: 10 }}
                >
                  <Ionicons name="close-circle" size={16} color={C.inkSoft} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* ✅ NEW v5.2 : résultat du lookup */}
            {!lookupLoading && lookupResult !== null && (
              lookupResult.found ? (
                <RecipientCard result={lookupResult} />
              ) : (
                phone.replace(/[^0-9]/g, "").length >= 6 && (
                  <NotFoundCard
                    onAdd={() => router.push("/(tabs)/beneficiaries/create" as any)}
                  />
                )
              )
            )}
          </View>

          {/* ── Montant (visible seulement si destinataire trouvé) ── */}
          {lookupResult?.found && (
            <View style={s.card}>
              <View style={s.secRow}>
                <View style={[s.secDot, { backgroundColor: C.green }]} />
                <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>MONTANT</Text>
              </View>

              {/* Conversion VOUS ENVOYEZ / REÇOIT */}
              <View style={[
                s.conversionBox,
                amountFocused && { borderColor: C.green },
                insufficient  && { borderColor: C.amber },
              ]}>
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
                  <Text style={[s.convCur, { color: C.green, fontFamily: C.font.mono }]}>
                    {senderCurrency}
                  </Text>
                </View>

                <View style={s.convArrow}>
                  {converting
                    ? <ActivityIndicator size={14} color={C.green} />
                    : <Ionicons name="swap-horizontal" size={18} color={C.green} />
                  }
                </View>

                <View style={[s.convSide, { alignItems: "flex-end" }]}>
                  <Text style={[s.convLabel, { fontFamily: C.font.sans }]}>REÇOIT</Text>
                  <Text style={[s.convInput, {
                    fontFamily: C.font.serif,
                    color: convertedAmount !== null ? C.greenDark : C.inkSoft,
                  }]}>
                    {converting
                      ? "…"
                      : convertedAmount !== null
                        ? fmt(convertedAmount, targetCurrency)
                        : numAmount > 0 ? "?" : "0"
                    }
                  </Text>
                  <Text style={[s.convCur, { color: C.greenDark, fontFamily: C.font.mono }]}>
                    {targetCurrency}
                  </Text>
                </View>
              </View>

              {/* Taux de conversion */}
              {convRate !== null && !isSameCurrency && numAmount > 0 && (
                <View style={s.rateRow}>
                  <Ionicons name="information-circle-outline" size={12} color={C.green} />
                  <Text style={[s.rateTxt, { fontFamily: C.font.mono }]}>
                    1 {senderCurrency} = {fmt(convRate, targetCurrency)} {targetCurrency}
                  </Text>
                </View>
              )}

              {/* Montants rapides */}
              <Text style={[s.quickLbl, { fontFamily: C.font.sans }]}>MONTANTS RAPIDES</Text>
              <View style={s.quickRow}>
                {QUICK_AMOUNTS.map((v) => {
                  const active = numAmount === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[s.quickPill, active && { backgroundColor: C.greenPale, borderColor: C.green }]}
                      onPress={() => setAmount(String(v))}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        s.quickTxt,
                        { color: active ? C.green : C.inkSoft, fontFamily: C.font.mono },
                      ]}>
                        {v}{senderCurrency === "EUR" ? "€" : senderCurrency === "GBP" ? "£" : senderCurrency === "USD" ? "$" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Récap animé */}
          <Animated.View style={[s.recapCard, {
            opacity:   summaryAnim,
            transform: [{ translateY: summaryAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }]}>
            <View style={s.recapHead}>
              <View style={[s.recapIconBox, { backgroundColor: C.greenPale }]}>
                <Ionicons name="receipt-outline" size={15} color={C.green} />
              </View>
              <Text style={[s.recapTitle, { fontFamily: C.font.sans }]}>Récapitulatif</Text>
            </View>
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Destinataire</Text>
              <Text style={[s.recapVal, { fontFamily: C.font.sans }]} numberOfLines={1}>
                {lookupResult?.fullName ||
                  `${lookupResult?.firstName ?? ""} ${lookupResult?.lastName ?? ""}`.trim() ||
                  `${selectedCode.flag} ${phone.trim()}`}
              </Text>
            </View>
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Montant envoyé</Text>
              <Text style={[s.recapVal, { fontFamily: C.font.mono }]}>
                {fmt(numAmount, senderCurrency)} {senderCurrency}
              </Text>
            </View>
            {!isSameCurrency && convertedAmount !== null && (
              <>
                <View style={s.recapDivider} />
                <View style={s.recapRow}>
                  <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Montant reçu</Text>
                  <Text style={[s.recapVal, {
                    color: C.green, fontFamily: C.font.mono, fontWeight: "700",
                  }]}>
                    {fmt(convertedAmount, targetCurrency)} {targetCurrency}
                  </Text>
                </View>
              </>
            )}
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Frais</Text>
              <View style={[s.freePill, { backgroundColor: C.greenPale, borderColor: C.greenBorder }]}>
                <Ionicons name="checkmark-circle" size={11} color={C.green} />
                <Text style={[s.freePillTxt, { fontFamily: C.font.sans }]}>Offerts</Text>
              </View>
            </View>
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapTotalLbl, { fontFamily: C.font.sans }]}>TOTAL DÉBITÉ</Text>
              <Text style={[s.recapTotalVal, {
                color: insufficient ? C.amber : C.green,
                fontFamily: C.font.serif,
              }]}>
                {fmt(numAmount, senderCurrency)} {senderCurrency}
              </Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSend || loading) && { opacity: 0.4 }]}
            onPress={handleTransfer}
            disabled={!canSend || loading}
            activeOpacity={0.88}
          >
            <View style={[s.ctaInner, insufficient && { backgroundColor: C.amber }]}>
              {loading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={18} color={C.white} />
                  <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>
                    {insufficient
                      ? "SOLDE INSUFFISANT"
                      : !lookupResult?.found
                        ? "ENTREZ UN NUMÉRO ENREGISTRÉ"
                        : "ENVOYER SANS FRAIS"}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          <View style={s.secNote}>
            <Ionicons name="shield-checkmark-outline" size={12} color={C.green} />
            <Text style={[s.secTxt, { fontFamily: C.font.sans }]}>
              Transfert sécurisé · Uniquement entre membres enregistrés
            </Text>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal sélecteur pays ── */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
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
                    onPress={() => {
                      setSelectedCode(item);
                      setShowPicker(false);
                      setLookupResult(null);
                    }}
                  >
                    <Text style={{ fontSize: 22, marginRight: 12 }}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[pk.itemName, { fontFamily: C.font.sans }]}>{item.name}</Text>
                      <Text style={[pk.itemCur, { fontFamily: C.font.mono }]}>{item.currency}</Text>
                    </View>
                    <Text style={[pk.itemCode, { fontFamily: C.font.mono, color: active ? C.green : C.inkSoft }]}>
                      {item.code}
                    </Text>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={C.green}
                        style={{ marginLeft: 8 }}
                      />
                    )}
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
  sheet:    { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%", paddingBottom: Platform.OS === "ios" ? 36 : 20 },
  handle:   { width: 40, height: 4, borderRadius: 99, backgroundColor: "#D1FAE5", alignSelf: "center", marginBottom: 16 },
  title:    { fontSize: 16, fontWeight: "900", color: C.ink, marginBottom: 12 },
  item:     { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4 },
  itemName: { fontSize: 14, fontWeight: "700", color: C.ink },
  itemCur:  { fontSize: 10, color: C.inkSoft, marginTop: 1 },
  itemCode: { fontSize: 13, fontWeight: "800" },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: {
    backgroundColor: C.green,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 24, overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  backBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },
  heroTitle: { color: C.white, fontSize: 20, fontWeight: "700" },
  heroSub:   { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  heroBadge: { width: 38, height: 38, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },

  balCard: {
    backgroundColor: C.white, borderRadius: C.r.xl,
    padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  balLbl:     { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" },
  balAmt:     { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  balCur:     { fontSize: 12, fontWeight: "800", color: C.green, marginTop: 2 },
  balBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenPale, borderWidth: 1, borderColor: C.greenBorder, borderRadius: C.r.pill, paddingHorizontal: 12, paddingVertical: 6 },
  balDot:     { width: 6, height: 6, borderRadius: C.r.pill, backgroundColor: C.green },
  balBadgeTxt:{ fontSize: 11, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, paddingTop: 18 },

  freeBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.greenPale, borderRadius: C.r.md,
    padding: 13, borderWidth: 1, borderColor: C.greenBorder, marginBottom: 16,
  },
  freeIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.greenLight, justifyContent: "center", alignItems: "center" },
  freeTxt:     { flex: 1, color: C.inkMid, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },

  phoneRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder,
    borderRadius: C.r.md, overflow: "hidden",
  },
  dialBtn:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 12 },
  dialCode:    { fontSize: 13, fontWeight: "800", color: C.ink },
  dialDivider: { width: 1, height: 32, backgroundColor: C.cardBorder },
  phoneInput:  { flex: 1, paddingHorizontal: 12, paddingVertical: 13, fontSize: 15, color: C.ink, fontWeight: "600" },

  conversionBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder,
    borderRadius: C.r.md, padding: 14, marginBottom: 8,
  },
  convSide:  { flex: 1 },
  convLabel: { fontSize: 8, fontWeight: "900", color: C.inkSoft, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  convInput: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  convCur:   { fontSize: 10, fontWeight: "900", marginTop: 3, letterSpacing: 1 },
  convArrow: { width: 36, alignItems: "center" },

  rateRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.greenPale, borderRadius: C.r.sm,
    padding: 8, marginBottom: 14, borderWidth: 1, borderColor: C.greenBorder,
  },
  rateTxt: { fontSize: 10, fontWeight: "700", color: C.greenDark },

  quickLbl:  { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase", marginTop: 4 },
  quickRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: C.r.md, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  quickTxt:  { fontSize: 12, fontWeight: "800" },

  recapCard: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1.5, borderColor: C.greenBorder,
    shadowColor: C.green, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  recapHead:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  recapIconBox:  { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  recapTitle:    { fontSize: 12, fontWeight: "900", color: C.green, letterSpacing: 0.5 },
  recapRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recapLbl:      { color: C.inkSoft, fontSize: 12, fontWeight: "700" },
  recapVal:      { color: C.ink, fontSize: 13, fontWeight: "700", maxWidth: "55%" },
  recapDivider:  { height: 1, backgroundColor: C.greenBorder, marginVertical: 10 },
  recapTotalLbl: { color: C.ink, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  recapTotalVal: { fontSize: 22, fontWeight: "900" },
  freePill:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: C.r.pill, borderWidth: 1 },
  freePillTxt:   { color: C.green, fontSize: 10, fontWeight: "800" },

  cta:      { borderRadius: C.r.md, overflow: "hidden", marginBottom: 12 },
  ctaInner: { backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, borderRadius: C.r.md },
  ctaTxt:   { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  secNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  secTxt:  { color: C.inkSoft, fontSize: 11, fontWeight: "600" },
});