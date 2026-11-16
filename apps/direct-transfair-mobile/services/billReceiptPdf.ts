// apps/direct-transfair-mobile/services/billReceiptPdf.ts
// =========================================================
// REÇU PDF D'UNE FACTURE (lot 14b) — le PDF est produit par le serveur (aux couleurs de la société, code de vérification inclus).
//   mobile : enregistré dans le cache de l'appareil puis ouvert dans la feuille de partage native (Enregistrer, WhatsApp, e-mail…)
//   web    : téléchargé par le navigateur
// =========================================================

import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { api } from "./api";

export type ReceiptPdfResult = "shared" | "downloaded" | "unavailable";

/** Nom de fichier sûr (la référence d'une facture ne contient normalement que des lettres, chiffres et tirets). */
export const receiptFileName = (reference: string): string => `recu-${reference.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;

export async function shareBillReceiptPdf(paymentId: string, reference: string, dialogTitle: string): Promise<ReceiptPdfResult> {
  const buf = await api.downloadBillReceiptPdf(paymentId);
  const name = receiptFileName(reference);

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "downloaded";
  }

  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(new Uint8Array(buf));
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(f.uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
  return "shared";
}
