// apps/direct-transfair-mobile/app/merchant/collect.tsx
// =========================================================
// ENCAISSER v1.0 — Lot 11
// Le marchand choisit « QR code » ou « Téléphone Orange », saisit le montant puis appuie sur « Envoyer ».
//  • QR : un QR code à usage unique s'affiche, le client le scanne avec la caméra de son application.
//  • Téléphone : une demande arrive dans l'application du client (numéro du compte), qui valide avec son code secret.
// Les deux mènent à l'écran de suivi /merchant/payment (mise à jour en direct).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Ionicons } from "../../components/ui/Icon";
import { AmountInput, Button, Card, Chip, ErrorView, Field, NavBar, Notice, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { apiProblem, money, Rise } from "../../components/merchant/merchantUi";
import { decimalsFor, parseAmount, roundTo } from "../../utils/amount";

export default function CollectScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { C } = useUI();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"qr" | "phone">(params.mode === "phone" ? "phone" : "qr");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [country, setCountry] = useState<AuthCountry>(findCountry(user?.country ?? "Guinée") ?? AUTH_COUNTRIES[0]!);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const phoneRef = useRef<any>(null);

  const { data: me, status, error, reload } = useLoader(() => api.getMerchantMe());
  const currency = user?.primaryCurrency ?? "XOF";

  const amount = useMemo(() => roundTo(parseAmount(amountText), decimalsFor(currency)), [amountText, currency]);
  const s = me?.settings;
  const min = s?.minPayment?.[currency];
  const max = s?.maxPayment?.[currency];

  const amountError = (() => {
    if (!showErrors) return null;
    if (!(amount > 0)) return "Saisissez le montant à encaisser.";
    if (min && amount < min) return `Montant minimum : ${money(min, currency)}.`;
    if (max && amount > max) return `Montant maximum : ${money(max, currency)}.`;
    return null;
  })();
  const phoneError = showErrors && mode === "phone" ? validatePhone(phone) : null;

  if (status === "loading") return <Screen header={<NavBar onBack={() => router.back()} title="Encaisser" />}><SkeletonRows rows={3} /></Screen>;
  if (status === "error" || !me) {
    return <Screen header={<NavBar onBack={() => router.back()} title="Encaisser" />}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }
  if (!me.isMerchant || me.profile?.status !== "ACTIVE") {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title="Encaisser" />}>
        <Notice tone="warn" title="Encaissement indisponible">
          {me.profile?.status === "SUSPENDED" ? "Votre espace marchand est suspendu." : "Activez d'abord votre espace marchand."}
        </Notice>
      </Screen>
    );
  }

  const submit = async () => {
    setProblem(null);
    setShowErrors(true);
    if (!(amount > 0) || (min && amount < min) || (max && amount > max)) return;
    if (mode === "phone" && validatePhone(phone)) return;
    setBusy(true);
    try {
      const payment = mode === "qr"
        ? await api.createQrPayment({ amount, currency, note: note.trim() || undefined })
        : await api.createPhonePayment({ amount, currency, payerPhone: `${country.dial}${normalizeNationalNumber(phone)}`, note: note.trim() || undefined });
      router.replace({ pathname: "/merchant/payment", params: { id: payment.id } } as any);
    } catch (e) {
      setProblem(apiProblem(e).message);
    } finally {
      setBusy(false);
    }
  };

  const fee = s ? roundTo((amount * (s.paymentFeePct ?? 0)) / 100, decimalsFor(currency)) : 0;

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title="Encaisser" subtitle={me.profile.businessName} />}
      footer={<Button label="Envoyer" icon="paper-plane-outline" loading={busy} onPress={submit} testID="collect-send" />}
    >
      <Rise>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <Chip label="QR code" icon="qr-code-outline" active={mode === "qr"} onPress={() => setMode("qr")} />
          <Chip label="Téléphone Orange" icon="phone-portrait-outline" active={mode === "phone"} onPress={() => setMode("phone")} />
        </View>
      </Rise>

      {!!problem && <Notice tone="danger" style={{ marginBottom: 14 }}>{problem}</Notice>}

      <Card pad={20}>
        <AmountInput label="Montant à encaisser" value={amountText} onChangeText={setAmountText} currency={currency} error={amountError} autoFocus />
        {amount > 0 && fee > 0 && !amountError ? (
          <UText v="caption" tone="muted" style={{ marginTop: 4 }}>
            Frais de service {money(fee, currency)} · vous recevez {money(amount - fee, currency)}
          </UText>
        ) : null}
      </Card>

      <View style={{ height: 16 }} />
      {mode === "phone" ? (
        <PhoneField
          country={country}
          onCountryChange={setCountry}
          value={phone}
          onChangeText={setPhone}
          error={phoneError}
          hint="Numéro du compte de votre client (Orange Money). Sans le 0 de tête."
          accent={C.accent}
          inputRef={phoneRef}
          onSubmitEditing={submit}
        />
      ) : (
        <Card tone="accent" pad={16}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Ionicons name="qr-code-outline" size={26} color={C.accentDeep} />
            <UText v="caption" style={{ flex: 1 }}>
              Un QR code à usage unique s'affiche pendant {s?.qrValidityMinutes ?? 5} min. Votre client le scanne, vérifie le montant sur son téléphone et valide avec son code secret.
            </UText>
          </View>
        </Card>
      )}

      <View style={{ height: 16 }} />
      <Field label="Libellé (facultatif)" icon="create-outline" value={note} onChangeText={setNote} maxLength={140} autoCapitalize="sentences" />
    </Screen>
  );
}
