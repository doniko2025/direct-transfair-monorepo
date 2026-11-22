// apps/direct-transfair-mobile/utils/actionableError.ts
// =========================================================
// ERREURS QUI PROPOSENT UNE ACTION (lot 19) — au lieu d'un « Erreur : … » sec, chaque refus du serveur reconnu propose la suite :
//   • identité à vérifier (KYC_REQUIRED)        → « Vérifier maintenant » (écran KYC) — voir kycGate.ts ;
//   • plafond dépassé (LIMIT_EXCEEDED)          → « Envoyer {reste} » (si l'écran le permet) ou « Voir ma vérification » ;
//   • solde insuffisant                         → « Recharger » ;
//   • taux de change indisponible (503)         → message clair + « Réessayer » ;
//   • pas de réseau                             → message clair + « Réessayer ».
// Tout le reste : le message du serveur, tel quel. Fonctionne sur téléphone ET sur le web (où Alert.alert ne fait rien).
// =========================================================

import { Alert, Platform } from "react-native";
import { tr } from "../i18n/runtime";
import { handleKycRequired, KYC_SCREEN } from "./kycGate";
import { fmtMoney } from "./amount";

type Router = { push: (href: any) => void };

export type ErrorKind = "KYC" | "LIMIT" | "BALANCE" | "RATE" | "OFFLINE" | "OTHER";

export interface ApiErrorInfo {
  kind: ErrorKind;
  message: string;
  /** Plafond : ce qu'il reste à envoyer (dans `currency`). */
  remaining?: number;
  currency?: string;
}

const firstMessage = (raw: unknown): string => (Array.isArray(raw) ? String(raw[0] ?? "") : typeof raw === "string" ? raw : "");

/** Range un refus dans une famille connue (pure : testable sans écran). */
export function classifyApiError(err: unknown, fallback = ""): ApiErrorInfo {
  const e = err as { response?: { status?: number; data?: any } } | null;
  if (!e?.response) return { kind: "OFFLINE", message: tr("err.offlineMsg") };
  const status = e.response.status;
  const data = e.response.data ?? {};
  const message = firstMessage(data.message) || fallback;

  if (status === 403 && data.code === "KYC_REQUIRED") return { kind: "KYC", message };
  if (status === 403 && data.code === "LIMIT_EXCEEDED") {
    const remaining = Number(data.remaining);
    return { kind: "LIMIT", message, remaining: Number.isFinite(remaining) && remaining > 0 ? remaining : undefined, currency: typeof data.currency === "string" ? data.currency : undefined };
  }
  if ((status === 400 || status === 403) && /solde.*insuffisant|insufficient/i.test(message)) return { kind: "BALANCE", message };
  if (status === 503 && /taux de change/i.test(message)) return { kind: "RATE", message: tr("err.rateMsg") };
  return { kind: "OTHER", message };
}

type Choice = { label: string; run: () => void };

/** Affiche un message avec une action principale (et « Fermer »). Web : confirm / alert natifs du navigateur. */
function present(title: string, message: string, action?: Choice, extra?: Choice) {
  if (Platform.OS === "web") {
    setTimeout(() => {
      if (action) {
        if (window.confirm(`${title}\n\n${message}\n\n${action.label} ?`)) action.run();
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    }, 50);
    return;
  }
  const buttons: { text: string; style?: "cancel"; onPress?: () => void }[] = [{ text: tr("common.close"), style: "cancel" }];
  if (extra) buttons.push({ text: extra.label, onPress: extra.run });
  if (action) buttons.push({ text: action.label, onPress: action.run });
  Alert.alert(title, message, buttons);
}

export interface ShowErrorOptions {
  /** Texte si le serveur n'en donne pas. */
  fallback?: string;
  /** « Réessayer » (taux indisponible, réseau). */
  onRetry?: () => void;
  /** Plafond atteint : l'écran sait recaler le montant sur ce qu'il reste à envoyer. */
  onUseAmount?: (amount: number) => void;
}

/** Montre l'erreur avec la bonne action. À appeler à la place de `Alert.alert(t("common.error"), …)`. */
export function showApiError(err: unknown, router: Router, opts: ShowErrorOptions = {}): void {
  const info = classifyApiError(err, opts.fallback ?? tr("common.error"));
  switch (info.kind) {
    case "KYC":
      if (handleKycRequired(err, router)) return;
      break;
    case "LIMIT": {
      const kyc: Choice = { label: tr("err.limitKyc"), run: () => router.push(KYC_SCREEN) };
      if (info.remaining && opts.onUseAmount) {
        const cur = info.currency ?? "";
        const max: Choice = { label: tr("err.limitMax", { amount: `${fmtMoney(info.remaining, cur)} ${cur}`.trim() }), run: () => opts.onUseAmount!(info.remaining!) };
        // Navigateur : une seule action possible → le plafond restant, c'est ce qui débloque le plus vite ; mobile : les deux.
        return present(tr("err.limitTitle"), info.message, max, kyc);
      }
      return present(tr("err.limitTitle"), info.message, kyc);
    }
    case "BALANCE":
      return present(tr("err.balanceTitle"), info.message, { label: tr("err.topUp"), run: () => router.push("/(tabs)/recharge") });
    case "RATE":
      return present(tr("err.rateTitle"), info.message, opts.onRetry ? { label: tr("err.retry"), run: opts.onRetry } : undefined);
    case "OFFLINE":
      return present(tr("err.offlineTitle"), info.message, opts.onRetry ? { label: tr("err.retry"), run: opts.onRetry } : undefined);
  }
  present(tr("common.error"), info.message);
}
