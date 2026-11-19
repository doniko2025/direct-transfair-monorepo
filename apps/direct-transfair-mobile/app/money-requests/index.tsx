// apps/direct-transfair-mobile/app/money-requests/index.tsx
// =========================================================
// DEMANDES D'ARGENT — liste (lot 16)
// Onglets « Reçues » / « Envoyées ». Une demande reçue se règle en un geste : « Payer » ouvre l'envoi avec le destinataire
// (et le montant, si la devise est la vôtre) déjà remplis ; la demande passe seule à « Réglée » une fois l'envoi abouti.
// Refuser (payeur) et annuler (demandeur) demandent une confirmation. Les demandes échues expirent côté serveur.
// =========================================================

import React, { useMemo, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { MoneyRequestStatus, MoneyRequestView, MoneyRequestsOverview } from "../../services/growthTypes";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { describeAuthError } from "../../components/auth/authErrors";
import { Rise } from "../../components/merchant/merchantUi";
import { Avatar, Button, Card, EmptyView, ErrorView, NavBar, Notice, Pill, Screen, SkeletonRows, SlowNote, Tabs, UText, useUI } from "../../components/ui";
import { fmtMoney } from "../../utils/amount";
import { fmtDate } from "../../i18n/runtime";
import type { MessageKey } from "../../i18n/catalog";

const TONE: Record<MoneyRequestStatus, "warn" | "pos" | "danger" | "neutral"> = {
  PENDING: "warn", PAID: "pos", DECLINED: "danger", CANCELLED: "neutral", EXPIRED: "neutral",
};

function RequestCard({ r, index, busy, onPay, onClose }: { r: MoneyRequestView; index: number; busy: boolean; onPay: () => void; onClose: () => void }) {
  const t = useT();
  const { C } = useUI();
  const received = r.direction === "RECEIVED";
  const pending = r.status === "PENDING";
  return (
    <Rise delay={Math.min(index, 6) * 60}>
      <Card style={{ marginBottom: 12 }} pad={16}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={r.counterpartName} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="bodyStrong" numberOfLines={1}>{received ? t("grw.mr.from", { name: r.counterpartName }) : t("grw.mr.to", { name: r.counterpartName })}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{fmtDate(r.createdAt)}</UText>
          </View>
          <Pill label={t(`grw.mr.st.${r.status}` as MessageKey)} tone={TONE[r.status]} />
        </View>

        <UText v="display" style={{ marginTop: 14, fontSize: 30 }} color={received && pending ? C.accentDeep : undefined} numberOfLines={1} adjustsFontSizeToFit>
          {`${fmtMoney(r.amount, r.currency)} ${r.currency}`}
        </UText>
        {!!r.note && <UText v="body" tone="muted" style={{ marginTop: 4 }} numberOfLines={3}>{`« ${r.note} »`}</UText>}
        {pending && <UText v="caption" tone="muted" style={{ marginTop: 8 }}>{t("grw.mr.expires", { date: fmtDate(r.expiresAt) })}</UText>}

        {pending && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            {received ? (
              <>
                <View style={{ flex: 1 }}><Button label={t("grw.mr.pay")} icon="send" onPress={onPay} small disabled={busy} /></View>
                <View style={{ flex: 1 }}><Button label={t("grw.mr.decline")} kind="outline" onPress={onClose} small disabled={busy} /></View>
              </>
            ) : (
              <View style={{ flex: 1 }}><Button label={t("grw.mr.cancel")} kind="outline" onPress={onClose} small disabled={busy} /></View>
            )}
          </View>
        )}
      </Card>
    </Rise>
  );
}

export default function MoneyRequestsScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const myCurrency = (user as any)?.primaryCurrency || (user as any)?.currency || "XOF";

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<MoneyRequestsOverview>(() => api.getMoneyRequests());

  const list = useMemo(() => (data ? (tab === "received" ? data.received : data.sent) : []), [data, tab]);

  const pay = (r: MoneyRequestView) => {
    // Le montant n'est pré-rempli que s'il est dans votre devise : sinon c'est à vous de saisir l'équivalent.
    const sameCurrency = r.currency === myCurrency;
    if (!sameCurrency) Alert.alert(t("grw.mr.pay"), t("grw.mr.otherCurrency", { currency: r.currency }));
    router.push({
      pathname: "/(tabs)/send",
      params: { mode: "WALLET", ...(r.counterpartPhone ? { phone: r.counterpartPhone } : {}), ...(sameCurrency ? { amount: String(r.amount) } : {}) },
    } as any);
  };

  const close = (r: MoneyRequestView) => {
    const received = r.direction === "RECEIVED";
    const run = async () => {
      setBusyId(r.id);
      setProblem(null);
      try {
        if (received) await api.declineMoneyRequest(r.id); else await api.cancelMoneyRequest(r.id);
      } catch (e) {
        setProblem(describeAuthError(e, "generic").message);
      } finally {
        setBusyId(null);
        await refresh();
      }
    };
    const question = received ? t("grw.mr.declineAsk") : t("grw.mr.cancelAsk");
    if (Platform.OS === "web") { if (window.confirm(question)) void run(); return; }
    Alert.alert(question, `${fmtMoney(r.amount, r.currency)} ${r.currency} · ${r.counterpartName}`, [
      { text: t("grw.mr.keep"), style: "cancel" },
      { text: received ? t("grw.mr.decline") : t("grw.mr.cancel"), style: "destructive", onPress: () => void run() },
    ]);
  };

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title={t("grw.mr.title")} />}
      footer={<Button label={t("grw.mr.new")} icon="add" onPress={() => router.push("/money-requests/new" as any)} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "received", label: data?.pendingToPay ? `${t("grw.mr.received")} (${data.pendingToPay})` : t("grw.mr.received") },
          { key: "sent", label: t("grw.mr.sent") },
        ]}
        style={{ marginBottom: 16 }}
      />

      {problem ? <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice> : null}

      {status === "loading" ? (
        <>
          <SkeletonRows rows={3} />
          <SlowNote visible={slow} />
        </>
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? t("state.error")} message={error?.message ?? t("state.loadFailed")} onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyView
          icon={tab === "received" ? "download-outline" : "paper-plane-outline"}
          title={tab === "received" ? t("grw.mr.emptyReceived") : t("grw.mr.emptySent")}
          message={tab === "received" ? t("grw.mr.emptyReceivedMsg") : t("grw.mr.emptySentMsg")}
          actionLabel={tab === "sent" ? t("grw.mr.new") : undefined}
          onAction={tab === "sent" ? () => router.push("/money-requests/new" as any) : undefined}
        />
      ) : (
        list.map((r, i) => (
          <RequestCard key={r.id} r={r} index={i} busy={busyId === r.id} onPay={() => pay(r)} onClose={() => close(r)} />
        ))
      )}
    </Screen>
  );
}
