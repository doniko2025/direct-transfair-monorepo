// apps/direct-transfair-mobile/app/bills/schedule-new.tsx
// =========================================================
// FACTURES PROGRAMMÉES — nouvelle programmation (lot 14b). Sans facturier en paramètre : liste des facturiers de la société.
// Ouvert aussi depuis le suivi d'un paiement (« Programmer ce paiement ») avec facturier, référence, champs et montant préremplis.
//   REMIND  rappel avant l'échéance puis le jour J ; le client paie lui-même (code secret à chaque paiement).
//   AUTO    UN code secret ici (consentement) ; chaque échéance part ensuite seule. Proposé seulement si la société l'a ouvert.
// =========================================================

import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "../../components/ui/Icon";
import { api } from "../../services/api";
import type { BillerView, BillScheduleFrequency, BillScheduleList, BillScheduleMode } from "../../services/billTypes";
import { BillerRow, CategoryBadge, TintCard, billCategoryLabel, categoryHue, categoryIcon } from "../../components/bills/billsUi";
import { AmountInput, Button, Card, Chip, ErrorView, Field, NavBar, Notice, Screen, SkeletonRows, UText, useUI } from "../../components/ui";
import { PinPrompt, Rise, apiProblem, money } from "../../components/merchant/merchantUi";
import { isKycRequired, kycRequiredMessage, KYC_SCREEN } from "../../utils/kycGate";
import { decimalsFor, parseAmount, roundTo } from "../../utils/amount";
import { useT } from "../../providers/I18nProvider";
import type { MessageKey } from "../../i18n/catalog";

const FREQUENCIES: BillScheduleFrequency[] = ["MONTHLY", "WEEKLY", "QUARTERLY", "YEARLY"];

const two = (n: number) => String(n).padStart(2, "0");
/** Date locale au format AAAA-MM-JJ. */
const isoDay = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const firstOfNextMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1); };

/** AAAA-MM-JJ qui existe vraiment (le 30 février est refusé). */
function validDay(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

const safeJson = (raw: unknown): Record<string, string> => {
  try {
    const o = JSON.parse(String(raw ?? "{}"));
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
};

export default function ScheduleNewScreen() {
  const t = useT();
  const router = useRouter();
  const { C } = useUI();
  const params = useLocalSearchParams<{ id?: string; ref?: string; f?: string; label?: string; amount?: string }>();

  const [settings, setSettings] = useState<BillScheduleList | null>(null);
  const [billers, setBillers] = useState<BillerView[] | null>(null);
  const [biller, setBiller] = useState<BillerView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [label, setLabel] = useState(typeof params.label === "string" ? params.label : "");
  const [reference, setReference] = useState(typeof params.ref === "string" ? params.ref : "");
  const [fields, setFields] = useState<Record<string, string>>(() => safeJson(params.f));
  const [amountText, setAmountText] = useState(typeof params.amount === "string" ? params.amount : "");
  const [frequency, setFrequency] = useState<BillScheduleFrequency>("MONTHLY");
  const [start, setStart] = useState(isoDay(firstOfNextMonth()));
  const [end, setEnd] = useState("");
  const [mode, setMode] = useState<BillScheduleMode>("REMIND");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; kyc?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    api.listBillSchedules()
      .then((s) => { if (alive) setSettings(s); })
      .catch((e) => { if (alive) setLoadError(apiProblem(e).message); });
    if (params.id) {
      api.getBiller(String(params.id))
        .then((b) => { if (alive) setBiller(b); })
        .catch((e) => { if (alive) setLoadError(apiProblem(e).message); });
    } else {
      api.listBillers()
        .then((b) => { if (alive) setBillers(b); })
        .catch((e) => { if (alive) setLoadError(apiProblem(e).message); });
    }
    return () => { alive = false; };
  }, [params.id]);

  const currency = biller?.currency ?? "XOF";
  const fixed = biller?.amountMode === "FROM_LOOKUP";
  const amount = useMemo(() => roundTo(parseAmount(amountText), decimalsFor(currency)), [amountText, currency]);
  const autoAllowed = !!settings?.autoDebitEnabled;

  const error = (): string | null => {
    if (!biller) return null;
    if (!label.trim()) return t("bill.sch.labelRequired");
    if (!reference.trim()) return t("bill.refRequired");
    if (biller.referencePattern) {
      try { if (!new RegExp(biller.referencePattern).test(reference.trim())) return biller.referenceHint ?? `${biller.referenceLabel} ?`; } catch { /* le serveur tranche */ }
    }
    for (const f of biller.fields) if (f.required && !(fields[f.key] ?? "").trim()) return t("bill.fieldRequired", { label: f.label });
    if (!fixed) {
      if (!(amount > 0)) return t("bill.amountRequired");
      if (biller.minAmount && amount < biller.minAmount) return t("bill.min", { amount: money(biller.minAmount, currency) });
      if (biller.maxAmount && amount > biller.maxAmount) return t("bill.max", { amount: money(biller.maxAmount, currency) });
    }
    if (!validDay(start) || (end.trim() && !validDay(end))) return t("bill.sch.dateInvalid");
    return null;
  };

  const submit = async () => {
    if (!biller || busy) return;
    setShowErrors(true);
    setProblem(null);
    if (error()) return;
    if (mode === "AUTO" && pin.length !== 6) return;
    setBusy(true);
    setPinError(null);
    try {
      await api.createBillSchedule({
        billerId: biller.id,
        label: label.trim(),
        reference: reference.trim(),
        fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
        amount: fixed ? undefined : amount,
        frequency,
        startDate: start.trim(),
        endDate: end.trim() || undefined,
        mode,
        pin: mode === "AUTO" ? pin : undefined,
      });
      router.replace("/bills/schedules" as any);
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else if (isKycRequired(e)) setProblem({ text: kycRequiredMessage(e), kyc: true });
      else setProblem({ text: pr.message });
    } finally {
      setBusy(false);
    }
  };

  const ready = !!biller && (mode === "REMIND" || pin.length === 6);

  const quick = (d: Date) => setStart(isoDay(d));

  return (
    <Screen
      header={<NavBar onBack={() => (biller && !params.id ? setBiller(null) : router.back())} title={t("bill.sch.formTitle")} />}
      footer={biller ? <Button label={t("bill.sch.save")} icon={mode === "AUTO" ? "lock-closed-outline" : "calendar-outline"} disabled={!ready} loading={busy} onPress={() => void submit()} /> : undefined}
    >
      {loadError ? (
        <ErrorView title={t("bill.loadFail")} message={loadError} onRetry={() => router.back()} />
      ) : settings && !settings.enabled ? (
        <Notice tone="warn">{t("bill.sch.disabledMsg")}</Notice>
      ) : !biller ? (
        billers === null || !settings ? (
          <SkeletonRows rows={3} />
        ) : (
          <>
            <UText v="subheading" style={{ marginBottom: 12 }}>{t("bill.sch.pickBiller")}</UText>
            {billers.length === 0 ? <UText v="body" tone="muted">{t("bill.noBillers")}</UText> : billers.map((b, i) => <BillerRow key={b.id} biller={b} delay={i * 45} onPress={() => setBiller(b)} />)}
          </>
        )
      ) : (
        <Rise>
          <TintCard hue={categoryHue(biller.category)} mark={categoryIcon(biller.category)} pad={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <CategoryBadge category={biller.category} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <UText v="bodyStrong" numberOfLines={2}>{biller.name}</UText>
                <UText v="caption" tone="muted">{billCategoryLabel(biller.category)}</UText>
              </View>
              {!params.id && <Button small full={false} kind="ghost" label={t("bill.sch.change")} onPress={() => setBiller(null)} />}
            </View>
          </TintCard>

          <Field style={{ marginTop: 16 }} label={t("bill.sch.label")} value={label} onChangeText={setLabel} maxLength={60} autoCapitalize="sentences" error={showErrors && !label.trim() ? t("bill.sch.labelRequired") : null} />
          <Field style={{ marginTop: 12 }} label={biller.referenceLabel} value={reference} onChangeText={setReference} hint={biller.referenceHint ?? undefined} autoCapitalize="characters" error={showErrors && !reference.trim() ? t("bill.refRequired") : null} />
          {biller.fields.map((f) =>
            f.type === "select" ? (
              <View key={f.key} style={{ marginTop: 12 }}>
                <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>{f.label}</UText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(f.options ?? []).map((o) => <Chip key={o} label={o} active={fields[f.key] === o} onPress={() => setFields((c) => ({ ...c, [f.key]: o }))} />)}
                </View>
              </View>
            ) : (
              <Field key={f.key} style={{ marginTop: 12 }} label={f.label} value={fields[f.key] ?? ""} keyboardType={f.type === "number" ? "decimal-pad" : "default"} onChangeText={(v) => setFields((c) => ({ ...c, [f.key]: v }))} error={showErrors && f.required && !(fields[f.key] ?? "").trim() ? t("bill.fieldRequired", { label: f.label }) : null} />
            ),
          )}

          <View style={{ height: 16 }} />
          {fixed ? (
            <Notice tone="info">{t("bill.sch.amountFromBiller")}</Notice>
          ) : (
            <Card pad={20}>
              <AmountInput label={t("bill.amount")} value={amountText} onChangeText={setAmountText} currency={currency} />
            </Card>
          )}

          <UText v="caption" tone="muted" style={{ marginTop: 16, marginBottom: 8 }}>{t("bill.sch.freq")}</UText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FREQUENCIES.map((f) => <Chip key={f} label={t(`bill.sch.every.${f}` as MessageKey)} active={frequency === f} onPress={() => setFrequency(f)} />)}
          </View>

          <Field style={{ marginTop: 16 }} label={t("bill.sch.start")} value={start} onChangeText={setStart} maxLength={10} keyboardType="numbers-and-punctuation" error={showErrors && !validDay(start) ? t("bill.sch.dateInvalid") : null} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <Chip label={t("bill.sch.today")} active={start === isoDay(new Date())} onPress={() => quick(new Date())} />
            <Chip label={t("bill.sch.tomorrow")} active={start === isoDay(addDays(1))} onPress={() => quick(addDays(1))} />
            <Chip label={t("bill.sch.nextMonth")} active={start === isoDay(firstOfNextMonth())} onPress={() => quick(firstOfNextMonth())} />
          </View>
          <Field style={{ marginTop: 12 }} label={t("bill.sch.end")} value={end} onChangeText={setEnd} maxLength={10} keyboardType="numbers-and-punctuation" error={showErrors && end.trim() && !validDay(end) ? t("bill.sch.dateInvalid") : null} />

          <UText v="subheading" style={{ marginTop: 22, marginBottom: 10 }}>{t("bill.sch.modeTitle")}</UText>
          {([["REMIND", "notifications-outline", t("bill.sch.remindDesc"), true], ["AUTO", "flash-outline", t("bill.sch.autoDesc"), autoAllowed]] as const).map(([m, icon, desc, allowed]) => (
            <Pressable key={m} disabled={!allowed} onPress={() => { setMode(m); setPinError(null); }} style={{ marginBottom: 10, opacity: allowed ? 1 : 0.5 }}>
              <Card tone={mode === m ? "accent" : "surface"} pad={14} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={icon as any} size={20} color={C.accentDeep} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <UText v="bodyStrong">{t(`bill.sch.mode.${m}` as MessageKey)}</UText>
                  <UText v="caption" tone="muted">{desc}</UText>
                </View>
                <Ionicons name={(mode === m ? "radio-button-on" : "radio-button-off") as any} size={22} color={mode === m ? C.accent : C.faint} />
              </Card>
            </Pressable>
          ))}
          {!autoAllowed && settings ? <Notice tone="info">{t("bill.sch.autoClosed")}</Notice> : null}
          {settings && mode === "REMIND" ? <Notice tone="info" icon="notifications-outline">{t("bill.sch.remindInfo", { days: String(settings.remindDaysBefore) })}</Notice> : null}

          {mode === "AUTO" && (
            <View style={{ marginTop: 6 }}>
              <Notice tone="warn" icon="shield-checkmark-outline">{t("bill.sch.autoNotice")}</Notice>
              <View style={{ height: 14 }} />
              <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError} label={t("bill.sch.pinLabel")} />
            </View>
          )}

          {showErrors && error() ? <Notice tone="danger" style={{ marginTop: 12 }}>{error()}</Notice> : null}
          {problem && (
            <Notice tone="danger" style={{ marginTop: 12 }} action={problem.kyc ? t("bill.verifyId") : undefined} onAction={problem.kyc ? () => router.push(KYC_SCREEN as any) : undefined}>
              {problem.text}
            </Notice>
          )}
        </Rise>
      )}
    </Screen>
  );
}
