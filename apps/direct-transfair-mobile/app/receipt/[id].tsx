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
import { TransferReceiptCard } from "../../components/receipt/TransferReceiptCard";
import { fetchTransferReceipt, printTransferReceipt, shareTransferReceiptPdf, type TransferReceiptDoc } from "../../services/transferReceipt";

function toDataUrl(qr: any): Promise<string | null> {
  return new Promise((resolve) => {
    if (!qr?.toDataURL) { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), 3000);
    try { qr.toDataURL((data: string) => { clearTimeout(timer); resolve(data || null); }); }
    catch { clearTimeout(timer); resolve(null); }
  });
}

export default function TransferReceiptScreen() {
  const { C } = useUI();
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
      setError(Array.isArray(m) ? m[0] : m || "Impossible de charger le reçu.");
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const withQr = useCallback(async (action: (d: TransferReceiptDoc, qr: string) => Promise<void>) => {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const qr = await toDataUrl(qrRef.current);
      if (!qr) { Alert.alert("Erreur", "Impossible de générer le QR code du reçu. Réessayez."); return; }
      await action(doc, qr);
    } finally { setBusy(false); }
  }, [doc, busy]);

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title="Reçu" subtitle={doc?.reference} />}
      footer={doc ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label="Partager PDF" icon="share-outline" loading={busy} onPress={() => withQr(shareTransferReceiptPdf)} style={{ flex: 1 }} />
          <Button label="Imprimer" icon="print-outline" kind="dark" disabled={busy} onPress={() => withQr(printTransferReceipt)} style={{ flex: 1 }} />
        </View>
      ) : undefined}
    >
      {error ? (
        <ErrorView title="Reçu indisponible" message={error} onRetry={load} />
      ) : !doc ? (
        <View style={{ paddingVertical: 80, alignItems: "center" }}><ActivityIndicator color={C.ink} size="large" /></View>
      ) : (
        <TransferReceiptCard doc={doc} qrRef={(c) => { qrRef.current = c; }} />
      )}
    </Screen>
  );
}
