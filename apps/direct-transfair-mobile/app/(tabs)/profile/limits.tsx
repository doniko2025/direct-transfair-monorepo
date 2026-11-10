// apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// LIMITS SCREEN v7.0 — Direct Transf'air
// ✅ v7.0 : REFONTE THÈME CLAIR — grand titre, carte « niveau de vérification », trois
//    cartes de plafonds (journalier / mensuel / annuel) avec gros montant et jauge arrondie
//    (couleur de marque, orange > 70 %, rouge > 90 %), demande d'augmentation dans une
//    feuille basse claire. Plus de vert/bleu/violet écrits en dur. Chargement borné via
//    useLoader (20 s) avec squelette et « Réessayer ». Police système.
//    LOGIQUE INCHANGÉE (GET /limits, plafond « sans limite » si max = null, montant maximal
//    par envoi, POST /limits/request avec motif obligatoire).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v6.5 : WHITE-LABEL + chargement borné (20 s).
// ✅ v6.4 (phase 6) : plafonds réglés par la société selon le niveau KYC ; « sans limite »
//    (max = null) ; montant maximal par envoi (perTransaction).
// ✅ v6.3 : fond neutre ; fix TypeScript absoluteFill.
// =========================================================

import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import { api } from "../../../services/api";
import { useT } from "../../../providers/I18nProvider";
import { fmtNumber } from "../../../i18n/runtime";
import { useLoader } from "../../../components/wallet/useLoader";
import {
  Button, Card, ErrorView, Field, NavBar, Notice, Pill, Screen, SectionHeader, Sheet, SkeletonRows, SlowNote, UText, useUI,
} from "../../../components/ui";

type LimitEntry = { used: number; max: number | null };
type LimitsData = {
  currency: string; kycLevel: string; kycLabel: string;
  /** Montant maximal d'un seul envoi (null = sans limite). */
  perTransaction?: number | null;
  limits: { daily: LimitEntry; monthly: LimitEntry; yearly: LimitEntry };
};

function fmt(n: number, currency = "EUR"): string {
  try {
    return fmtNumber(n, { style: "currency", currency, maximumFractionDigits: 0 });
  } catch { return `${n} ${currency}`; }
}

function LimitCard({ title, period, used, max, currency }: {
  title: string; period: string; used: number; max: number | null; currency: string;
}) {
  const { C } = useUI();
  const t = useT();
  const unlimited = max === null;
  const pct = !unlimited && max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const remaining = unlimited ? 0 : Math.max(0, max - used);
  const isDanger = pct > 90;
  const isWarning = pct > 70;
  const barColor = isDanger ? C.danger : isWarning ? C.warn : C.accent;

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <UText v="overline" tone="muted">{period}</UText>
          <UText v="subheading" style={{ marginTop: 3 }}>{title}</UText>
        </View>
        <Pill label={unlimited ? "∞" : `${pct.toFixed(0)} %`} tone={isDanger ? "danger" : isWarning ? "warn" : "neutral"} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <UText v="title" numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>{fmt(used, currency)}</UText>
        <UText v="body" tone="muted">/ {unlimited ? t("lim.unlimited") : fmt(max, currency)}</UText>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.line, overflow: "hidden", marginTop: 14, marginBottom: 12 }}>
        <View style={{ height: 8, borderRadius: 4, width: `${pct}%` as any, backgroundColor: barColor }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={isDanger ? "alert-circle-outline" : "checkmark-circle-outline"} size={15} color={isDanger ? C.danger : C.muted} />
        <UText v="caption" color={isDanger ? C.danger : C.muted} style={{ flexShrink: 1 }}>
          {unlimited ? t("lim.noCap") : `${t("lim.remaining", { amount: fmt(remaining, currency) })}${isDanger ? t("lim.almost") : ""}`}
        </UText>
      </View>
    </Card>
  );
}

// ─── Feuille « demande d'augmentation » ──────────────────
function RequestLimitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => { setReason(""); setSuccess(false); setError(null); onClose(); };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError(t("lim.reqReason")); return; }
    try {
      setSubmitting(true); setError(null);
      await api.http.post("/limits/request", { reason: reason.trim() });
      setSuccess(true);
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? t("lim.reqFail");
      setError(Array.isArray(raw) ? raw[0] : String(raw));
    } finally { setSubmitting(false); }
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title={success ? t("lim.reqSent") : t("lim.reqTitle")}
      footer={
        success ? (
          <Button label={t("common.close")} onPress={handleClose} />
        ) : (
          <Button label={t("lim.reqSend")} icon="paper-plane-outline" onPress={handleSubmit} loading={submitting} disabled={submitting} />
        )
      }
    >
      {success ? (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
          <Ionicons name="checkmark-circle" size={56} color="#2E8B57" />
          <UText v="body" tone="muted" align="center">
            {t("lim.reqDone")}
          </UText>
        </View>
      ) : (
        <View style={{ paddingTop: 8 }}>
          <UText v="caption" tone="muted" style={{ marginBottom: 14 }}>{t("lim.reqNote")}</UText>
          <Field
            label={t("lim.reqReasonLabel")}
            value={reason}
            onChangeText={setReason}
            placeholder={t("lim.reqPh")}
            multiline
            maxLength={500}
            error={error}
            hint={`${reason.length} / 500`}
          />
        </View>
      )}
    </Sheet>
  );
}

export default function LimitsScreen() {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<LimitsData>(async () => {
    const res = await api.http.get<LimitsData>("/limits");
    return res.data;
  });

  const kycTone = (lvl?: string): "warn" | "pos" | "info" | "dark" =>
    lvl === "LEVEL_0" ? "warn" : lvl === "LEVEL_1" ? "pos" : lvl === "LEVEL_2" ? "info" : "dark";

  return (
    <Screen
      header={<NavBar title={t("lim.title")} subtitle={t("lim.subtitle")} onBack={() => router.back()} />}
      footer={data?.limits ? <Button label={t("lim.requestBtn")} icon="trending-up-outline" onPress={() => setShowModal(true)} /> : undefined}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {status === "loading" ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={3} />
        </>
      ) : status === "error" || !data?.limits ? (
        <ErrorView title={error?.title ?? t("kycs.loadFail")} message={error?.message ?? t("kycs.retryLater")} onRetry={() => void reload()} />
      ) : (
        <>
          <Notice tone="info" icon="information-circle-outline">
            {t("lim.info")}
          </Notice>

          <Card tone="sunken" style={{ marginTop: 16 }}>
            <UText v="overline" tone="muted">{t("lim.level")}</UText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <Pill label={(["LEVEL_0", "LEVEL_1", "LEVEL_2", "LEVEL_3"] as const).includes(data.kycLevel as any) ? t(`lim.lvl.${data.kycLevel as "LEVEL_0"}`) : data.kycLabel} tone={kycTone(data.kycLevel)} icon="shield-checkmark-outline" />
            </View>
            <UText v="caption" tone="muted" style={{ marginTop: 10 }}>
              {t("lim.upgradeHint")}
            </UText>
            {data.kycLevel !== "LEVEL_3" ? (
              <View style={{ marginTop: 12 }}>
                <Button label={t("lim.seeKyc")} icon="shield-checkmark-outline" kind="soft" small onPress={() => router.push("/(tabs)/profile/kyc" as any)} />
              </View>
            ) : null}
          </Card>

          <SectionHeader title={t("lim.active")} style={{ marginTop: 26, marginBottom: 12 }} />
          <LimitCard title={t("lim.daily")} period={t("lim.today")} {...data.limits.daily} currency={data.currency} />
          <LimitCard title={t("lim.monthly")} period={t("lim.thisMonth")} {...data.limits.monthly} currency={data.currency} />
          <LimitCard title={t("lim.yearly")} period={t("lim.thisYear")} {...data.limits.yearly} currency={data.currency} />

          <UText v="caption" tone="muted" align="center" style={{ marginTop: 6 }}>
            {data.perTransaction === null || data.perTransaction === undefined
              ? t("lim.perTxUnlimited")
              : t("lim.perTx", { amount: fmt(data.perTransaction, data.currency) })}
          </UText>
        </>
      )}

      <RequestLimitSheet visible={showModal} onClose={() => setShowModal(false)} />
    </Screen>
  );
}
