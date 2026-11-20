// apps/direct-transfair-mobile/components/receipt/ReceiptPdfActions.tsx
// =========================================================
// v1.1 : carte COMPACTE — trois tuiles (Télécharger · Envoyer · Voir) au lieu de deux gros boutons pleins ; « Voir » n'apparaît que si l'écran fournit onView.
// CARTE « REÇU PDF » de l'écran Détail d'une opération — disponible quel que soit le statut (en attente, disponible, payé, annulé…) :
// le reçu officiel (logo et coordonnées de la société, montants, code de retrait pour l'expéditeur, QR de vérification) est construit
// par le SERVEUR ; le PDF porte le statut du moment (« Disponible — à retirer », « Payé »…) et se régénère à chaque appui.
//   • Télécharger : fichier « Recu-<référence>.pdf » → Enregistrer dans Fichiers / Drive
//   • WhatsApp / e-mail : même fichier PDF, joint par la feuille de partage du téléphone
// Le QR est dessiné hors écran (invisible) pour être converti en image dans le PDF.
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "../ui/Icon";
import { Button, Card, UText, useUI } from "../ui";
import { Text } from "../ui/Text";
import { alpha } from "../ui/Tint";
import { useT } from "../../providers/I18nProvider";
import { tr } from "../../i18n/runtime";
import {
  fetchTransferReceipt, qrToDataUrl, shareTransferReceiptPdf, transferVerifyUrl, type TransferReceiptDoc,
} from "../../services/transferReceipt";

type Mode = "download" | "send";

/** Petite tuile d'action : icône dans un rond, libellé court dessous. La tuile « primaire » est pleine (couleur de marque). */
function Tile({ icon, label, onPress, loading, disabled, primary }: { icon: string; label: string; onPress: () => void; loading?: boolean; disabled?: boolean; primary?: boolean }) {
  const { C } = useUI();
  const fg = primary ? C.accentInk : C.text;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: disabled && !loading ? 0.5 : pressed ? 0.85 : 1 })}>
      <View style={{ height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: primary ? C.accent : C.sunken, borderWidth: primary ? 0 : 1, borderColor: C.line }}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : (
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: primary ? alpha(C.accentInk, 0.2) : C.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={icon as any} size={16} color={primary ? C.accentInk : C.accentDeep} />
          </View>
        )}
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "800", color: fg }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function ReceiptPdfActions({ transactionId, status, onView }: { transactionId: string; status?: string; onView?: () => void }) {
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
    <Card pad={14} style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: R.md, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="document-text-outline" size={19} color={C.accentDeep} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="bodyStrong" numberOfLines={1}>{t("rcpt.pdfCardTitle")}</UText>
          <UText v="caption" tone="muted" numberOfLines={1}>{doc ? t("rcpt.pdfCardStatus", { status: doc.statusLabel }) : t("rcpt.pdfCardHint")}</UText>
        </View>
      </View>

      {failed ? (
        <View style={{ gap: 10 }}>
          <UText v="caption" tone="muted">{t("rcpt.loadFail")}</UText>
          <Button label={t("common.retry")} icon="refresh-outline" kind="ghost" small onPress={load} />
        </View>
      ) : !doc ? (
        <View style={{ paddingVertical: 14, alignItems: "center" }}><ActivityIndicator color={C.ink} /></View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile primary icon="download-outline" label={t("rcpt.pdfDownload")} loading={busy === "download"} disabled={!!busy} onPress={() => run("download")} />
          <Tile icon="share-social-outline" label={t("rcpt.pdfSendShort")} loading={busy === "send"} disabled={!!busy} onPress={() => run("send")} />
          {onView ? <Tile icon="eye-outline" label={t("rcpt.pdfViewShort")} onPress={onView} /> : null}
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
