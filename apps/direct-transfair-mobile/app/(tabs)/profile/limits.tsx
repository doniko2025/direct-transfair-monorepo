// apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// LIMITS SCREEN v7.1 — Direct Transf'air
// ✅ v7.1 : REDESIGN — bandeau de marque « Disponible maintenant » (le plus gros envoi possible tout de suite, avec le plafond qui
//    limite), niveau de vérification en 3 étapes dans une carte blanche ombrée (sans vert), cartes de plafonds teintées selon l'état (vert / orange / rouge)
//    avec icône, jauge animée et apparition progressive, montant maximal par envoi en pastille. Données, calculs et demande
//    d'augmentation INCHANGÉS.
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

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import { api } from "../../../services/api";
import { useT } from "../../../providers/I18nProvider";
import { fmtNumber } from "../../../i18n/runtime";
import { useLoader } from "../../../components/wallet/useLoader";
import { Text } from "../../../components/ui/Text";
import { alpha, shade, TintCard } from "../../../components/ui/Tint";
import { Rise } from "../../../components/merchant/merchantUi";
import {
  Button, ErrorView, Field, NavBar, Screen, SectionHeader, Sheet, SkeletonRows, SlowNote, UText, useUI,
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

/** Jauge qui se remplit en douceur à l'apparition. */
function Gauge({ pct, color, track }: { pct: number; color: string; track: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: pct, duration: 700, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, pct]);
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={{ height: 10, borderRadius: 5, backgroundColor: color, width: v.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

function LimitCard({ title, period, icon, used, max, currency }: {
  title: string; period: string; icon: string; used: number; max: number | null; currency: string;
}) {
  const { C } = useUI();
  const t = useT();
  const unlimited = max === null;
  const pct = !unlimited && max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const remaining = unlimited ? 0 : Math.max(0, max - used);
  const isDanger = pct > 90;
  const isWarning = pct > 70;
  const hue = isDanger ? C.danger : isWarning ? C.warn : C.accent;

  return (
    <TintCard hue={hue} mark={icon} pad={14} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: alpha(hue, 0.16), alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon as any} size={20} color={isDanger || isWarning ? hue : C.accentDeep} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="caption" tone="muted">{period}</UText>
          <UText v="bodyStrong" numberOfLines={1}>{title}</UText>
        </View>
        <View style={{ paddingHorizontal: 11, height: 28, borderRadius: 14, backgroundColor: alpha(hue, 0.16), justifyContent: "center" }}>
          <Text style={{ fontSize: 12.5, fontWeight: "800", color: isDanger || isWarning ? hue : C.accentDeep }}>{unlimited ? "∞" : `${pct.toFixed(0)} %`}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.5, color: C.text, flexShrink: 1 }}>{fmt(used, currency).replace(/\s/g, "\u00A0")}</Text>
        <UText v="caption" tone="muted">/ {unlimited ? t("lim.unlimited") : fmt(max, currency)}</UText>
      </View>

      <View style={{ marginTop: 12, marginBottom: 10 }}>
        <Gauge pct={pct} color={hue} track={alpha(hue, 0.16)} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={isDanger ? "alert-circle-outline" : "checkmark-circle-outline"} size={15} color={isDanger ? C.danger : C.muted} />
        <UText v="caption" color={isDanger ? C.danger : C.muted} style={{ flexShrink: 1 }}>
          {unlimited ? t("lim.noCap") : `${t("lim.remaining", { amount: fmt(remaining, currency) })}${isDanger ? t("lim.almost") : ""}`}
        </UText>
      </View>
    </TintCard>
  );
}

/** Bandeau de marque : ce que l'on peut envoyer MAINTENANT. */
function HeroBand({ data }: { data: LimitsData }) {
  const { C } = useUI();
  const t = useT();
  const ink = C.accentInk;
  const { daily, monthly, yearly } = data.limits;

  // Le plus gros envoi possible = le plus petit « reste » parmi les plafonds actifs.
  const caps: { left: number; label: string }[] = [];
  if (daily.max !== null) caps.push({ left: Math.max(0, daily.max - daily.used), label: t("lim.daily") });
  if (monthly.max !== null) caps.push({ left: Math.max(0, monthly.max - monthly.used), label: t("lim.monthly") });
  if (yearly.max !== null) caps.push({ left: Math.max(0, yearly.max - yearly.used), label: t("lim.yearly") });
  if (data.perTransaction !== null && data.perTransaction !== undefined) caps.push({ left: data.perTransaction, label: t("lim.perTxName") });
  const tight = caps.length ? caps.reduce((m, c) => (c.left < m.left ? c : m)) : null;

  return (
    <View style={{ borderRadius: 24, overflow: "hidden" }}>
      <LinearGradient colors={[C.accent, shade(C.accent, 0.28)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{ position: "absolute", right: -34, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: alpha(ink, 0.08) }} />
      <View pointerEvents="none" style={{ position: "absolute", right: 40, bottom: -50, width: 100, height: 100, borderRadius: 50, backgroundColor: alpha(ink, 0.05) }} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name={"flash-outline" as any} size={14} color={ink} />
          <Text style={{ color: ink, opacity: 0.85, fontSize: 12, fontWeight: "700" }}>{t("lim.availNow")}</Text>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: ink, fontSize: 34, fontWeight: "800", letterSpacing: -0.8, marginTop: 4 }}>
          {(tight ? fmt(tight.left, data.currency) : t("lim.unlimited")).replace(/\s/g, "\u00A0")}
        </Text>
        <Text style={{ color: ink, opacity: 0.8, fontSize: 12, marginTop: 2 }}>
          {tight ? t("lim.limitedBy", { p: tight.label }) : t("lim.noCapAll")}
        </Text>
      </View>
    </View>
  );
}

/** Niveau de vérification : carte blanche ombrée (sans vert), progression en 3 étapes. */
function KycCard({ data, onKyc }: { data: LimitsData; onKyc: () => void }) {
  const { C } = useUI();
  const t = useT();
  const lvlIdx = ["LEVEL_0", "LEVEL_1", "LEVEL_2", "LEVEL_3"].indexOf(data.kycLevel);
  const lvlName = lvlIdx >= 0 ? t(`lim.lvl.${data.kycLevel as "LEVEL_0"}`) : data.kycLabel;
  return (
    <View style={{
      marginTop: 12, borderRadius: 20, padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
      shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.sunken, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={"shield-checkmark-outline" as any} size={18} color={C.text} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <UText v="caption" tone="muted">{t("lim.level")}</UText>
            <UText v="bodyStrong" numberOfLines={1}>{lvlName}</UText>
          </View>
        </View>
        {data.kycLevel !== "LEVEL_3" ? (
          <Text onPress={onKyc} accessibilityRole="button" style={{ color: C.text, fontSize: 12.5, fontWeight: "800", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, overflow: "hidden", backgroundColor: C.sunken }}>
            {t("lim.upgradeCta")}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= lvlIdx ? C.text : C.line }} />
        ))}
      </View>
      {data.kycLevel !== "LEVEL_3" ? <UText v="caption" tone="muted" style={{ marginTop: 8 }}>{t("lim.upgradeHint")}</UText> : null}
    </View>
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
        <View style={{ alignItems: "center", paddingVertical: 16, gap: 8 }}>
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
          <Rise>
            <HeroBand data={data} />
            <KycCard data={data} onKyc={() => router.push("/(tabs)/profile/kyc" as any)} />
          </Rise>

          <SectionHeader title={t("lim.active")} style={{ marginTop: 22, marginBottom: 10 }} />
          <Rise delay={60}><LimitCard title={t("lim.daily")} period={t("lim.today")} icon="sunny-outline" {...data.limits.daily} currency={data.currency} /></Rise>
          <Rise delay={120}><LimitCard title={t("lim.monthly")} period={t("lim.thisMonth")} icon="calendar-outline" {...data.limits.monthly} currency={data.currency} /></Rise>
          <Rise delay={180}><LimitCard title={t("lim.yearly")} period={t("lim.thisYear")} icon="calendar-number-outline" {...data.limits.yearly} currency={data.currency} /></Rise>

          <Rise delay={240}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: C.sunken, padding: 12 }}>
              <Ionicons name={"send-outline" as any} size={18} color={C.accentDeep} />
              <UText v="body" style={{ flex: 1 }}>
                {data.perTransaction === null || data.perTransaction === undefined
                  ? t("lim.perTxUnlimited")
                  : t("lim.perTx", { amount: fmt(data.perTransaction, data.currency) })}
              </UText>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, paddingHorizontal: 4 }}>
              <Ionicons name={"information-circle-outline" as any} size={15} color={C.muted} />
              <UText v="caption" tone="muted" style={{ flex: 1 }}>{t("lim.info")}</UText>
            </View>
          </Rise>
        </>
      )}

      <RequestLimitSheet visible={showModal} onClose={() => setShowModal(false)} />
    </Screen>
  );
}
