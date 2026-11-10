// apps/direct-transfair-mobile/app/merchant/collect.tsx
// =========================================================
// ENCAISSER v1.0 — Lot 11
// Le marchand choisit « QR code » ou « Téléphone Orange », saisit le montant puis appuie sur « Envoyer ».
//  • QR : un QR code à usage unique s'affiche, le client le scanne avec la caméra de son application.
//  • Téléphone : une demande arrive dans l'application du client (numéro du compte), qui valide avec son code secret.
// Les deux mènent à l'écran de suivi /merchant/payment (mise à jour en direct).
// Lot 13 : avec ?merchantId=… (espace « Caisse »), un caissier encaisse au nom du commerce — devise, minimum, maximum et plafond
// personnel viennent de son affiliation ; l'argent va au commerce, jamais à son portefeuille.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { MerchantMe, StaffMembership } from "../../services/merchantTypes";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Ionicons } from "../../components/ui/Icon";
import { AmountInput, Button, Card, Chip, ErrorView, Field, NavBar, Notice, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import PhoneField, { normalizeNationalNumber, validatePhone } from "../../components/auth/PhoneField";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { apiProblem, money, Rise } from "../../components/merchant/merchantUi";
import { decimalsFor, parseAmount, roundTo } from "../../utils/amount";
import { useT } from "../../providers/I18nProvider";

export default function CollectScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { C } = useUI();
  const t = useT();
  const params = useLocalSearchParams<{ mode?: string; merchantId?: string; from?: string }>();
  const shopId = params.merchantId ? String(params.merchantId) : undefined;
  const [mode, setMode] = useState<"qr" | "phone">(params.mode === "phone" ? "phone" : "qr");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [country, setCountry] = useState<AuthCountry>(findCountry(user?.country ?? "Guinée") ?? AUTH_COUNTRIES[0]!);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const phoneRef = useRef<any>(null);

  // Propriétaire : sa fiche marchand. Caissier : son affiliation à ce commerce.
  const { data: ctx, status, error, reload } = useLoader(async () => {
    if (!shopId) return { me: await api.getMerchantMe(), staff: null as StaffMembership | null };
    const list = await api.getStaffMemberships();
    return { me: null as MerchantMe | null, staff: list.find((m) => m.shopId === shopId) ?? null };
  });
  const me = ctx?.me ?? null;
  const staff = ctx?.staff ?? null;
  const currency = staff?.currency ?? user?.primaryCurrency ?? "XOF";

  const amount = useMemo(() => roundTo(parseAmount(amountText), decimalsFor(currency)), [amountText, currency]);
  const s = me?.settings;
  const min = staff ? staff.minPayment ?? undefined : s?.minPayment?.[currency];
  const serverMax = staff ? staff.maxPayment ?? undefined : s?.maxPayment?.[currency];
  const max = staff?.maxAmount ? Math.min(staff.maxAmount, serverMax ?? staff.maxAmount) : serverMax;
  const shopName = staff?.businessName ?? me?.profile?.businessName;
  const validity = staff?.qrValidityMinutes ?? s?.qrValidityMinutes ?? 5;

  const amountError = (() => {
    if (!showErrors) return null;
    if (!(amount > 0)) return t("col.amountRequired");
    if (min && amount < min) return t("col.min", { amount: money(min, currency) });
    if (max && amount > max) return t("col.max", { amount: money(max, currency) });
    return null;
  })();
  const phoneError = showErrors && mode === "phone" ? validatePhone(phone) : null;

  if (status === "loading") return <Screen header={<NavBar onBack={() => router.back()} title={t("col.title")} />}><SkeletonRows rows={3} /></Screen>;
  if (status === "error" || !ctx) {
    return <Screen header={<NavBar onBack={() => router.back()} title={t("col.title")} />}><ErrorView title={error?.title ?? t("mx.error")} message={error?.message ?? t("mx.loadFail")} onRetry={reload} /></Screen>;
  }
  if (shopId ? !staff || !staff.available : !me || !me.isMerchant || me.profile?.status !== "ACTIVE") {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title={t("col.title")} />}>
        <Notice tone="warn" title={t("col.unavailable")}>
          {shopId
            ? staff ? t("col.shopCannot") : t("col.notCashier")
            : me?.profile?.status === "SUSPENDED" ? t("col.suspended") : t("col.activateFirst")}
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
        ? await api.createQrPayment({ amount, currency, note: note.trim() || undefined, merchantId: shopId })
        : await api.createPhonePayment({ amount, currency, payerPhone: `${country.dial}${normalizeNationalNumber(phone)}`, note: note.trim() || undefined, merchantId: shopId });
      router.replace({ pathname: "/merchant/payment", params: { id: payment.id, ...(shopId ? { merchantId: shopId, from: "cashier" } : {}) } } as any);
    } catch (e) {
      setProblem(apiProblem(e).message);
    } finally {
      setBusy(false);
    }
  };

  const fee = s && !staff ? roundTo((amount * (s.paymentFeePct ?? 0)) / 100, decimalsFor(currency)) : 0;

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title={t("col.title")} subtitle={shopName} />}
      footer={<Button label={t("col.send")} icon="paper-plane-outline" loading={busy} onPress={submit} testID="collect-send" />}
    >
      <Rise>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <Chip label={t("col.modeQr")} icon="qr-code-outline" active={mode === "qr"} onPress={() => setMode("qr")} />
          <Chip label={t("col.modePhone")} icon="phone-portrait-outline" active={mode === "phone"} onPress={() => setMode("phone")} />
        </View>
      </Rise>

      {!!problem && <Notice tone="danger" style={{ marginBottom: 14 }}>{problem}</Notice>}

      <Card pad={20}>
        <AmountInput label={t("col.amountLabel")} value={amountText} onChangeText={setAmountText} currency={currency} error={amountError} autoFocus />
        {amount > 0 && fee > 0 && !amountError ? (
          <UText v="caption" tone="muted" style={{ marginTop: 4 }}>
            {t("col.fee", { fee: money(fee, currency), net: money(amount - fee, currency) })}
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
          hint={t("col.phoneHint")}
          accent={C.accent}
          inputRef={phoneRef}
          onSubmitEditing={submit}
        />
      ) : (
        <Card tone="accent" pad={16}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Ionicons name="qr-code-outline" size={26} color={C.accentDeep} />
            <UText v="caption" style={{ flex: 1 }}>
              {t("col.qrInfo", { min: validity })}
            </UText>
          </View>
        </Card>
      )}

      <View style={{ height: 16 }} />
      <Field label={t("col.note")} icon="create-outline" value={note} onChangeText={setNote} maxLength={140} autoCapitalize="sentences" />
    </Screen>
  );
}
