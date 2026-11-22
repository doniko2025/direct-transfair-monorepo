// apps/direct-transfair-mobile/app/bills/biller.tsx
// =========================================================
// FACTURES — payer une facture (lot 14). Deux étapes sur le même écran :
//   1. SAISIE      numéro de facture, champs demandés par le facturier (matricule, trimestre…), vérification de la facture quand le
//                  facturier le permet (titulaire masqué + montant dû), montant, portefeuille débité.
//   2. CONFIRMATION devis du serveur (frais, taux, total, solde suffisant ?), code secret, paiement.
// Sécurité : une clé d'idempotence est créée à l'arrivée sur la confirmation — un double appui ou une coupure réseau ne débite jamais
// deux fois. Identité non vérifiée → invitation à la vérifier. Code secret faux / bloqué → message sous la saisie.
// =========================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { BillerView, BillLookupResult, BillQuote } from "../../services/billTypes";
import { CategoryBadge, TintCard, billCategoryLabel, categoryHue, categoryIcon } from "../../components/bills/billsUi";
import { AmountInput, Button, Card, Chip, Divider, ErrorView, Field, NavBar, Notice, Screen, SkeletonRows, Toggle, UText } from "../../components/ui";
import { PinPrompt, Rise, apiProblem, money } from "../../components/merchant/merchantUi";
import { isKycRequired, kycRequiredMessage, KYC_SCREEN } from "../../utils/kycGate";
import { decimalsFor, parseAmount, roundTo } from "../../utils/amount";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { userCurrency } from "../../utils/currency";

/** Clé unique d'UNE confirmation (8 à 80 caractères) : le serveur ignore tout rejeu avec la même clé. */
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "danger" }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8 }}>
      <UText v="body" tone="muted">{label}</UText>
      <UText v={strong ? "bodyStrong" : "body"} tone={tone} style={{ flexShrink: 1, textAlign: "right" }}>{value}</UText>
    </View>
  );
}

const safeJson = (raw: unknown): Record<string, string> => {
  try {
    const o = JSON.parse(String(raw ?? "{}"));
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
};

export default function PayBillScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; ref?: string; f?: string; label?: string; amount?: string }>();

  const [biller, setBiller] = useState<BillerView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reference, setReference] = useState(typeof params.ref === "string" ? params.ref : "");
  const [fields, setFields] = useState<Record<string, string>>(() => safeJson(params.f));
  const [amountText, setAmountText] = useState(typeof params.amount === "string" ? params.amount : "");
  const [walletCurrency, setWalletCurrency] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [lookup, setLookup] = useState<BillLookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [problem, setProblem] = useState<{ tone: "danger" | "warn"; text: string; kyc?: boolean } | null>(null);

  const [step, setStep] = useState<"form" | "confirm">("form");
  const [quote, setQuote] = useState<BillQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [save, setSave] = useState(!!params.label);
  const [saveName, setSaveName] = useState(typeof params.label === "string" ? params.label : "");
  const key = useRef(newKey());
  const submitting = useRef(false);

  useEffect(() => {
    let alive = true;
    if (!params.id) return;
    api.getBiller(String(params.id))
      .then((b) => { if (alive) setBiller(b); })
      .catch((e) => { if (alive) setLoadError(apiProblem(e).message); });
    api.getMyWallets()
      .then((ws) => { if (alive) setCurrencies(ws.map((w) => w.currency)); })
      .catch(() => { /* le choix du portefeuille est un confort : le serveur prend la devise principale */ });
    return () => { alive = false; };
  }, [params.id]);

  const currency = biller?.currency ?? userCurrency(user);
  const walletCcy = walletCurrency ?? userCurrency(user);
  // Montant imposé par le facturier : seulement si son connecteur sait interroger la facture. Sinon (ou si la recherche n'est pas
  // possible), le client saisit le montant — jamais d'écran sans champ de saisie.
  const fixed = biller?.amountMode === "FROM_LOOKUP" && !!biller.automatic && lookup?.supported !== false;
  const amount = useMemo(
    () => (fixed ? roundTo(lookup?.amountDue ?? 0, decimalsFor(currency)) : roundTo(parseAmount(amountText), decimalsFor(currency))),
    [fixed, lookup, amountText, currency],
  );

  // Toute modification de la facture invalide la vérification déjà faite.
  const resetLookup = useCallback(() => { setLookup(null); setProblem(null); }, []);

  const fieldError = (): string | null => {
    if (!biller) return null;
    if (!reference.trim()) return t("bill.refRequired");
    if (biller.referencePattern) {
      try { if (!new RegExp(biller.referencePattern).test(reference.trim())) return biller.referenceHint ?? `${biller.referenceLabel} ?`; } catch { /* motif cassé : le serveur tranche */ }
    }
    for (const f of biller.fields) {
      if (f.required && !(fields[f.key] ?? "").trim()) return t("bill.fieldRequired", { label: f.label });
    }
    return null;
  };

  const amountError = (): string | null => {
    if (!biller || fixed) return null;
    if (!(amount > 0)) return t("bill.amountRequired");
    if (biller.minAmount && amount < biller.minAmount) return t("bill.min", { amount: money(biller.minAmount, currency) });
    if (biller.maxAmount && amount > biller.maxAmount) return t("bill.max", { amount: money(biller.maxAmount, currency) });
    return null;
  };

  const cleanFields = () => Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));

  const doLookup = async (): Promise<BillLookupResult | null> => {
    if (!biller) return null;
    setLooking(true);
    setProblem(null);
    try {
      const res = await api.lookupBill(biller.id, { reference: reference.trim(), fields: cleanFields() });
      setLookup(res);
      return res;
    } catch (e) {
      setProblem({ tone: "danger", text: apiProblem(e).message });
      return null;
    } finally {
      setLooking(false);
    }
  };

  // Vérification automatique : dès que le numéro (et les champs demandés) sont complets, on interroge le facturier sans appui de bouton.
  const lastAuto = useRef("");
  useEffect(() => {
    if (!biller?.automatic || step !== "form" || lookup || looking || fieldError()) return;
    const sig = JSON.stringify([reference.trim(), cleanFields()]);
    if (lastAuto.current === sig) return; // déjà tentée (échec compris) : pas de boucle, le bouton permet de réessayer
    const h = setTimeout(() => { lastAuto.current = sig; void doLookup(); }, 800);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biller, reference, fields, step, lookup, looking]);

  const check = async () => {
    setShowErrors(true);
    if (fieldError()) return;
    await doLookup();
  };

  const next = async () => {
    if (!biller) return;
    setShowErrors(true);
    if (fieldError() || amountError()) return;
    let current = lookup;
    if (fixed && !current) current = await doLookup();
    if (fixed && !(current?.amountDue && current.amountDue > 0)) return;
    setBusy(true);
    setProblem(null);
    try {
      const q = await api.quoteBill(biller.id, {
        reference: reference.trim(),
        fields: cleanFields(),
        amount: fixed ? (current?.amountDue ?? 0) : amount,
        walletCurrency: walletCcy,
      });
      setQuote(q);
      key.current = newKey();
      setPin("");
      setPinError(null);
      setStep("confirm");
    } catch (e) {
      setProblem({ tone: "danger", text: apiProblem(e).message });
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!biller || !quote || pin.length !== 6 || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setProblem(null);
    setPinError(null);
    try {
      const res = await api.payBill(biller.id, {
        reference: reference.trim(),
        fields: cleanFields(),
        amount: fixed ? quote.amount : amount,
        walletCurrency: quote.walletCurrency,
        pin,
        idempotencyKey: key.current,
        saveAs: save && saveName.trim() ? saveName.trim() : undefined,
      });
      router.replace({ pathname: "/bills/payment", params: { id: res.id } } as any);
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else if (isKycRequired(e)) setProblem({ tone: "warn", text: kycRequiredMessage(e), kyc: true });
      else setProblem({ tone: "danger", text: pr.message });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const back = () => (step === "confirm" ? (setStep("form"), setPin(""), setProblem(null)) : router.back());

  return (
    <Screen
      header={<NavBar onBack={back} title={step === "confirm" ? t("bill.confirmTitle") : (biller?.name ?? t("bill.fillTitle"))} />}
      footer={
        biller && step === "form"
          ? <Button label={t("bill.continue")} icon="arrow-forward" loading={busy || looking} onPress={next} testID="bill-continue" />
          : undefined
      }
    >
      {loadError ? (
        <ErrorView title={t("bill.notFound")} message={loadError} onRetry={() => router.back()} />
      ) : !biller ? (
        <SkeletonRows rows={3} />
      ) : step === "form" ? (
        <Rise>
          <TintCard hue={categoryHue(biller.category)} mark={categoryIcon(biller.category)} pad={18}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <CategoryBadge category={biller.category} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <UText v="heading" numberOfLines={2}>{biller.name}</UText>
                <UText v="caption" tone="muted">{billCategoryLabel(biller.category)}</UText>
              </View>
            </View>
          </TintCard>
          {biller.simulated ? <Notice tone="warn" style={{ marginTop: 12 }}>{t("bill.simulated")}</Notice> : null}

          <View style={{ height: 16 }} />
          <Field
            label={biller.referenceLabel}
            value={reference}
            onChangeText={(v) => { setReference(v); resetLookup(); }}
            hint={biller.referenceHint ?? undefined}
            error={showErrors && !reference.trim() ? t("bill.refRequired") : null}
            autoCapitalize="characters"
            testID="bill-reference"
          />
          {biller.fields.map((f) => (
            f.type === "select" ? (
              <View key={f.key} style={{ marginTop: 12 }}>
                <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>{f.label}</UText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(f.options ?? []).map((o) => (
                    <Chip key={o} label={o} active={fields[f.key] === o} onPress={() => { setFields((c) => ({ ...c, [f.key]: o })); resetLookup(); }} />
                  ))}
                </View>
                {showErrors && f.required && !(fields[f.key] ?? "").trim() ? <UText v="caption" tone="danger" style={{ marginTop: 6 }}>{t("bill.fieldRequired", { label: f.label })}</UText> : null}
              </View>
            ) : (
              <Field
                key={f.key}
                style={{ marginTop: 12 }}
                label={f.label}
                value={fields[f.key] ?? ""}
                keyboardType={f.type === "number" ? "decimal-pad" : "default"}
                onChangeText={(v) => { setFields((c) => ({ ...c, [f.key]: v })); resetLookup(); }}
                error={showErrors && f.required && !(fields[f.key] ?? "").trim() ? t("bill.fieldRequired", { label: f.label }) : null}
              />
            )
          ))}

          {biller.automatic ? (
            <Button label={t("bill.check")} icon="search-outline" kind="soft" loading={looking} onPress={check} style={{ marginTop: 14 }} />
          ) : (
            <Notice tone="info" style={{ marginTop: 14 }}>{t("bill.notChecked")}</Notice>
          )}

          {lookup?.supported ? (
            <Rise>
              <Card tone="accent" pad={16} style={{ marginTop: 14, gap: 4 }}>
                {!!lookup.customerName && <UText v="bodyStrong">{t("bill.holder", { name: lookup.customerName })}</UText>}
                {lookup.amountDue ? <UText v="body">{t("bill.due", { amount: money(lookup.amountDue, currency) })}</UText> : null}
                <UText v="caption" tone="muted">{t("bill.holderCheck")}</UText>
              </Card>
            </Rise>
          ) : null}

          <View style={{ height: 16 }} />
          {fixed ? (
            <Card pad={18}>
              <UText v="caption" tone="muted">{t("bill.amountFixed")}</UText>
              <UText v="title" style={{ marginTop: 6 }}>{lookup?.amountDue ? money(lookup.amountDue, currency) : looking ? t("bill.looking") : "—"}</UText>
              {!lookup?.amountDue && !looking ? <UText v="caption" tone="muted" style={{ marginTop: 6 }}>{t("bill.amountAuto")}</UText> : null}
            </Card>
          ) : (
            <Card pad={20}>
              <AmountInput label={t("bill.amount")} value={amountText} onChangeText={setAmountText} currency={currency} error={showErrors ? amountError() : null} />
            </Card>
          )}

          {currencies.length > 1 && (
            <View style={{ marginTop: 16 }}>
              <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>{t("bill.wallet")}</UText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {currencies.map((c) => <Chip key={c} label={c} active={walletCcy === c} onPress={() => setWalletCurrency(c)} />)}
              </View>
            </View>
          )}

          {problem && (
            <Notice tone={problem.tone} style={{ marginTop: 14 }} action={problem.kyc ? t("bill.verifyId") : undefined} onAction={problem.kyc ? () => router.push(KYC_SCREEN as any) : undefined}>
              {problem.text}
            </Notice>
          )}
        </Rise>
      ) : quote ? (
        <Rise>
          <TintCard hue={categoryHue(biller.category)} mark={categoryIcon(biller.category)} pad={22}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <CategoryBadge category={biller.category} size={60} />
              <UText v="heading" align="center" numberOfLines={2}>{biller.name}</UText>
              <UText v="hero" align="center" style={{ marginTop: 6 }}>{money(quote.totalCharged, quote.walletCurrency)}</UText>
              <UText v="caption" tone="muted" align="center">{t("bill.lTotal")}</UText>
            </View>
          </TintCard>

          <Card pad={18} style={{ marginTop: 14 }}>
            <Line label={t("bill.lBill")} value={reference.trim()} />
            {!!quote.customerName && <Line label={t("bill.holderLabel")} value={quote.customerName} />}
            {biller.fields.filter((f) => fields[f.key]).map((f) => <Line key={f.key} label={f.label} value={fields[f.key]} />)}
            <Divider />
            <Line label={t("bill.lAmount")} value={money(quote.amount, quote.currency)} />
            <Line label={t("bill.lFee")} value={money(quote.feeCharged, quote.walletCurrency)} />
            {quote.walletCurrency !== quote.currency && <Line label={t("bill.lRate")} value={`1 ${quote.currency} = ${quote.rate} ${quote.walletCurrency}`} />}
            <Divider />
            <Line label={t("bill.lTotal")} value={money(quote.totalCharged, quote.walletCurrency)} strong />
          </Card>

          <UText v="caption" tone={quote.sufficient ? "muted" : "danger"} align="center" style={{ marginTop: 12 }}>
            {quote.sufficient ? t("bill.balance", { amount: money(quote.balance, quote.walletCurrency) }) : t("bill.short", { amount: money(quote.balance, quote.walletCurrency) })}
          </UText>

          <Notice tone="info" style={{ marginTop: 12 }}>{quote.automatic ? t("bill.autoInfo") : t("bill.delayInfo", { hours: String(quote.delayHours) })}</Notice>
          {quote.simulated ? <Notice tone="warn" style={{ marginTop: 10 }}>{t("bill.simulated")}</Notice> : null}

          <Pressable onPress={() => setSave((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <UText v="body" style={{ flex: 1 }}>{t("bill.saveFor")}</UText>
            <Toggle value={save} onValueChange={setSave} />
          </Pressable>
          {save ? <Field style={{ marginTop: 8 }} placeholder={t("bill.saveName")} value={saveName} onChangeText={setSaveName} maxLength={60} autoCapitalize="sentences" /> : null}

          {problem && (
            <Notice tone={problem.tone} style={{ marginTop: 14 }} action={problem.kyc ? t("bill.verifyId") : undefined} onAction={problem.kyc ? () => router.push(KYC_SCREEN as any) : undefined}>
              {problem.text}
            </Notice>
          )}

          <View style={{ height: 18 }} />
          <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError} label={t("bill.pinLabel")} autoFocus />
          <Button
            label={t("bill.pay", { amount: money(quote.totalCharged, quote.walletCurrency) })}
            icon="lock-closed-outline"
            disabled={pin.length !== 6 || !quote.sufficient}
            loading={busy}
            onPress={pay}
            testID="bill-pay"
          />
          <Button label={t("bill.edit")} kind="ghost" disabled={busy} onPress={back} style={{ marginTop: 8 }} />
        </Rise>
      ) : null}
    </Screen>
  );
}
