// apps/direct-transfair-mobile/app/(tabs)/profile/kyc.tsx
// =========================================================
// VÉRIFICATION D'IDENTITÉ v1.0 (lot 7) — Direct Transf'air
// Le client voit où en est son dossier et ce qu'il lui reste à envoyer :
//   1. pièce d'identité (carte, passeport, permis, titre de séjour) — recto/verso selon la pièce
//   2. selfie
//   3. (facultatif, une fois vérifié) justificatif de domicile → plafonds plus élevés
// Tant que 1 et 2 ne sont pas validées par un administrateur : pas d'envoi, de virement programmé ni de retrait.
// Un refus affiche le motif et propose de renvoyer ; une pièce qui expire dans moins de 30 jours est signalée avec un bouton
// « Renouveler » (l'ancienne reste valable pendant la vérification de la nouvelle) ; une pièce expirée bloque les opérations.
// =========================================================

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "../../../components/ui/Icon";
import { useLoader } from "../../../components/wallet/useLoader";
import { KycStatusCard } from "../../../components/wallet/KycStatusCard";
import { Card, ErrorView, NavBar, Notice, Pill, Screen, SectionHeader, SkeletonRows, SlowNote, UText, useUI } from "../../../components/ui";
import {
  KYC_ADDRESS_TYPES, KYC_DOC_LABEL, KYC_DOC_STATUS_LABEL, KYC_IDENTITY_TYPES, formatDay, kycApi,
  type KycDocStatus, type KycDocumentView, type KycStatusView,
} from "../../../services/kyc";

type StepState = "todo" | "pending" | "done" | "rejected" | "expired";

/** Dernière version d'un des types donnés, la plus significative d'abord (validée > en attente > refusée). */
function pick(docs: KycDocumentView[], types: string[]): KycDocumentView | null {
  const mine = docs.filter((d) => types.includes(d.type));
  const order: KycDocStatus[] = ["APPROVED", "PENDING", "REJECTED", "EXPIRED"];
  for (const s of order) {
    const hit = mine.find((d) => d.status === s);
    if (hit) return hit;
  }
  return null;
}

function stateOf(doc: KycDocumentView | null): StepState {
  if (!doc) return "todo";
  return doc.status === "APPROVED" ? "done" : doc.status === "PENDING" ? "pending" : doc.status === "REJECTED" ? "rejected" : "expired";
}

function Step({
  index, title, subtitle, doc, state, onPress, optional, renew,
}: { index: number; title: string; subtitle: string; doc: KycDocumentView | null; state: StepState; onPress?: () => void; optional?: boolean; renew?: boolean }) {
  const { C, R } = useUI();
  const tone = { todo: "neutral", pending: "info", done: "pos", rejected: "danger", expired: "danger" }[state] as "neutral" | "info" | "pos" | "danger";
  const action = state === "todo" ? "Envoyer" : state === "rejected" || state === "expired" ? "Renvoyer" : renew && state === "done" ? "Renouveler" : null;
  const iconColor = state === "done" ? C.pos : state === "rejected" || state === "expired" ? C.danger : state === "pending" ? C.info : C.muted;
  const icon = state === "done" ? "checkmark-circle" : state === "pending" ? "time" : state === "rejected" || state === "expired" ? "alert-circle" : "ellipse-outline";

  return (
    <Card style={{ marginBottom: 12 }} onPress={action ? onPress : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: R.pill, backgroundColor: C.field, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon as any} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="subheading" numberOfLines={2}>{index}. {title}{optional ? " (facultatif)" : ""}</UText>
          <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{subtitle}</UText>
        </View>
        {doc ? <Pill label={KYC_DOC_STATUS_LABEL[doc.status]} tone={tone} /> : null}
      </View>

      {doc && state !== "todo" ? (
        <View style={{ marginTop: 10, gap: 4 }}>
          <UText v="caption" tone="muted">
            {doc.label}{doc.documentNumber ? ` · n° ${doc.documentNumber}` : ""}{doc.expiryDate ? ` · expire le ${formatDay(doc.expiryDate)}` : ""}
          </UText>
        </View>
      ) : null}

      {state === "rejected" && doc?.rejectionReason ? (
        <Notice tone="danger" title="Motif du refus" style={{ marginTop: 10 }}>{doc.rejectionReason}</Notice>
      ) : null}
      {state === "expired" ? (
        <Notice tone="danger" style={{ marginTop: 10 }}>Cette pièce a expiré. Envoyez-en une en cours de validité.</Notice>
      ) : null}

      {action ? (
        <View style={{ marginTop: 12, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 38, borderRadius: R.pill, backgroundColor: C.sun }}>
          <Ionicons name="camera-outline" size={16} color={C.sunInk} />
          <UText v="caption" color={C.sunInk} style={{ fontWeight: "700" }}>{action}</UText>
        </View>
      ) : null}
    </Card>
  );
}

export default function KycScreen() {
  const router = useRouter();
  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<KycStatusView>(() => kycApi.me());

  const go = (kind: "identity" | "selfie" | "address") => router.push({ pathname: "/(tabs)/profile/kyc-submit", params: { kind } } as any);

  const docs = data?.documents ?? [];
  const identity = pick(docs, KYC_IDENTITY_TYPES);
  const selfie = pick(docs, ["SELFIE"]);
  const address = pick(docs, KYC_ADDRESS_TYPES);
  const rejected = docs.some((d) => d.status === "REJECTED");
  const expiring = !!data && data.verified && !!data.expiry && !data.expiry.expired;

  return (
    <Screen
      header={<NavBar title="Vérification d'identité" subtitle="Obligatoire pour envoyer de l'argent" onBack={() => router.back()} />}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {status === "loading" ? (
        <>
          <SlowNote visible={slow} />
          <SkeletonRows rows={3} />
        </>
      ) : status === "error" || !data ? (
        <ErrorView title={error?.title ?? "Chargement impossible"} message={error?.message ?? "Réessaie dans un instant."} onRetry={() => void reload()} />
      ) : (
        <>
          <KycStatusCard
            status={data.status}
            expiry={data.expiry}
            hasRejection={rejected}
            onPress={() => {
              if (data.status === "VERIFIED") return expiring ? go("identity") : undefined;
              go(identity && identity.status !== "REJECTED" && identity.status !== "EXPIRED" ? "selfie" : "identity");
            }}
          />

          {expiring ? (
            <Notice tone={data.expiry!.daysLeft <= 7 ? "danger" : "warn"} icon="hourglass" style={{ marginTop: 14 }}>
              Votre {data.expiry!.label.toLowerCase()} est valable jusqu'au {formatDay(data.expiry!.expiryDate)}. Après cette date, les envois, virements programmés et retraits seront bloqués tant qu'une nouvelle pièce n'est pas vérifiée : envoyez-la dès maintenant, votre accès reste ouvert pendant la vérification.
            </Notice>
          ) : data.expiry?.expired ? (
            <Notice tone="danger" icon="alert-circle" style={{ marginTop: 14 }}>
              Votre {data.expiry.label.toLowerCase()} a expiré le {formatDay(data.expiry.expiryDate)}. Les envois, virements programmés et retraits sont bloqués jusqu'à la validation d'une nouvelle pièce.
            </Notice>
          ) : null}

          {data.status === "VERIFIED" ? (
            <Notice tone="pos" icon="shield-checkmark" style={{ marginTop: 14 }}>
              {data.verifiedAt ? `Identité vérifiée le ${formatDay(data.verifiedAt.slice(0, 10))}. ` : ""}Vos envois, virements et retraits sont ouverts dans la limite de vos plafonds.
            </Notice>
          ) : (
            <Notice tone="info" style={{ marginTop: 14 }}>
              Vos pièces sont lues uniquement par les équipes habilitées de votre société, pour respecter la réglementation contre le blanchiment d'argent. Photographiez-les de près, bien éclairées, sans reflet.
            </Notice>
          )}

          <SectionHeader title="Votre dossier" style={{ marginTop: 24, marginBottom: 12 }} />
          <Step
            index={1}
            title="Pièce d'identité"
            subtitle="Carte d'identité, passeport, permis ou titre de séjour en cours de validité."
            doc={identity}
            state={stateOf(identity)}
            renew={expiring}
            onPress={() => go("identity")}
          />
          <Step
            index={2}
            title="Selfie"
            subtitle="Une photo de votre visage, prise maintenant, pour la comparer à votre pièce."
            doc={selfie}
            state={stateOf(selfie)}
            onPress={() => go("selfie")}
          />

          {data.verified ? (
            <>
              <SectionHeader title="Aller plus loin" style={{ marginTop: 12, marginBottom: 12 }} />
              <Step
                index={3}
                title="Justificatif de domicile"
                subtitle="Facture de moins de 3 mois ou relevé bancaire. Relève vos plafonds d'envoi."
                doc={address}
                state={stateOf(address)}
                optional
                onPress={() => go("address")}
              />
            </>
          ) : null}

          {data.history.length > data.documents.length ? (
            <>
              <SectionHeader title="Historique" style={{ marginTop: 12, marginBottom: 8 }} />
              {data.history.map((h) => (
                <View key={h.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <UText v="body" numberOfLines={1}>{KYC_DOC_LABEL[h.type]}</UText>
                    <UText v="caption" tone="muted">Envoyée le {formatDay(h.createdAt.slice(0, 10))}</UText>
                  </View>
                  <Pill label={KYC_DOC_STATUS_LABEL[h.status]} tone={h.status === "APPROVED" ? "pos" : h.status === "PENDING" ? "info" : "danger"} />
                </View>
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
