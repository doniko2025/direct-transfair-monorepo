// apps/direct-transfair-mobile/app/wallet-transfer.tsx
// =========================================================
// WALLET TRANSFER v7.0 — Direct Transf'air
// ✅ v7.0 : REFONTE THÈME CLAIR (modale) — fond crème, carte de solde dégradée
//    (blanc → couleur de la société), destinataire en champ arrondi avec indicatif en
//    feuille basse, carte « destinataire trouvé » (avatar beige), grande saisie du
//    montant avec conversion en temps réel, puces de montants rapides, récapitulatif
//    en lignes à filet et bouton pilule collé en bas. Plus de vert/ambre écrits en dur,
//    police système, arc SVG concave supprimé.
//    LOGIQUE MÉTIER INCHANGÉE (solde du wallet par défaut, recherche débouncée
//    GET /beneficiaries/lookup, conversion api.convertAmount, création du bénéficiaire
//    si besoin, api.createTransaction payoutMethod WALLET, confirmation avant envoi).
//    Durcissement : une réponse de conversion invalide n'affiche plus « NaN » (montant « ? »).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v6.2 : WHITE-LABEL — couleurs vertes suivent la couleur de marque du tenant.
// ✅ v6.1 : fond neutre, bordures neutres, montants plus compacts.
// =========================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";
import {
  Avatar, BalanceCard, Button, Card, Chip, IconButton, ListRow, Notice, Pill, Screen, Sheet, UText, SYSTEM_FONT, useUI,
} from "../components/ui";

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

// ─── Ligne du récapitulatif ──────────────────────────────
function RecapRow({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: "pos" | "warn" }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderBottomWidth: strong ? 0 : 1, borderBottomColor: C.line }}>
      <UText v={strong ? "bodyStrong" : "body"} tone={strong ? "ink" : "muted"}>{label}</UText>
      {typeof value === "string" ? (
        <UText v="bodyStrong" tone={tone} style={{ flexShrink: 1, textAlign: "right", fontWeight: strong ? "800" : "600" }} numberOfLines={1}>{value}</UText>
      ) : value}
    </View>
  );
}

// ─── Écran ───────────────────────────────────────────────
export default function WalletTransferScreen() {
  const { C, R } = useUI();
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

  useEffect(() => {
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
      const conv = Number(result?.convertedAmount);
      const rate = Number(result?.rate);
      setConvertedAmount(Number.isFinite(conv) ? conv : null);
      setConvRate(Number.isFinite(rate) ? rate : null);
    } catch { setConvertedAmount(null); setConvRate(null); }
    finally { setConverting(false); }
  }, []);

  useEffect(() => {
    if (numAmount <= 0 || !lookupResult?.found) { setConvertedAmount(null); return; }
    if (convertDebounce.current) clearTimeout(convertDebounce.current);
    convertDebounce.current = setTimeout(() => { void fetchConversion(numAmount, senderCurrency, targetCurrency); }, 500);
    return () => { if (convertDebounce.current) clearTimeout(convertDebounce.current); };
  }, [numAmount, senderCurrency, targetCurrency, lookupResult?.found]);

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

  const foundName =
    lookupResult?.fullName || `${lookupResult?.firstName ?? ""} ${lookupResult?.lastName ?? ""}`.trim() || `${selectedCode.flag} ${phone.trim()}`;
  const cleanLen = phone.replace(/[^0-9]/g, "").length;

  const ctaLabel = insufficient
    ? "Solde insuffisant"
    : !lookupResult?.found
      ? "Entre un numéro enregistré"
      : "Envoyer sans frais";

  return (
    <Screen
      header={
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, minHeight: 64, gap: 12 }}>
          <IconButton icon="chevron-back" label="Retour" onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <UText v="heading">Transfert wallet</UText>
            <UText v="caption" tone="muted">Wallet → Wallet · 0 frais</UText>
          </View>
        </View>
      }
      footer={<Button label={ctaLabel} icon="paper-plane-outline" onPress={handleTransfer} loading={loading} disabled={!canSend || loading} />}
    >
      {/* Solde */}
      <BalanceCard
        currency={senderCurrency}
        available={currentBalance}
        hidden={!showBalance}
        onToggleHidden={() => setShowBalance(!showBalance)}
        loading={!wallet.loaded}
      />
      {insufficient && (
        <Notice tone="warn" icon="warning-outline" style={{ marginTop: 12 }}>
          Le montant dépasse ton solde disponible.
        </Notice>
      )}

      {/* Destinataire */}
      <UText v="overline" tone="muted" style={{ marginTop: 28, marginBottom: 10 }}>Destinataire</UText>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 56, borderRadius: R.md, backgroundColor: C.field, paddingLeft: 6, paddingRight: 10 }}>
        <Pressable
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Indicatif ${selectedCode.code}`}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: C.surface, opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ fontSize: 20 }}>{selectedCode.flag}</Text>
          <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 15, fontWeight: "700", color: C.ink }}>{selectedCode.code}</Text>
          <Ionicons name="chevron-down" size={13} color={C.muted} />
        </Pressable>
        <TextInput
          style={[
            { flex: 1, minWidth: 0, fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: "600", color: C.ink, paddingHorizontal: 12, paddingVertical: 14 },
            { outlineStyle: "none", outlineWidth: 0 } as any,
          ]}
          value={phone}
          onChangeText={(v) => { setPhone(v); setLookupResult(null); }}
          placeholder="Numéro de téléphone"
          placeholderTextColor={C.faint}
          keyboardType="phone-pad"
          selectionColor={C.accent}
          underlineColorAndroid="transparent"
          accessibilityLabel="Numéro du destinataire"
        />
        {lookupLoading ? (
          <ActivityIndicator size="small" color={C.ink} />
        ) : phone.length > 0 ? (
          <Pressable onPress={() => { setPhone(""); setLookupResult(null); }} hitSlop={10} accessibilityLabel="Effacer">
            <Ionicons name="close-circle" size={18} color={C.muted} />
          </Pressable>
        ) : null}
      </View>

      {!lookupLoading && lookupResult !== null && (
        lookupResult.found ? (
          <Card pad={14} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={foundName} size={44} incoming={lookupResult.isPlatformUser} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <UText v="bodyStrong" numberOfLines={1}>{foundName}</UText>
              {(lookupResult.city || lookupResult.country) ? (
                <UText v="caption" tone="muted" numberOfLines={1}>
                  {lookupResult.city ? `${lookupResult.city}, ` : ""}{lookupResult.country}
                </UText>
              ) : null}
            </View>
            <Pill label={lookupResult.isPlatformUser ? "Enregistré" : "Contact"} tone={lookupResult.isPlatformUser ? "pos" : "warn"} icon={lookupResult.isPlatformUser ? "checkmark-circle" : "person-outline"} />
          </Card>
        ) : (
          cleanLen >= 6 && (
            <View style={{ marginTop: 12 }}>
              <ListRow
                icon="person-add-outline"
                title="Contact non trouvé"
                subtitle="Ajouter comme nouveau contact"
                onPress={() => router.push("/(tabs)/beneficiaries/create" as any)}
                last
              />
            </View>
          )
        )
      )}

      {/* Montant */}
      {lookupResult?.found && (
        <>
          <UText v="overline" tone="muted" style={{ marginTop: 28, marginBottom: 10 }}>Montant</UText>
          <Card pad={0} style={{ overflow: "hidden", borderWidth: insufficient ? 1.5 : 0, borderColor: C.warn }}>
            <View style={{ padding: 20 }}>
              <UText v="overline" tone="muted">Tu envoies</UText>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 6 }}>
                <TextInput
                  style={[
                    { flex: 1, minWidth: 0, padding: 0, fontFamily: SYSTEM_FONT, fontSize: 40, fontWeight: "800", letterSpacing: -1.2, color: insufficient ? C.warn : C.ink },
                    { outlineStyle: "none", outlineWidth: 0, borderWidth: 0 } as any,
                  ]}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(",", ".").replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={C.faint}
                  keyboardType="decimal-pad"
                  selectionColor={C.accent}
                  underlineColorAndroid="transparent"
                  accessibilityLabel="Montant à envoyer"
                />
                <UText v="heading" tone="muted">{senderCurrency}</UText>
              </View>
            </View>
            <View style={{ padding: 20, backgroundColor: C.sunken }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <UText v="overline" tone="muted">{lookupResult.firstName ? `${lookupResult.firstName} reçoit` : "Il·elle reçoit"}</UText>
                {converting ? <ActivityIndicator size="small" color={C.ink} /> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, minWidth: 0, fontFamily: SYSTEM_FONT, fontSize: 30, fontWeight: "800", letterSpacing: -0.8, color: convertedAmount !== null ? C.pos : C.faint }}
                >
                  {converting ? "…" : convertedAmount !== null ? fmt(convertedAmount, targetCurrency) : numAmount > 0 ? "?" : "0"}
                </Text>
                <UText v="heading" tone="muted">{targetCurrency}</UText>
              </View>
              {convRate !== null && !isSameCurrency && numAmount > 0 && (
                <UText v="caption" tone="muted" style={{ marginTop: 8 }}>
                  1 {senderCurrency} = {fmt(convRate, targetCurrency)} {targetCurrency}
                </UText>
              )}
            </View>
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 14, paddingBottom: 2 }}>
            {quickAmounts.map((v) => (
              <Chip key={v} label={fmt(v, senderCurrency)} active={numAmount === v} onPress={() => setAmount(String(v))} />
            ))}
          </ScrollView>
        </>
      )}

      {/* Récapitulatif */}
      {showSummary && (
        <>
          <UText v="overline" tone="muted" style={{ marginTop: 28, marginBottom: 4 }}>Récapitulatif</UText>
          <RecapRow label="Destinataire" value={foundName} />
          <RecapRow label="Montant envoyé" value={`${fmt(numAmount, senderCurrency)} ${senderCurrency}`} />
          {!isSameCurrency && convertedAmount !== null && (
            <RecapRow label="Montant reçu" value={`${fmt(convertedAmount, targetCurrency)} ${targetCurrency}`} tone="pos" />
          )}
          <RecapRow label="Frais" value={<Pill label="Offerts" tone="pos" icon="checkmark-circle" />} />
          <RecapRow label="Total débité" strong tone={insufficient ? "warn" : undefined} value={`${fmt(numAmount, senderCurrency)} ${senderCurrency}`} />
        </>
      )}

      <UText v="caption" tone="muted" align="center" style={{ marginTop: 22 }}>
        🔒 Transfert sécurisé · uniquement entre membres enregistrés
      </UText>

      {/* Indicatifs pays */}
      <Sheet visible={showPicker} onClose={() => setShowPicker(false)} title="Indicatif du pays">
        {COUNTRY_CODES.map((c, i) => (
          <ListRow
            key={c.country}
            title={c.name}
            subtitle={c.code}
            last={i === COUNTRY_CODES.length - 1}
            left={
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>{c.flag}</Text>
              </View>
            }
            right={c.code === selectedCode.code ? <Ionicons name="checkmark-circle" size={24} color={C.ink} /> : undefined}
            onPress={() => { setSelectedCode(c); setLookupResult(null); setShowPicker(false); }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
