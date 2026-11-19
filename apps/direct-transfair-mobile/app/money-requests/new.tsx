// apps/direct-transfair-mobile/app/money-requests/new.tsx
// =========================================================
// NOUVELLE DEMANDE D'ARGENT (lot 16)
// Téléphone du client (compte de la même société) + montant dans VOTRE devise + motif facultatif.
// Le serveur vérifie que la personne existe, la prévient (notification + push) et fait expirer la demande après quelques jours.
// =========================================================

import React, { useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { describeAuthError } from "../../components/auth/authErrors";
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from "../../components/auth/authCountries";
import { normalizeNationalNumber } from "../../components/auth/PhoneField";
import { Rise } from "../../components/merchant/merchantUi";
import { AmountInput, Button, Card, Field, NavBar, Notice, PhoneInput, Screen, UText } from "../../components/ui";
import { Ionicons } from "../../components/ui/Icon";
import { decimalsFor, parseAmount, roundTo, sanitizeAmountInput } from "../../utils/amount";
import { useUI } from "../../components/ui";

export default function NewMoneyRequestScreen() {
  const t = useT();
  const router = useRouter();
  const { C } = useUI();
  const { user } = useAuth();
  const currency: string = (user as any)?.primaryCurrency || (user as any)?.currency || "XOF";
  const d = decimalsFor(currency);

  const [dial, setDial] = useState<AuthCountry>(findCountry((user as any)?.country ?? "") ?? findCountry("France") ?? AUTH_COUNTRIES[0]!);
  const [phone, setPhone] = useState("");
  const [rawAmount, setRawAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; amount?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);
  const noteRef = useRef(null);

  const submit = async () => {
    const national = normalizeNationalNumber(phone);
    const amount = roundTo(parseAmount(rawAmount), d);
    const next: { phone?: string; amount?: string } = {};
    if (national.length < 6) next.phone = t("grw.mr.errPhone");
    if (!(amount > 0)) next.amount = t("grw.mr.errAmount");
    setErrors(next);
    setFormError(null);
    if (next.phone || next.amount) return;

    setBusy(true);
    try {
      const res = await api.createMoneyRequest({ payerPhone: `${dial.dial}${national}`, amount, currency, note: note.trim() || undefined });
      setDoneName(res.counterpartName);
    } catch (e) {
      setFormError(describeAuthError(e, "generic").message);
    } finally {
      setBusy(false);
    }
  };

  if (doneName) {
    return (
      <Screen
        header={<NavBar onBack={() => router.back()} title={t("grw.mr.newTitle")} />}
        footer={<Button label={t("grw.mr.title")} onPress={() => router.replace("/money-requests" as any)} />}
      >
        <Rise>
          <View style={{ alignItems: "center", paddingTop: 40, gap: 10 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.posBg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={"checkmark-circle" as any} size={48} color={C.pos} />
            </View>
            <UText v="heading" align="center">{t("grw.mr.doneTitle")}</UText>
            <UText v="body" tone="muted" align="center" style={{ maxWidth: 320 }}>{t("grw.mr.doneMsg", { name: doneName })}</UText>
          </View>
        </Rise>
      </Screen>
    );
  }

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title={t("grw.mr.newTitle")} />}
      footer={<Button label={t("grw.mr.send")} icon="paper-plane" onPress={submit} loading={busy} />}
    >
      <Notice tone="info" style={{ marginBottom: 18 }}>{t("grw.mr.newIntro")}</Notice>

      <Rise>
        <Card pad={16}>
          <PhoneInput
            label={t("grw.mr.phone")}
            country={dial}
            onCountryChange={setDial}
            value={phone}
            onChangeText={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: undefined })); }}
            error={errors.phone}
            hint={t("grw.mr.phoneHint")}
          />
          <AmountInput
            label={t("grw.mr.amount")}
            value={rawAmount}
            onChangeText={(v) => { setRawAmount(sanitizeAmountInput(v, d)); setErrors((e) => ({ ...e, amount: undefined })); }}
            currency={currency}
            error={errors.amount}
          />
          <Field
            label={t("grw.mr.note")}
            value={note}
            onChangeText={setNote}
            placeholder={t("grw.mr.notePh")}
            maxLength={200}
            autoCapitalize="sentences"
            inputRef={noteRef as any}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </Card>
      </Rise>

      {formError ? <Notice tone="danger" style={{ marginTop: 14 }}>{formError}</Notice> : null}
    </Screen>
  );
}
