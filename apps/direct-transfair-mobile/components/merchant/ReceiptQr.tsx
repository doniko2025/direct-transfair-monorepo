// apps/direct-transfair-mobile/components/merchant/ReceiptQr.tsx
// =========================================================
// REÇU PDF AVEC QR DE VÉRIFICATION (lot 14)
// Un PDF généré sur le téléphone peut être retouché. Le reçu porte donc un QR code qui ouvre la page de contrôle du serveur
// (vrai montant, commerce, date, statut). Le QR est dessiné hors écran puis converti en image pour être placé dans le PDF.
// Usage :  const { share, qrNode } = useReceiptSharer(payment, "merchant", logo);  …  {qrNode}  …  <Button onPress={share} />
// Sans QR (génération impossible), le PDF n'est PAS produit : un reçu sans moyen de contrôle ne doit pas circuler.
// =========================================================

import React, { useCallback, useRef } from "react";
import { Alert, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { receiptVerifyUrl, shareReceipt } from "../../services/merchantDocs";
import type { PaymentRequestView } from "../../services/merchantTypes";
import { tr } from "../../i18n/runtime";

function toDataUrl(qr: any): Promise<string | null> {
  return new Promise((resolve) => {
    if (!qr?.toDataURL) { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), 3000);
    try {
      qr.toDataURL((data: string) => { clearTimeout(timer); resolve(data || null); });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export function useReceiptSharer(p: PaymentRequestView | null, side: "merchant" | "payer", logo?: string | null) {
  const ref = useRef<any>(null);
  const code = p?.status === "PAID" ? p.verifyCode : undefined;
  const url = code ? receiptVerifyUrl(code) : null;

  const share = useCallback(async () => {
    if (!p) return;
    if (!code || !url) {
      Alert.alert(tr("rcq.unavailTitle"), tr("rcq.unavailMsg"));
      return;
    }
    const qr = await toDataUrl(ref.current);
    if (!qr) {
      Alert.alert(tr("mx.error"), tr("rcq.qrFail"));
      return;
    }
    await shareReceipt(p, side, logo, { qr, url, code });
  }, [p, side, logo, code, url]);

  const qrNode = url ? (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: -4000, top: 0, opacity: 0 }}>
      <QRCode value={url} size={240} ecl="M" quietZone={8} backgroundColor="#FFFFFF" color="#000000" getRef={(c: any) => { ref.current = c; }} />
    </View>
  ) : null;

  return { share, qrNode };
}
