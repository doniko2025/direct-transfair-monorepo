// apps/direct-transfair-mobile/components/receipt/TransferReceiptCard.tsx
// =========================================================
// REÇU D'ENVOI À L'ÉCRAN — « ticket » avec logo et coordonnées de la société, montant en grand, statut, parties, détail financier,
// agences, code de retrait (expéditeur seulement) et QR code. Le même QR sert à vérifier le reçu (n'importe quel téléphone) et,
// pour un envoi cash encore à payer, à le PAYER depuis l'application agent ou une scanette.
// Le QR est dessiné à l'écran (visible, scannable) et converti en image pour le PDF via `qrRef`.
// =========================================================

import React from "react";
import { Image, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "../ui/Icon";
import { Card, Pill, UText, useUI } from "../ui";
import {
  countryLabel, fmtAmount, fmtDateTime, toneColors, transferVerifyUrl,
  type ReceiptParty, type TransferReceiptDoc,
} from "../../services/transferReceipt";

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  const { C } = useUI();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <UText v="caption" tone="muted" style={{ flexShrink: 0, maxWidth: "46%" }}>{k}</UText>
      <UText v={strong ? "bodyStrong" : "body"} align="right" style={{ flex: 1 }}>{v}</UText>
    </View>
  );
}

function Party({ role, p, hiddenPhone }: { role: string; p: ReceiptParty; hiddenPhone?: boolean }) {
  const { C, R } = useUI();
  const place = [p.city, countryLabel(p.country)].filter(Boolean).join(", ");
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: C.sunken, borderRadius: R.md, padding: 12, gap: 2 }}>
      <UText v="caption" tone="muted">{role.toUpperCase()}</UText>
      <UText v="bodyStrong">{p.name}</UText>
      {!!p.phone && <UText v="caption" tone="muted">{p.phone}</UText>}
      {!p.phone && hiddenPhone && <UText v="caption" tone="muted">Téléphone masqué (contrôle au retrait)</UText>}
      {!!place && <UText v="caption" tone="muted">{place}</UText>}
    </View>
  );
}

export function TransferReceiptCard({ doc, qrRef }: { doc: TransferReceiptDoc; qrRef?: (c: any) => void }) {
  const { C, R } = useUI();
  const a = doc.amounts;
  const tone = toneColors(doc.statusTone);
  const co = doc.company;
  const contact = [co.address, co.city, co.phone, co.email, co.website].filter(Boolean).join(" · ");

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {/* En-tête société */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 3, borderBottomColor: C.accent }}>
        {co.logoUrl ? (
          <Image source={{ uri: co.logoUrl }} style={{ width: 52, height: 52, borderRadius: 12 }} resizeMode="contain" accessibilityLabel={`Logo ${co.name}`} />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="business-outline" size={24} color={C.accentDeep} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="heading" numberOfLines={1}>{co.name}</UText>
          {!!co.legalName && co.legalName !== co.name && <UText v="caption" tone="muted" numberOfLines={1}>{co.legalName}</UText>}
          {!!contact && <UText v="caption" tone="muted" numberOfLines={2}>{contact}</UText>}
        </View>
      </View>

      {/* Montant et statut */}
      <View style={{ padding: 16, gap: 6 }}>
        <UText v="caption" tone="muted">{doc.title.toUpperCase()}</UText>
        <UText v="caption" tone="muted">{doc.hero.label}</UText>
        <UText v="display" style={{ fontSize: 32, lineHeight: 40 }} adjustsFontSizeToFit numberOfLines={1}>{fmtAmount(doc.hero.amount, doc.hero.currency)}</UText>
        <View style={{ alignSelf: "flex-start", backgroundColor: tone.bg, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 }}>
          <UText v="caption" style={{ color: tone.fg, fontWeight: "800" }}>{doc.statusLabel}</UText>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Row k="Référence" v={doc.reference} strong />
        <Row k="Émis le" v={fmtDateTime(doc.createdAt)} />
        {!!doc.paidAt && <Row k="Payé le" v={fmtDateTime(doc.paidAt)} />}
        {!!doc.expiresAt && <Row k="À retirer avant le" v={fmtDateTime(doc.expiresAt)} />}
        <Row k="Mode de réception" v={doc.payout.methodLabel} />
      </View>

      {/* Parties */}
      <View style={{ padding: 16, gap: 8 }}>
        <UText v="caption" tone="muted">PARTIES</UText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Party role="Expéditeur" p={doc.sender} />
          <Party role="Bénéficiaire" p={doc.recipient} hiddenPhone={doc.recipientPhoneHidden} />
        </View>
      </View>

      {/* Détail financier */}
      <View style={{ paddingHorizontal: 16 }}>
        <UText v="caption" tone="muted" style={{ marginBottom: 2 }}>DÉTAIL FINANCIER</UText>
        <Row k="Montant envoyé" v={fmtAmount(a.sent, a.sentCurrency)} />
        <Row k="Frais" v={fmtAmount(a.fees, a.sentCurrency)} />
        <Row k="Total payé par l'expéditeur" v={fmtAmount(a.total, a.sentCurrency)} strong />
        {!!a.rate && !!a.receivedCurrency && <Row k="Taux de change" v={`1 ${a.sentCurrency} = ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(a.rate)} ${a.receivedCurrency}`} />}
        {!!a.received && !!a.receivedCurrency && <Row k="Reçu par le bénéficiaire" v={fmtAmount(a.received, a.receivedCurrency)} strong />}
      </View>

      {/* Agences */}
      {(!!doc.agency.originName || !!doc.agency.payerName) && (
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <UText v="caption" tone="muted" style={{ marginBottom: 2 }}>AGENCES</UText>
          {!!doc.agency.originName && <Row k="Envoi enregistré à" v={[doc.agency.originName, doc.agency.originCity].filter(Boolean).join(" — ")} />}
          {!!doc.agency.payerName && <Row k="Payé à" v={[doc.agency.payerName, doc.agency.payerCity].filter(Boolean).join(" — ")} />}
          {!!doc.agency.payerAgent && <Row k="Agent payeur" v={doc.agency.payerAgent} />}
        </View>
      )}

      {/* Code de retrait (expéditeur seulement) */}
      {!!doc.withdrawalCode && (
        <View style={{ margin: 16, marginBottom: 0, borderWidth: 2, borderStyle: "dashed", borderColor: C.accent, borderRadius: R.md, padding: 14, alignItems: "center", gap: 4 }}>
          <UText v="caption" tone="muted" align="center">CODE DE RETRAIT — À NE DONNER QU'AU BÉNÉFICIAIRE</UText>
          <UText v="display" style={{ letterSpacing: 5, fontSize: 28 }} selectable>{doc.withdrawalCode}</UText>
        </View>
      )}

      {/* QR */}
      <View style={{ margin: 16, borderWidth: 1.5, borderColor: C.ink, borderRadius: R.md, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        <View style={{ backgroundColor: "#FFFFFF", padding: 4 }} accessible accessibilityLabel="QR code du reçu">
          <QRCode value={transferVerifyUrl(doc.qr.code)} size={148} ecl="M" quietZone={6} backgroundColor="#FFFFFF" color="#000000" getRef={qrRef} />
        </View>
        <View style={{ flex: 1, minWidth: 150, gap: 4 }}>
          <UText v="bodyStrong">{doc.qr.payable ? "QR de paiement et de vérification" : "QR de vérification"}</UText>
          <UText v="caption" tone="muted">
            {doc.qr.payable
              ? "L'agent le scanne (application ou scanette) : le reçu est contrôlé puis le montant est versé, sans saisir le code. "
              : ""}
            Tout téléphone peut le scanner pour vérifier que ce reçu est authentique.
          </UText>
        </View>
      </View>

      {(!!co.licence || !!co.capital) && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <UText v="caption" tone="muted" align="center">{[co.licence, co.capital ? `Capital : ${co.capital}` : null].filter(Boolean).join(" · ")}</UText>
        </View>
      )}
    </Card>
  );
}
