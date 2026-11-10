// apps/direct-transfair-mobile/utils/kycGate.ts
// =========================================================
// KYC GATE v1.0 — le serveur refuse envois, virements programmés et retraits tant que l'identité n'est pas validée
// (403 { code: 'KYC_REQUIRED', kycStatus, message }). Cette fonction reconnaît ce refus et oriente le client vers
// l'écran de vérification au lieu d'afficher une erreur sèche.
// =========================================================

import { Alert, Platform } from "react-native";
import { tr } from "../i18n/runtime";

type Router = { push: (href: any) => void };

export const KYC_SCREEN = "/(tabs)/profile/kyc";

/** Le refus vient-il du contrôle d'identité ? */
export function isKycRequired(err: unknown): boolean {
  const e = err as { response?: { status?: number; data?: { code?: string } } } | null;
  return e?.response?.status === 403 && e?.response?.data?.code === "KYC_REQUIRED";
}

export function kycRequiredMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown; kycStatus?: string } } } | null)?.response?.data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  return data?.kycStatus === "PENDING"
    ? tr("kycgate.pending")
    : tr("kycgate.required");
}

/**
 * Si l'erreur est un refus KYC : affiche l'invitation à vérifier l'identité et renvoie true (l'appelant n'affiche alors
 * rien d'autre). Sinon renvoie false.
 */
export function handleKycRequired(err: unknown, router: Router): boolean {
  if (!isKycRequired(err)) return false;
  const message = kycRequiredMessage(err);
  if (Platform.OS === "web") {
    if (window.confirm(`${tr("kycgate.title")}\n\n${message}\n\n${tr("kycgate.openNow")}`)) router.push(KYC_SCREEN);
    return true;
  }
  Alert.alert(tr("kycgate.title"), message, [
    { text: tr("kycgate.later"), style: "cancel" },
    { text: tr("kycgate.verify"), onPress: () => router.push(KYC_SCREEN) },
  ]);
  return true;
}
