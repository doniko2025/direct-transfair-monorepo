// apps/direct-transfair-mobile/components/receipt/ReceiptPdfActions.tsx
// =========================================================
// CARTE « REÇU PDF » de l'écran Détail d'une opération — disponible quel que soit le statut (en attente, disponible, payé, annulé…) :
// le reçu officiel (logo et coordonnées de la société, montants, code de retrait pour l'expéditeur, QR de vérification) est construit
// par le SERVEUR ; le PDF porte le statut du moment (« Disponible — à retirer », « Payé »…) et se régénère à chaque appui.
//   • Télécharger : fichier « Recu-<référence>.pdf » → Enregistrer dans Fichiers / Drive
//   • WhatsApp / e-mail : même fichier PDF, joint par la feuille de partage du téléphone
// Le QR est dessiné hors écran (invisible) pour être converti en image dans le PDF.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "../ui/Icon";
import { Button, Card, UText, useUI } from "../ui";
import { useT } from "../../providers/I18nProvider";
import { tr } from "../../i18n/runtime";
import {
  fetchTransferReceipt, qrToDataUrl, shareTransferReceiptPdf, transferVerifyUrl, type TransferReceiptDoc,
} from "../../services/transferReceipt";

type Mode = "download" | "send";

export function ReceiptPdfActions({ transactionId, status }: { transactionId: string; status?: string }) {
  const { C, R } = useUI();
  const t = useT();
  const [doc, setDoc] = useState<TransferReceiptDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Mode | null>(null);
  const qrRef = useRef<any>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try { setDoc(await fetchTransferReceipt(transactionId)); }
    catch { setFailed(true); }
  }, [transactionId]);

  // Rechargé si le statut change (ex. « Disponible » → « Payé ») : le PDF doit toujours refléter l'état réel.
  useEffect(() => { void load(); }, [load, status]);

  const run = async (mode: Mode) => {
    if (!doc || busy) return;
    setBusy(mode);
    try {
      const qr = await qrToDataUrl(qrRef.current);
      if (!qr) { Alert.alert(tr("common.error"), tr("rcpt.qrFail")); return; }
      await shareTransferReceiptPdf(doc, qr);
    } finally { setBusy(null); }
  };

  return (
    <Card pad={18} style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: R.md, backgroundColor: C.sunken, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="document-text-outline" size={22} color={C.ink} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="bodyStrong">{t("rcpt.pdfCardTitle")}</UText>
          <UText v="caption" tone="muted">{doc ? t("rcpt.pdfCardStatus", { status: doc.statusLabel }) : t("rcpt.pdfCardHint")}</UText>
        </View>
      </View>

      {failed ? (
        <View style={{ gap: 10 }}>
          <UText v="caption" tone="muted">{t("rcpt.loadFail")}</UText>
          <Button label={t("common.retry")} icon="refresh-outline" kind="ghost" onPress={load} />
        </View>
      ) : !doc ? (
        <View style={{ paddingVertical: 10, alignItems: "center" }}><ActivityIndicator color={C.ink} /></View>
      ) : (
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Button label={t("rcpt.pdfDownload")} icon="download-outline" loading={busy === "download"} disabled={!!busy} onPress={() => run("download")} style={{ flex: 1, minWidth: 140 }} />
          <Button label={t("rcpt.pdfSend")} icon="logo-whatsapp" kind="dark" loading={busy === "send"} disabled={!!busy} onPress={() => run("send")} style={{ flex: 1, minWidth: 140 }} />
        </View>
      )}
      {!!doc && <UText v="caption" tone="muted">{t("rcpt.pdfSendHint")}</UText>}

      {/* QR hors écran : sert uniquement à fabriquer l'image intégrée au PDF */}
      {!!doc && (
        <View pointerEvents="none" style={{ position: "absolute", left: -2000, top: 0, opacity: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <QRCode value={transferVerifyUrl(doc.qr.code)} size={148} ecl="M" quietZone={6} backgroundColor="#FFFFFF" color="#000000" getRef={(c: any) => { qrRef.current = c; }} />
        </View>
      )}
    </Card>
  );
}
