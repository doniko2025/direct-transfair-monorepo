// apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
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
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
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
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch { return `${n} ${currency}`; }
}

function LimitCard({ title, period, used, max, currency }: {
  title: string; period: string; used: number; max: number | null; currency: string;
}) {
  const { C } = useUI();
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
        <UText v="body" tone="muted">/ {unlimited ? "Sans limite" : fmt(max, currency)}</UText>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.line, overflow: "hidden", marginTop: 14, marginBottom: 12 }}>
        <View style={{ height: 8, borderRadius: 4, width: `${pct}%` as any, backgroundColor: barColor }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={isDanger ? "alert-circle-outline" : "checkmark-circle-outline"} size={15} color={isDanger ? C.danger : C.muted} />
        <UText v="caption" color={isDanger ? C.danger : C.muted} style={{ flexShrink: 1 }}>
          {unlimited ? "Aucun plafond sur cette période" : `${fmt(remaining, currency)} restant${isDanger ? " · limite presque atteinte" : ""}`}
        </UText>
      </View>
    </Card>
  );
}

// ─── Feuille « demande d'augmentation » ──────────────────
function RequestLimitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => { setReason(""); setSuccess(false); setError(null); onClose(); };

  const handleSubmit = async () => {
    if (!reason.trim()) { setError("Veuillez préciser la raison de votre demande."); return; }
    try {
      setSubmitting(true); setError(null);
      await api.http.post("/limits/request", { reason: reason.trim() });
      setSuccess(true);
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Erreur lors de l'envoi";
      setError(Array.isArray(raw) ? raw[0] : String(raw));
    } finally { setSubmitting(false); }
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title={success ? "Demande envoyée" : "Augmenter mes plafonds"}
      footer={
        success ? (
          <Button label="Fermer" onPress={handleClose} />
        ) : (
          <Button label="Envoyer la demande" icon="paper-plane-outline" onPress={handleSubmit} loading={submitting} disabled={submitting} />
        )
      }
    >
      {success ? (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
          <Ionicons name="checkmark-circle" size={56} color="#2E8B57" />
          <UText v="body" tone="muted" align="center">
            Ta demande a été transmise. Nous te répondrons dans les plus brefs délais.
          </UText>
        </View>
      ) : (
        <View style={{ paddingTop: 8 }}>
          <UText v="caption" tone="muted" style={{ marginBottom: 14 }}>Demande soumise à validation.</UText>
          <Field
            label="Motif de la demande"
            value={reason}
            onChangeText={setReason}
            placeholder="Ex. : augmentation d'activité, virements professionnels réguliers…"
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
      header={<NavBar title="Mes plafonds" subtitle="Transferts & virements" onBack={() => router.back()} />}
      footer={data?.limits ? <Button label="Demander une augmentation" icon="trending-up-outline" onPress={() => setShowModal(true)} /> : undefined}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {status === "loading" ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={3} />
        </>
      ) : status === "error" || !data?.limits ? (
        <ErrorView title={error?.title ?? "Chargement impossible"} message={error?.message ?? "Réessaie dans un instant."} onRetry={() => void reload()} />
      ) : (
        <>
          <Notice tone="info" icon="information-circle-outline">
            Ces plafonds sont fixés pour ta sécurité et conformément à la réglementation en vigueur.
          </Notice>

          <Card tone="sunken" style={{ marginTop: 16 }}>
            <UText v="overline" tone="muted">Niveau de vérification</UText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <Pill label={data.kycLabel} tone={kycTone(data.kycLevel)} icon="shield-checkmark-outline" />
            </View>
            <UText v="caption" tone="muted" style={{ marginTop: 10 }}>
              Complète ta vérification pour augmenter tes plafonds.
            </UText>
          </Card>

          <SectionHeader title="Plafonds actifs" style={{ marginTop: 26, marginBottom: 12 }} />
          <LimitCard title="Plafond journalier" period="Aujourd'hui" {...data.limits.daily} currency={data.currency} />
          <LimitCard title="Plafond mensuel" period="Ce mois" {...data.limits.monthly} currency={data.currency} />
          <LimitCard title="Plafond annuel" period="Cette année" {...data.limits.yearly} currency={data.currency} />

          <UText v="caption" tone="muted" align="center" style={{ marginTop: 6 }}>
            {data.perTransaction === null || data.perTransaction === undefined
              ? "Montant maximal par envoi : sans limite"
              : `Montant maximal par envoi : ${fmt(data.perTransaction, data.currency)}`}
          </UText>
        </>
      )}

      <RequestLimitSheet visible={showModal} onClose={() => setShowModal(false)} />
    </Screen>
  );
}
