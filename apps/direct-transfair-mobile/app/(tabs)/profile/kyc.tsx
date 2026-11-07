// apps/direct-transfair-mobile/app/(tabs)/profile/kyc.tsx
// =========================================================
// VÉRIFICATION D'IDENTITÉ v1.1 (lot 7) — Direct Transf'air
// Le client voit où en est son dossier et ce qu'il lui reste à envoyer :
//   1. pièce d'identité (carte, passeport, permis, titre de séjour) — recto/verso selon la pièce
//   2. selfie
//   3. (facultatif, une fois vérifié) justificatif de domicile → plafonds plus élevés
// Tant que 1 et 2 ne sont pas validées par un administrateur : pas d'envoi, de virement programmé ni de retrait.
// Un refus affiche le motif et propose de renvoyer ; une pièce qui expire dans moins de 30 jours est signalée avec un bouton
// « Renouveler » (l'ancienne reste valable pendant la vérification de la nouvelle) ; une pièce expirée bloque les opérations.
//
// ✅ v1.1 :
//   • cartes d'étapes refaites : l'icône et le titre occupent toute la largeur, la pastille d'état passe SOUS le titre (avant,
//     la longue pastille « En cours de vérification » écrasait le texte en colonne étroite) ; détails de la pièce dans un
//     encadré lisible (type, numéro masqué, date d'expiration, date d'envoi / de validation) ; bouton d'action pleine largeur ;
//   • barre de progression « x sur 2 étapes validées » ;
//   • la carte du haut mène à la PROCHAINE étape réellement manquante (avant : toujours le selfie dès qu'une pièce existait,
//     même quand le selfie était déjà validé) et ne fait rien quand il n'y a plus rien à envoyer ;
//   • le statut « APPROVED » du serveur est traduit en « VERIFIED » (services/kyc.ts → normalizeKycStatus).
// =========================================================

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "../../../components/ui/Icon";
import { useLoader } from "../../../components/wallet/useLoader";
import { KycStatusCard } from "../../../components/wallet/KycStatusCard";
import { Button, Card, ErrorView, NavBar, Notice, Pill, Screen, SectionHeader, SkeletonRows, SlowNote, UText, useUI } from "../../../components/ui";
import {
  KYC_ADDRESS_TYPES, KYC_DOC_LABEL, KYC_DOC_STATUS_LABEL, KYC_IDENTITY_TYPES, formatDay, kycApi, maskDocNumber,
  type KycDocStatus, type KycDocumentView, type KycStatusView,
} from "../../../services/kyc";

type StepState = "todo" | "pending" | "done" | "rejected" | "expired";
type Kind = "identity" | "selfie" | "address";

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

/** Une étape est-elle encore à faire par le client ? (rien, refusée ou expirée) */
const needsAction = (s: StepState) => s === "todo" || s === "rejected" || s === "expired";

/** Ligne « libellé · valeur » de l'encadré de détails : la valeur passe à la ligne au lieu d'être coupée. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <UText v="caption" tone="muted">{label}</UText>
      <UText v="caption" style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>{value}</UText>
    </View>
  );
}

function Step({
  index, title, subtitle, doc, state, onPress, optional, renew,
}: { index: number; title: string; subtitle: string; doc: KycDocumentView | null; state: StepState; onPress?: () => void; optional?: boolean; renew?: boolean }) {
  const { C, R } = useUI();
  const tone = ({ todo: "neutral", pending: "info", done: "pos", rejected: "danger", expired: "danger" } as const)[state];
  const action = state === "todo" ? "Envoyer" : state === "rejected" || state === "expired" ? "Renvoyer" : renew && state === "done" ? "Renouveler" : null;
  const iconColor = state === "done" ? C.pos : state === "rejected" || state === "expired" ? C.danger : state === "pending" ? C.info : C.muted;
  const iconBg = state === "done" ? C.posBg : state === "rejected" || state === "expired" ? C.dangerBg : state === "pending" ? C.infoBg : C.field;
  const icon = state === "done" ? "checkmark-circle" : state === "pending" ? "time" : state === "rejected" || state === "expired" ? "alert-circle" : "ellipse-outline";
  const pillLabel = doc ? KYC_DOC_STATUS_LABEL[doc.status] : "À envoyer";

  const details: Array<{ label: string; value: string }> = [];
  if (doc && state !== "todo") {
    details.push({ label: "Document", value: KYC_DOC_LABEL[doc.type] ?? doc.label });
    if (doc.documentNumber) details.push({ label: "Numéro", value: maskDocNumber(doc.documentNumber) });
    if (doc.expiryDate) details.push({ label: "Expire le", value: formatDay(doc.expiryDate) });
    if (state === "done" && doc.reviewedAt) details.push({ label: "Validée le", value: formatDay(doc.reviewedAt.slice(0, 10)) });
    else if (doc.createdAt) details.push({ label: "Envoyée le", value: formatDay(doc.createdAt.slice(0, 10)) });
  }

  return (
    <Card style={{ marginBottom: 12 }} pad={16}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: R.pill, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon as any} size={24} color={iconColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="subheading">{index}. {title}{optional ? " (facultatif)" : ""}</UText>
          <Pill label={pillLabel} tone={tone} style={{ marginTop: 6 }} />
        </View>
      </View>

      <UText v="caption" tone="muted" style={{ marginTop: 12 }}>{subtitle}</UText>

      {details.length > 0 ? (
        <View style={{ marginTop: 12, padding: 12, borderRadius: R.md, backgroundColor: C.field, gap: 8 }}>
          {details.map((d) => <Detail key={d.label} label={d.label} value={d.value} />)}
        </View>
      ) : null}

      {state === "rejected" && doc?.rejectionReason ? (
        <Notice tone="danger" title="Motif du refus" style={{ marginTop: 12 }}>{doc.rejectionReason}</Notice>
      ) : null}
      {state === "expired" ? (
        <Notice tone="danger" style={{ marginTop: 12 }}>Cette pièce a expiré. Envoyez-en une en cours de validité.</Notice>
      ) : null}

      {action && onPress ? (
        <Button
          label={action}
          icon="camera-outline"
          kind={state === "todo" || state === "rejected" || state === "expired" ? "primary" : "outline"}
          small
          onPress={onPress}
          style={{ marginTop: 14 }}
        />
      ) : null}
    </Card>
  );
}

/** Barre « x sur y étapes validées ». */
function Progress({ done, total }: { done: number; total: number }) {
  const { C } = useUI();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <UText v="caption" tone="muted">Progression</UText>
        <UText v="caption" style={{ fontWeight: "700" }}>{done} sur {total} étapes validées</UText>
      </View>
      <View style={{ height: 8, borderRadius: 99, overflow: "hidden", backgroundColor: C.field }}>
        <View style={{ height: 8, borderRadius: 99, width: `${pct}%`, backgroundColor: done === total ? C.pos : C.accent }} />
      </View>
    </View>
  );
}

export default function KycScreen() {
  const router = useRouter();
  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<KycStatusView>(() => kycApi.me());

  const go = (kind: Kind) => router.push({ pathname: "/(tabs)/profile/kyc-submit", params: { kind } } as any);

  const docs = data?.documents ?? [];
  const identity = pick(docs, KYC_IDENTITY_TYPES);
  const selfie = pick(docs, ["SELFIE"]);
  const address = pick(docs, KYC_ADDRESS_TYPES);
  const identityState = stateOf(identity);
  const selfieState = stateOf(selfie);
  const rejected = docs.some((d) => d.status === "REJECTED");
  const expiring = !!data && data.verified && !!data.expiry && !data.expiry.expired;
  const doneCount = (identityState === "done" ? 1 : 0) + (selfieState === "done" ? 1 : 0);

  /** Prochaine étape RÉELLEMENT à faire ; null quand tout est envoyé (en attente) ou validé. */
  const nextKind = (): Kind | null => {
    if (needsAction(identityState)) return "identity";
    if (needsAction(selfieState)) return "selfie";
    return null;
  };

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
              const next = nextKind();
              if (next) go(next);
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
          <Progress done={doneCount} total={2} />
          <Step
            index={1}
            title="Pièce d'identité"
            subtitle="Carte d'identité, passeport, permis ou titre de séjour en cours de validité."
            doc={identity}
            state={identityState}
            renew={expiring}
            onPress={() => go("identity")}
          />
          <Step
            index={2}
            title="Selfie"
            subtitle="Une photo de votre visage, prise maintenant, pour la comparer à votre pièce."
            doc={selfie}
            state={selfieState}
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
                  <View style={{ flex: 1, minWidth: 0 }}>
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
