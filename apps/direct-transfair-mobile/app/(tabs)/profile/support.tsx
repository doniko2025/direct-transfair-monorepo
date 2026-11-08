// apps/direct-transfair-mobile/app/(tabs)/profile/support.tsx
// =========================================================
// ASSISTANCE v1.0 — Direct Transf'air
// Le client voit ses demandes, en ouvre une nouvelle, ou conteste une opération (litige) en arrivant avec ?transactionId=….
// Le service client lui répond depuis la version web ; il est prévenu par notification et par email.
// Maximum 5 demandes ouvertes à la fois par compte (règle du serveur).
// Comptes séparés : le compte client et le compte marchand ont chacun leurs demandes (filtre `space`).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, type SupportTicketItem, type SupportTicketStatus } from "../../../services/api";
import { useLoader } from "../../../components/wallet/useLoader";
import { useAccountSpace } from "../../../hooks/useAccountSpace";
import {
  Button, Card, EmptyView, ErrorView, Field, NavBar, Notice, Pill, Screen, SectionHeader, SkeletonRows, UText,
} from "../../../components/ui";

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  OPEN: "Envoyée", IN_PROGRESS: "En cours", WAITING_USER: "Réponse attendue", RESOLVED: "Traitée", CLOSED: "Clôturée",
};
const STATUS_TONE: Record<SupportTicketStatus, "info" | "warn" | "pos" | "neutral"> = {
  OPEN: "info", IN_PROGRESS: "info", WAITING_USER: "warn", RESOLVED: "pos", CLOSED: "neutral",
};

function errorMessage(e: any): string {
  const raw = e?.response?.data?.message || e?.message || "Une erreur est survenue.";
  return Array.isArray(raw) ? String(raw[0]) : String(raw);
}

export default function SupportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ transactionId?: string; reference?: string }>();
  const transactionId = typeof params.transactionId === "string" ? params.transactionId : undefined;
  const reference = typeof params.reference === "string" ? params.reference : undefined;

  const [composing, setComposing] = useState(!!transactionId);
  const [subject, setSubject] = useState(transactionId ? `Problème avec l'opération ${reference ?? ""}`.trim() : "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "pos" | "danger"; text: string } | null>(null);

  const { space, isMerchant } = useAccountSpace();
  const { data, status, error, refreshing, reload, refresh } = useLoader<SupportTicketItem[]>(() => api.getMyTickets(space));
  const tickets = data ?? [];

  // Changement de compte pendant que l'écran est ouvert : on recharge la liste du bon compte.
  const lastSpace = useRef(space);
  useEffect(() => {
    if (lastSpace.current !== space) { lastSpace.current = space; reload(); }
  }, [space, reload]);

  const canSend = subject.trim().length >= 3 && message.trim().length >= 10 && !sending;

  const send = async () => {
    setSending(true);
    setFeedback(null);
    try {
      const t = await api.openTicket({
        subject: subject.trim(),
        message: message.trim(),
        space,
        ...(transactionId ? { transactionId } : {}),
      });
      setComposing(false);
      setSubject("");
      setMessage("");
      setFeedback({ tone: "pos", text: "Demande envoyée. Nous vous répondons ici et par email." });
      reload();
      router.replace({ pathname: "/(tabs)/profile/support-ticket", params: { id: t.id } } as any);
    } catch (e: any) {
      setFeedback({ tone: "danger", text: errorMessage(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} />}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={!composing ? <Button label="Nouvelle demande" icon="chatbubble-ellipses-outline" onPress={() => setComposing(true)} /> : undefined}
    >
      <UText v="hero">Assistance</UText>
      <UText v="body" tone="muted" style={{ marginTop: 6, marginBottom: 20 }}>
        {transactionId
          ? "Expliquez le problème rencontré avec cette opération. Notre équipe l'examine."
          : isMerchant
            ? "Une question sur votre commerce, un encaissement ou un retrait ? Écrivez-nous."
            : "Une question, un souci avec une opération ? Écrivez-nous."}
      </UText>

      {feedback ? <Notice tone={feedback.tone} style={{ marginBottom: 16 }}>{feedback.text}</Notice> : null}

      {composing ? (
        <Card style={{ marginBottom: 20 }}>
          <Field label="Sujet" value={subject} onChangeText={setSubject} maxLength={120} autoCapitalize="sentences" />
          <Field
            label="Votre message"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            autoCapitalize="sentences"
            hint="Décrivez ce qui s'est passé (10 caractères minimum)."
          />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <Button label="Annuler" kind="ghost" onPress={() => { setComposing(false); setFeedback(null); }} style={{ flex: 1 }} />
            <Button label="Envoyer" onPress={send} loading={sending} disabled={!canSend} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      <SectionHeader title={isMerchant ? "Demandes de mon commerce" : "Mes demandes"} />
      {status === "loading" ? (
        <SkeletonRows rows={3} />
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? "Chargement impossible"} message={error?.message ?? ""} onRetry={reload} />
      ) : tickets.length === 0 ? (
        <EmptyView icon="chatbubbles-outline" title="Aucune demande" message={isMerchant ? "Les échanges concernant votre commerce apparaîtront ici." : "Vos échanges avec le service client apparaîtront ici."} />
      ) : (
        <View style={{ gap: 10 }}>
          {tickets.map((t) => (
            <Card
              key={t.id}
              pad={16}
              onPress={() => router.push({ pathname: "/(tabs)/profile/support-ticket", params: { id: t.id } } as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <UText v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{t.subject}</UText>
                <Pill label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
              </View>
              <UText v="caption" tone="muted" numberOfLines={2} style={{ marginTop: 6 }}>{t.message}</UText>
              {t.isDispute ? <Pill label="Litige" tone="warn" icon="alert-circle-outline" style={{ marginTop: 8 }} /> : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
