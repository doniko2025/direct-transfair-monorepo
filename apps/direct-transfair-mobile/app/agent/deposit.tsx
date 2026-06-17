// apps/direct-transfair-mobile/app/agent/deposit.tsx
// =========================================================
// AGENT DEPOSIT (CASH-IN) v8.0 — Direct Transf'air
// ✅ v7.0 : héro pill, navigation vers reçu imprimable
// ✅ v7.1 : fond blanc pur, héro rectangulaire gradient
// ✅ v8.0 :
//   - Lookup automatique du client par téléphone (debounce 600ms)
//     ⚠️  Endpoint utilisé : GET /users/by-phone?phone=<fullPhone>
//     Adapter si votre API diffère (ex. /clients/lookup?phone=...)
//   - Badge "CLIENT TROUVÉ" avec initiales + nom sous le champ téléphone
//   - Avertissement si numéro introuvable (n'empêche pas la validation)
//   - Modal de confirmation custom : avatar · nom · téléphone · montant
//   - Récapitulatif et reçu mis à jour avec le nom du client
// =========================================================

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated, Modal, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { countriesList, type CountryData } from "../../data/countries";

const AGENT_BLUE      = "#2563EB";
const AGENT_BLUE_DARK = "#1D4ED8";
const DEFAULT_COUNTRY = countriesList.find(c => c.code === "SN") ?? countriesList[0];

const QUICK_BY_CURRENCY: Record<string, number[]> = {
  XOF: [1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000],
  GNF: [10_000, 20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  EUR: [10, 20, 50, 100, 200, 500],
  USD: [10, 20, 50, 100, 200, 500],
  GBP: [10, 20, 50, 100, 200, 500],
};

const C = {
  violet:       AGENT_BLUE,
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",
  heroGlass:    "rgba(255,255,255,0.18)",
  heroGlassBdr: "rgba(255,255,255,0.28)",
  heroDim:      "rgba(255,255,255,0.75)",
  heroGlow:     "rgba(255,255,255,0.07)",
  pageBg:       "#FFFFFF",
  white:        "#FFFFFF",
  cardBorder:   "#E8EDF5",
  inputBg:      "#F4F7FA",
  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",
  green:        "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0",
  red:          "#EF4444",
  blue:         "#3B82F6", blueBg: "#EFF6FF", blueBorder: "#BFDBFE",
  amber:        "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:   Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:   Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── CountryPickerModal ───────────────────────────────────
function CountryPickerModal({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (c: CountryData) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? countriesList.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.dialCode.includes(q.replace("+", "")))
    : countriesList;
  const close = () => { onClose(); setQ(""); };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={cp.overlay}>
        <View style={cp.sheet}>
          <View style={cp.handle} />
          <View style={cp.head}>
            <Text style={[cp.title, { fontFamily: C.font.sans }]}>Indicatif pays</Text>
            <TouchableOpacity style={cp.closeBtn} onPress={close}>
              <Ionicons name="close" size={17} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={cp.search}>
            <Ionicons name="search" size={14} color={C.inkSoft} />
            <TextInput style={[cp.searchInput, { fontFamily: C.font.sans }]} value={q} onChangeText={setQ} placeholder="Pays ou indicatif…" placeholderTextColor={C.inkSoft} autoFocus />
            {!!q && <TouchableOpacity onPress={() => setQ("")} hitSlop={8}><Ionicons name="close" size={13} color={C.inkSoft} /></TouchableOpacity>}
          </View>
          <FlatList
            data={filtered} keyExtractor={(c) => c.code}
            showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item: c }) => (
              <TouchableOpacity style={cp.item} onPress={() => { onSelect(c); close(); }} activeOpacity={0.75}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
                <Text style={[cp.itemName, { fontFamily: C.font.sans }]}>{c.name}</Text>
                <View style={cp.chip}><Text style={[cp.chipTxt, { fontFamily: C.font.mono }]}>+{c.dialCode}</Text></View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[cp.empty, { fontFamily: C.font.sans }]}>Aucun résultat</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}
const cp = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "78%", borderWidth: 1, borderColor: C.cardBorder },
  handle:     { width: 36, height: 4, borderRadius: C.r.pill, backgroundColor: C.cardBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  head:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  title:      { color: C.ink, fontSize: 17, fontWeight: "700" },
  closeBtn:   { width: 30, height: 30, borderRadius: 9, backgroundColor: C.inputBg, justifyContent: "center", alignItems: "center" },
  search:     { flexDirection: "row", alignItems: "center", gap: 10, margin: 14, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, height: 42 },
  searchInput:{ flex: 1, fontSize: 14, color: C.ink, fontWeight: "600" },
  item:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  itemName:   { flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" },
  chip:       { backgroundColor: C.violetLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.violetBorder },
  chipTxt:    { color: AGENT_BLUE, fontSize: 11, fontWeight: "900" },
  empty:      { color: C.inkSoft, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ─── ✅ v8.0 — ConfirmDepositModal ───────────────────────
function ConfirmDepositModal({ visible, clientName, clientPhone, amount, currency, onCancel, onConfirm, loading }: {
  visible:     boolean;
  clientName:  string | null;
  clientPhone: string;
  amount:      number;
  currency:    string;
  onCancel:    () => void;
  onConfirm:   () => void;
  loading:     boolean;
}) {
  const slideAnim   = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim,   { toValue: 0,   useNativeDriver: true, speed: 16, bounciness: 5 }),
        Animated.timing(opacityAnim, { toValue: 1,   duration: 180,         useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(50);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const initials = clientName
    ? clientName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("")
    : clientPhone.replace(/\D/g, "").slice(-2);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[cm.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[cm.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Barre top gradient */}
          <LinearGradient
            colors={[AGENT_BLUE, AGENT_BLUE_DARK]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={cm.topBar}
          />

          {/* Avatar + identité */}
          <View style={cm.identityBox}>
            <View style={cm.avatar}>
              <Text style={[cm.avatarTxt, { fontFamily: C.font.sans }]}>{initials}</Text>
            </View>
            <Text style={[cm.modalLabel, { fontFamily: C.font.sans }]}>CONFIRMATION DÉPÔT</Text>
            {clientName ? (
              <>
                <Text style={[cm.clientName, { fontFamily: C.font.sans }]}>{clientName}</Text>
                <Text style={[cm.clientPhone, { fontFamily: C.font.mono }]}>{clientPhone}</Text>
              </>
            ) : (
              <Text style={[cm.clientName, { fontFamily: C.font.mono }]}>{clientPhone}</Text>
            )}
          </View>

          {/* Séparateur */}
          <View style={cm.divider} />

          {/* Montant */}
          <View style={cm.amtBox}>
            <Text style={[cm.amtLabel, { fontFamily: C.font.sans }]}>MONTANT À CRÉDITER</Text>
            <View style={cm.amtRow}>
              <Text style={[cm.amtVal, { fontFamily: C.font.serif }]}>{fmt(amount, currency)}</Text>
              <View style={cm.amtCurBadge}>
                <Text style={[cm.amtCurTxt, { fontFamily: C.font.mono }]}>{currency}</Text>
              </View>
            </View>
          </View>

          {/* Note */}
          <View style={cm.noteBox}>
            <Ionicons name="flash-outline" size={13} color={AGENT_BLUE} />
            <Text style={[cm.noteTxt, { fontFamily: C.font.sans }]}>
              Crédit <Text style={{ fontWeight: "800" }}>instantané</Text> sur le Wallet du client.
            </Text>
          </View>

          {/* Boutons */}
          <View style={cm.btnRow}>
            <TouchableOpacity style={cm.cancelBtn} onPress={onCancel} disabled={loading} activeOpacity={0.8}>
              <Text style={[cm.cancelTxt, { fontFamily: C.font.sans }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cm.confirmBtn, loading && { opacity: 0.7 }]}
              onPress={onConfirm} disabled={loading} activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color={C.white} size="small" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={17} color={C.white} />
                    <Text style={[cm.confirmTxt, { fontFamily: C.font.sans }]}>CONFIRMER</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: Platform.OS === "ios" ? 18 : 10 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:     {
    flex: 1, backgroundColor: "rgba(15,23,42,0.60)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 18,
  },
  sheet:       {
    backgroundColor: C.white, borderRadius: 24, width: "100%",
    overflow: "hidden", borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22, shadowRadius: 32, elevation: 20,
  },
  topBar:      { height: 5 },

  identityBox: { alignItems: "center", paddingTop: 24, paddingBottom: 20, paddingHorizontal: 20 },
  avatar:      {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center",
    marginBottom: 14, borderWidth: 2, borderColor: "#BFDBFE",
  },
  avatarTxt:   { fontSize: 24, fontWeight: "900", color: AGENT_BLUE },
  modalLabel:  { fontSize: 10, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.4, marginBottom: 10 },
  clientName:  { fontSize: 21, fontWeight: "800", color: C.ink, textAlign: "center", marginBottom: 5 },
  clientPhone: { fontSize: 13, color: C.inkSoft, fontWeight: "600" },

  divider:    { height: 1, backgroundColor: C.cardBorder, marginHorizontal: 18 },

  amtBox:     { alignItems: "center", paddingVertical: 18, paddingHorizontal: 20 },
  amtLabel:   { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" },
  amtRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  amtVal:     { fontSize: 34, fontWeight: "900", color: AGENT_BLUE, letterSpacing: -1 },
  amtCurBadge:{ backgroundColor: C.violetLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.violetBorder },
  amtCurTxt:  { fontSize: 13, fontWeight: "900", color: AGENT_BLUE, letterSpacing: 0.5 },

  noteBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 18, marginBottom: 18,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  noteTxt: { flex: 1, fontSize: 11, color: "#1D4ED8", fontWeight: "600", lineHeight: 17 },

  btnRow:     { flexDirection: "row", gap: 10, marginHorizontal: 18, marginBottom: 4 },
  cancelBtn:  {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    backgroundColor: C.inputBg, alignItems: "center",
    borderWidth: 1.5, borderColor: C.cardBorder,
  },
  cancelTxt:  { fontSize: 14, fontWeight: "700", color: C.inkSoft },
  confirmBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 14,
    backgroundColor: AGENT_BLUE, alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 8,
  },
  confirmTxt: { fontSize: 13, fontWeight: "900", color: C.white, letterSpacing: 0.5 },
});

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, required }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fi.wrap}>
      <Text style={[fi.label, { fontFamily: C.font.sans }]}>
        {label}{required && <Text style={{ color: C.red }}> *</Text>}
      </Text>
      <View style={[fi.box, focused && fi.focused]}>
        <TextInput
          style={[fi.input, { fontFamily: C.font.sans }]}
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={C.inkSoft} keyboardType={keyboardType}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const fi = StyleSheet.create({
  wrap:    { marginBottom: 16 },
  label:   { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  box:     { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md },
  focused: { borderColor: AGENT_BLUE, backgroundColor: C.white, shadowColor: AGENT_BLUE, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 },
  input:   { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.ink, fontWeight: "600" },
});

// ─── Main ─────────────────────────────────────────────────
export default function AgentDepositScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [country,       setCountry]       = useState<CountryData>(DEFAULT_COUNTRY);
  const [showPicker,    setShowPicker]    = useState(false);
  const [phone,         setPhone]         = useState("");
  const [amount,        setAmount]        = useState("");
  const [loading,       setLoading]       = useState(false);
  const [agentCurrency, setAgentCurrency] = useState<string>((user as any)?.primaryCurrency ?? "XOF");

  // ✅ v8.0 : lookup client
  const [clientInfo,  setClientInfo]  = useState<{ firstName: string; lastName: string } | null>(null);
  const [lookingUp,   setLookingUp]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Chargement devise de l'agent
  useEffect(() => {
    api.getMyWallets().then((wallets) => {
      if (Array.isArray(wallets) && wallets.length > 0) {
        const primary = wallets.find((w) => w.isDefault) ?? wallets[0];
        if (primary?.currency) setAgentCurrency(primary.currency);
      }
    }).catch(() => { const p = (user as any)?.primaryCurrency; if (p) setAgentCurrency(p); });
  }, []);

  // ✅ v8.0 : Lookup client par téléphone avec debounce 600ms
  useEffect(() => {
    setClientInfo(null);
    const trimmed = phone.trim();
    if (trimmed.length < 6) return;

    const timer = setTimeout(async () => {
      setLookingUp(true);
      try {
        // ⚠️ Adapter l'endpoint à votre API si nécessaire
        const fullPhone = `${country.dialCode}${trimmed}`;
        const res = await api.http.get(`/users/by-phone?phone=${encodeURIComponent(fullPhone)}`);
        const d = res.data;
        if (d?.firstName || d?.lastName) {
          setClientInfo({ firstName: d.firstName ?? "", lastName: d.lastName ?? "" });
        } else {
          setClientInfo(null);
        }
      } catch {
        // Numéro non trouvé — silencieux (avertissement affiché dans l'UI)
        setClientInfo(null);
      } finally {
        setLookingUp(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [phone, country.dialCode]);

  const numAmount      = parseFloat(amount) || 0;
  const fullPhone      = `${country.dialCode}${phone.trim()}`;
  const clientFullName = clientInfo ? `${clientInfo.firstName} ${clientInfo.lastName}`.trim() : null;
  const canSubmit      = phone.trim().length >= 6 && numAmount > 0;
  const quickAmounts   = QUICK_BY_CURRENCY[agentCurrency] ?? QUICK_BY_CURRENCY.XOF;

  const updateAnim = (phoneVal: string, amtVal: string) => {
    const n = parseFloat(amtVal) || 0;
    Animated.timing(fadeAnim, { toValue: n > 0 && phoneVal.trim().length >= 6 ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };
  const onAmountChange = (v: string) => { setAmount(v); updateAnim(phone, v); };
  const onPhoneChange  = (v: string) => { setPhone(v);  updateAnim(v, amount); };

  const showAlertCross = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === "web") { setTimeout(() => { window.alert(`${title}\n\n${msg}`); if (onOk) onOk(); }, 100); }
    else Alert.alert(title, msg, [{ text: "OK", onPress: onOk }]);
  };

  // ✅ v8.0 : ouvre le modal custom (plus d'Alert natif)
  const handleDeposit = () => {
    if (!canSubmit) { showAlertCross("Champs manquants", "Veuillez remplir le numéro et le montant."); return; }
    setShowConfirm(true);
  };

  const process = async () => {
    setLoading(true);
    try {
      const result = await api.http.post("/transactions/deposit", { userPhone: fullPhone, amount: numAmount });
      const creditedCurrency: string = result?.data?.currency ?? agentCurrency;
      const creditedAmount:   number = result?.data?.amount   ?? numAmount;
      setShowConfirm(false);
      const receiptData = {
        type:             "DEPOT" as const,
        reference:        result?.data?.reference ?? `DEP-${Date.now()}`,
        date:             new Date().toISOString(),
        amount:           creditedAmount,
        currency:         creditedCurrency,
        beneficiaryName:  clientFullName || fullPhone, // ✅ v8.0 : nom réel du client
        beneficiaryPhone: fullPhone,
        agencyName:       (user as any)?.agency?.name || undefined,
        agentName:        `${(user as any)?.firstName ?? ""} ${(user as any)?.lastName ?? ""}`.trim() || undefined,
      };
      router.push(`/agent/receipt?data=${encodeURIComponent(JSON.stringify(receiptData))}`);
    } catch (e: any) {
      setShowConfirm(false);
      const msg = e?.response?.data?.message || "Le dépôt a échoué.";
      showAlertCross("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={AGENT_BLUE} />

      {/* Héro bleu */}
      <LinearGradient colors={[AGENT_BLUE, AGENT_BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.glow} />
        <View style={s.heroTopRow}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={18} color={C.white} />
          </TouchableOpacity>
          <View style={s.agentPill}>
            <View style={s.pillDot} />
            <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>AGENT</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={s.currBadge}>
            <Text style={[s.currBadgeTxt, { fontFamily: C.font.mono }]}>{agentCurrency}</Text>
          </View>
        </View>
        <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Dépôt Client</Text>
        <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>Cash-In · Crédit Wallet</Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Bannière info */}
          <View style={s.banner}>
            <View style={s.bannerIconBox}>
              <Ionicons name="wallet-outline" size={16} color={C.blue} />
            </View>
            <Text style={[s.bannerTxt, { fontFamily: C.font.sans }]}>
              Les fonds sont crédités{" "}
              <Text style={{ fontWeight: "800" }}>instantanément</Text>
              {" "}en <Text style={{ fontWeight: "800" }}>{agentCurrency}</Text>
              {" "}sur le Wallet du client.
            </Text>
          </View>

          {/* Formulaire */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: AGENT_BLUE }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>INFORMATIONS DÉPÔT</Text>
            </View>

            {/* Numéro client */}
            <Text style={[fi.label, { fontFamily: C.font.sans }]}>
              Numéro du client <Text style={{ color: C.red }}>*</Text>
            </Text>
            <View style={s.phoneRow}>
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowPicker(true)} activeOpacity={0.75}>
                <Text style={{ fontSize: 18 }}>{country.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>+{country.dialCode}</Text>
                <Ionicons name="caret-down" size={10} color={C.inkSoft} />
              </TouchableOpacity>
              <View style={s.phoneInput}>
                <TextInput
                  style={[s.phoneInputTxt, { fontFamily: C.font.sans }]}
                  value={phone} onChangeText={onPhoneChange}
                  placeholder="620 000 000" placeholderTextColor={C.inkSoft}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* ✅ v8.0 : Badge client sous le champ téléphone */}
            {lookingUp && (
              <View style={s.clientLookup}>
                <ActivityIndicator size="small" color={AGENT_BLUE} />
                <Text style={[s.clientLookupTxt, { fontFamily: C.font.sans }]}>Recherche du client…</Text>
              </View>
            )}

            {!lookingUp && clientInfo && (
              <View style={s.clientFound}>
                <View style={s.clientAvatar}>
                  <Text style={[s.clientAvatarTxt, { fontFamily: C.font.sans }]}>
                    {`${clientInfo.firstName[0] ?? ""}${clientInfo.lastName[0] ?? ""}`.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.clientFoundLabel, { fontFamily: C.font.sans }]}>CLIENT TROUVÉ ✓</Text>
                  <Text style={[s.clientFoundName,  { fontFamily: C.font.sans }]}>{clientFullName}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={C.green} />
              </View>
            )}

            {!lookingUp && !clientInfo && phone.trim().length >= 6 && (
              <View style={s.clientNotFound}>
                <Ionicons name="alert-circle-outline" size={14} color={C.amber} />
                <Text style={[s.clientNotFoundTxt, { fontFamily: C.font.sans }]}>
                  Numéro non trouvé — vérifiez avant de continuer
                </Text>
              </View>
            )}

            <View style={s.divider} />

            {/* Montant */}
            <Text style={[fi.label, { fontFamily: C.font.sans, marginBottom: 8 }]}>
              Montant <Text style={{ color: C.red }}>*</Text>
            </Text>
            <View style={[s.amtBox, numAmount > 0 && { borderColor: AGENT_BLUE }]}>
              <TextInput
                style={[s.amtInput, { fontFamily: C.font.serif }]}
                value={amount} onChangeText={onAmountChange}
                placeholder="0" placeholderTextColor={C.inkSoft} keyboardType="numeric"
              />
              <View style={s.curBox}>
                <Text style={[s.curTxt, { fontFamily: C.font.mono }]}>{agentCurrency}</Text>
              </View>
            </View>

            <Text style={[s.quickLbl, { fontFamily: C.font.sans }]}>MONTANTS RAPIDES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
              {quickAmounts.map((v) => {
                const active = numAmount === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[s.quickPill, active && s.quickPillActive]}
                    onPress={() => { setAmount(String(v)); onAmountChange(String(v)); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.quickTxt, { fontFamily: C.font.mono }, active && { color: AGENT_BLUE, fontWeight: "900" }]}>
                      {fmt(v, agentCurrency)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Résumé animé */}
          <Animated.View style={[s.summary, { opacity: fadeAnim }]}>
            <View style={s.summaryHead}>
              <View style={s.summaryIconBox}>
                <Ionicons name="receipt-outline" size={14} color={AGENT_BLUE} />
              </View>
              <Text style={[s.summaryTitle, { fontFamily: C.font.sans }]}>Récapitulatif</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Client</Text>
              <View style={{ alignItems: "flex-end" }}>
                {/* ✅ v8.0 : nom du client dans le récap */}
                {clientFullName && (
                  <Text style={[s.sumClientName, { fontFamily: C.font.sans }]}>{clientFullName}</Text>
                )}
                <Text style={[s.sumVal, { fontFamily: C.font.mono }]}>{fullPhone || "—"}</Text>
              </View>
            </View>
            <View style={s.sumDivider} />
            <View style={s.summaryRow}>
              <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Montant à créditer</Text>
              <Text style={[s.sumAmt, { fontFamily: C.font.serif }]}>{fmt(numAmount, agentCurrency)} {agentCurrency}</Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSubmit || loading) && { opacity: 0.4 }]}
            onPress={handleDeposit} disabled={!canSubmit || loading} activeOpacity={0.88}
          >
            <View style={s.ctaInner}>
              {loading
                ? <ActivityIndicator color={C.white} />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={C.white} />
                    <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>VALIDER LE DÉPÔT</Text>
                  </>
              }
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={loading}>
            <Text style={[s.cancelTxt, { fontFamily: C.font.sans }]}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CountryPickerModal visible={showPicker} onClose={() => setShowPicker(false)} onSelect={setCountry} />

      {/* ✅ v8.0 : Modal de confirmation custom */}
      <ConfirmDepositModal
        visible={showConfirm}
        clientName={clientFullName}
        clientPhone={fullPhone}
        amount={numAmount}
        currency={agentCurrency}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void process()}
        loading={loading}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },

  hero: {
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 34 : 8,
    paddingBottom: 22,
    borderBottomLeftRadius:  28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    shadowColor:   "#1D4ED8",
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius:  20,
    elevation:     12,
  },
  glow:         { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: C.heroGlow, top: -50, right: -30 },
  heroTopRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBtn:      { width: 32, height: 32, borderRadius: 10, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  agentPill:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillDot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.green },
  pillTxt:      { fontSize: 8, fontWeight: "700", color: C.white, letterSpacing: 1 },
  currBadge:    { height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  currBadgeTxt: { color: C.white, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  heroTitle:    { color: C.white, fontSize: 26, fontWeight: "700", marginBottom: 3 },
  heroSub:      { color: C.heroDim, fontSize: 11, fontWeight: "600" },

  scroll: { paddingHorizontal: 18, paddingTop: 20 },

  banner:        { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.blueBg, borderRadius: C.r.md, padding: 13, borderWidth: 1, borderColor: C.blueBorder, marginBottom: 16 },
  bannerIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  bannerTxt:     { flex: 1, color: "#1D4ED8", fontSize: 12, fontWeight: "600", lineHeight: 18 },

  card:   { backgroundColor: C.white, borderRadius: C.r.lg, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: C.cardBorder, shadowColor: "#64748B", shadowOpacity: 0.09, shadowRadius: 14, elevation: 5 },
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },

  phoneRow:     { flexDirection: "row", gap: 8, marginBottom: 10 },
  dialBtn:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 12, flexShrink: 0 },
  dialCode:     { color: C.ink, fontSize: 12, fontWeight: "800" },
  phoneInput:   { flex: 1, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden" },
  phoneInputTxt:{ paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: C.ink, fontWeight: "600" },
  divider:      { height: 1, backgroundColor: "#F0F4FB", marginBottom: 14 },

  // ✅ v8.0 : styles badge client
  clientLookup:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 10 },
  clientLookupTxt:   { fontSize: 12, color: AGENT_BLUE, fontWeight: "600" },
  clientFound:       {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.greenBg, borderRadius: C.r.md, padding: 12,
    borderWidth: 1, borderColor: C.greenBorder, marginBottom: 12,
  },
  clientAvatar:      { width: 40, height: 40, borderRadius: 12, backgroundColor: "#D1FAE5", justifyContent: "center", alignItems: "center" },
  clientAvatarTxt:   { fontSize: 14, fontWeight: "900", color: "#065F46" },
  clientFoundLabel:  { fontSize: 9, fontWeight: "900", color: "#059669", letterSpacing: 0.8, marginBottom: 2 },
  clientFoundName:   { fontSize: 14, fontWeight: "800", color: C.ink },
  clientNotFound:    {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.amberBg, borderRadius: C.r.md, padding: 10,
    borderWidth: 1, borderColor: C.amberBorder, marginBottom: 12,
  },
  clientNotFoundTxt: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },

  amtBox:          { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden", marginBottom: 16 },
  amtInput:        { flex: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 20, color: C.ink, fontWeight: "800" },
  curBox:          { paddingHorizontal: 14, paddingVertical: 11, backgroundColor: C.violetLight, borderLeftWidth: 1, borderLeftColor: C.violetBorder, justifyContent: "center" },
  curTxt:          { color: AGENT_BLUE, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  quickLbl:        { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  quickRow:        { gap: 7, paddingBottom: 2 },
  quickPill:       { paddingHorizontal: 12, paddingVertical: 8, borderRadius: C.r.md, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  quickPillActive: { backgroundColor: C.violetLight, borderColor: `${AGENT_BLUE}50` },
  quickTxt:        { fontSize: 11, fontWeight: "700", color: C.inkSoft },

  summary:        { backgroundColor: C.white, borderRadius: C.r.lg, padding: 17, marginBottom: 14, borderWidth: 1.5, borderColor: C.violetBorder, shadowColor: AGENT_BLUE, shadowOpacity: 0.12, shadowRadius: 14, elevation: 6 },
  summaryHead:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 13 },
  summaryIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.violetLight, justifyContent: "center", alignItems: "center" },
  summaryTitle:   { fontSize: 12, fontWeight: "900", color: AGENT_BLUE, letterSpacing: 0.5 },
  summaryRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumLbl:         { color: C.inkSoft, fontSize: 12, fontWeight: "700" },
  sumVal:         { color: C.ink, fontSize: 13, fontWeight: "800" },
  sumClientName:  { fontSize: 14, fontWeight: "800", color: C.ink, marginBottom: 2 }, // ✅ v8.0
  sumDivider:     { height: 1, backgroundColor: C.violetBorder, marginVertical: 10 },
  sumAmt:         { fontSize: 20, fontWeight: "900", color: AGENT_BLUE },

  cta:       { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10, shadowColor: AGENT_BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 14, elevation: 6 },
  ctaInner:  { backgroundColor: AGENT_BLUE, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, gap: 8, borderRadius: C.r.md },
  ctaTxt:    { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: C.inkSoft, fontWeight: "800", fontSize: 14 },
});