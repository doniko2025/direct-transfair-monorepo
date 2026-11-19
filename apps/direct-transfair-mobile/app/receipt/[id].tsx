// apps/direct-transfair-mobile/app/receipt/[id].tsx
// =========================================================
// REÇU D'UN ENVOI (client, agent, administrateur) — chargé par identifiant d'opération : le montant, les frais, le taux, les agences
// et le QR viennent du SERVEUR, pas d'un paramètre d'écran. Partage PDF / impression avec QR (un reçu sans QR ne sort pas).
// Remplace l'ancien reçu générique (client-receipt / agent/receipt, conservés pour les opérations sans identifiant).
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, ErrorView, NavBar, Screen, useUI } from "../../components/ui";
import { useT } from "../../providers/I18nProvider";
import { tr } from "../../i18n/runtime";
import { TransferReceiptCard } from "../../components/receipt/TransferReceiptCard";
import { fetchTransferReceipt, printTransferReceipt, qrToDataUrl, shareTransferReceiptPdf, type TransferReceiptDoc } from "../../services/transferReceipt";

export default function TransferReceiptScreen() {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<TransferReceiptDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<any>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setDoc(await fetchTransferReceipt(String(id))); }
    catch (e: any) {
      const m = e?.response?.data?.message;
      setError(Array.isArray(m) ? m[0] : m || tr("rcpt.loadFail"));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const withQr = useCallback(async (action: (d: TransferReceiptDoc, qr: string) => Promise<void>) => {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const qr = await qrToDataUrl(qrRef.current);
      if (!qr) { Alert.alert(tr("common.error"), tr("rcpt.qrFail")); return; }
      await action(doc, qr);
    } finally { setBusy(false); }
  }, [doc, busy]);

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title={t("cr.title")} subtitle={doc?.reference} />}
      footer={doc ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label={t("cr.sharePdf")} icon="share-outline" loading={busy} onPress={() => withQr(async (d, q) => { await shareTransferReceiptPdf(d, q); })} style={{ flex: 1 }} />
          <Button label={t("cr.print")} icon="print-outline" kind="dark" disabled={busy} onPress={() => withQr(printTransferReceipt)} style={{ flex: 1 }} />
        </View>
      ) : undefined}
    >
      {error ? (
        <ErrorView title={t("rcpt.unavailable")} message={error} onRetry={load} />
      ) : !doc ? (
        <View style={{ paddingVertical: 80, alignItems: "center" }}><ActivityIndicator color={C.ink} size="large" /></View>
      ) : (
        <TransferReceiptCard doc={doc} qrRef={(c) => { qrRef.current = c; }} />
      )}
    </Screen>
  );
}
