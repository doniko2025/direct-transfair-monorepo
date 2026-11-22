// apps/direct-transfair-mobile/utils/whatsapp.ts
// =========================================================
// WHATSAPP — prévenir le bénéficiaire d'un envoi cash avec son code de retrait, en un appui.
//   • avec le numéro du bénéficiaire : la conversation s'ouvre directement sur lui, message déjà rédigé ;
//   • sans numéro exploitable : WhatsApp ouvre le choix du contact ;
//   • WhatsApp absent / lien refusé : repli sur le partage système (rien ne reste bloqué).
// =========================================================

import { Linking, Platform, Share } from "react-native";
import { tr } from "../i18n/runtime";

/** Numéro au format international sans « + » ni espaces (« 224 622 00 11 22 » → « 224622001122 »). Vide si inexploitable. */
export function whatsappDigits(phone?: string | null): string {
  const digits = String(phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  return digits.length >= 8 ? digits : "";
}

/** Texte envoyé au bénéficiaire : qui envoie, combien, le code, et quoi faire. */
export function pickupMessage(p: { name: string; sender: string; amount: string; code: string; brand: string }): string {
  return tr("wa.msg", { name: p.name, sender: p.sender, amount: p.amount, code: p.code, brand: p.brand });
}

export async function openWhatsApp(text: string, phone?: string | null): Promise<void> {
  const digits = whatsappDigits(phone);
  const q = encodeURIComponent(text);
  const web = `https://wa.me/${digits}?text=${q}`;
  try {
    if (Platform.OS === "web") {
      window.open(web, "_blank", "noopener");
      return;
    }
    const native = `whatsapp://send?${digits ? `phone=${digits}&` : ""}text=${q}`;
    if (await Linking.canOpenURL(native).catch(() => false)) {
      await Linking.openURL(native);
      return;
    }
    await Linking.openURL(web);
  } catch {
    try { await Share.share({ message: text }); } catch { /* l'utilisateur a fermé le partage */ }
  }
}
