// apps/direct-transfair-mobile/app/(tabs)/profile/support-ticket.tsx
// =========================================================
// ASSISTANCE — fil d'une demande (v1.0) : échanges avec le service client, réponse, décision d'un litige.
// Les notes internes du personnel ne sont jamais envoyées par le serveur. Développé par Thierno Doniko — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, type SupportTicketItem, type SupportTicketReplyItem } from "../../../services/api";
import { useLoader } from "../../../components/wallet/useLoader";
import { useT } from "../../../providers/I18nProvider";
import { lazyLabels, tr } from "../../../i18n/runtime";
import { Button, Card, ErrorView, Field, NavBar, Notice, Pill, Screen, SkeletonRows, UText, useUI } from "../../../components/ui";

const OUTCOME_TEXT: Record<string, string> = lazyLabels<string>({
  ACCEPTED: "supt.ACCEPTED",
  REJECTED: "supt.REJECTED",
  INFO: "supt.INFO",
});

function errorMessage(e: any): string {
  const raw = e?.response?.data?.message || e?.message || tr("sup.error");
  return Array.isArray(raw) ? String(raw[0]) : String(raw);
}

type Thread = { ticket: SupportTicketItem; replies: SupportTicketReplyItem[] };

export default function SupportTicketScreen() {
  const { C, R } = useUI();
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ticketId = typeof id === "string" ? id : "";

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [override, setOverride] = useState<Thread | null>(null);

  const { data, status, error, refreshing, reload, refresh } = useLoader<Thread>(async () => {
    const loaded = await api.getMyTicket(ticketId);
    setOverride(null);
    return loaded;
  });
  const thread = override ?? data;
  const closed = thread?.ticket.status === "CLOSED";

  const send = async () => {
    setSending(true);
    setProblem(null);
    try {
      setOverride(await api.replyMyTicket(ticketId, reply.trim()));
      setReply("");
    } catch (e: any) {
      setProblem(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {status === "loading" && !thread ? (
        <SkeletonRows rows={4} />
      ) : status === "error" && !thread ? (
        <ErrorView title={error?.title ?? t("supt.notFound")} message={error?.message ?? ""} onRetry={reload} />
      ) : thread ? (
        <>
          <UText v="hero">{thread.ticket.subject}</UText>
          {thread.ticket.isDispute ? <Pill label={t("supt.disputeOnTx")} tone="warn" icon="alert-circle-outline" style={{ marginTop: 10 }} /> : null}

          {thread.ticket.outcome ? (
            <Notice tone={thread.ticket.outcome === "REJECTED" ? "danger" : "pos"} title={OUTCOME_TEXT[thread.ticket.outcome]} style={{ marginTop: 16 }}>
              {thread.ticket.resolutionNote ?? ""}
            </Notice>
          ) : null}

          <View style={{ gap: 10, marginTop: 20 }}>
            <View style={{ alignSelf: "flex-end", maxWidth: "88%", padding: 14, borderRadius: R.md, backgroundColor: C.accentSoft }}>
              <UText v="body">{thread.ticket.message}</UText>
            </View>
            {thread.replies.map((r) => (
              <View
                key={r.id}
                style={{
                  alignSelf: r.fromMe ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  padding: 14,
                  borderRadius: R.md,
                  backgroundColor: r.fromMe ? C.accentSoft : C.field,
                }}
              >
                {!r.fromMe ? <UText v="label" tone="muted" style={{ marginBottom: 4 }}>{r.author.isStaff ? t("supt.staff") : r.author.name}</UText> : null}
                <UText v="body">{r.message}</UText>
              </View>
            ))}
          </View>

          {closed ? (
            <Card tone="sunken" style={{ marginTop: 24 }}>
              <UText v="caption" tone="muted">{t("supt.closed")}</UText>
            </Card>
          ) : (
            <View style={{ marginTop: 24 }}>
              {problem ? <Notice tone="danger" style={{ marginBottom: 12 }}>{problem}</Notice> : null}
              <Field label={t("supt.yourReply")} value={reply} onChangeText={setReply} multiline maxLength={2000} autoCapitalize="sentences" />
              <Button label={t("sup.send")} icon="send-outline" onPress={send} loading={sending} disabled={reply.trim().length < 2 || sending} />
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}
