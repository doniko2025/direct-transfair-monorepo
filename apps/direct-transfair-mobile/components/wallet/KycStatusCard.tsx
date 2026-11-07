// apps/direct-transfair-mobile/components/wallet/KycStatusCard.tsx
// =========================================================
// KYC STATUS CARD v1.0 — carte animée « vérification d'identité » (accueil et écran de vérification).
//  • compact : bannière d'accueil (une ligne d'explication + bouton), absente quand l'identité est vérifiée
//  • sinon : grande carte avec pastille d'état, étapes (pièce d'identité, selfie) et progression
// L'entrée se fait par fondu + glissement ; la pastille « en cours » respire doucement.
// =========================================================

import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { Ionicons } from "../ui/Icon";
import { UText, useUI } from "../ui";
import { KYC_STATUS_LABEL, formatDay, type KycExpiryView, type KycOverall } from "../../services/kyc";

type Look = { icon: string; tone: "warn" | "danger" | "info" | "pos"; title: string; text: string; cta: string };

export function kycLook(status: KycOverall, hasRejection = false): Look {
  switch (status) {
    case "VERIFIED":
      return { icon: "shield-checkmark", tone: "pos", title: KYC_STATUS_LABEL.VERIFIED, text: "Vous pouvez envoyer, virer et retirer de l'argent.", cta: "Voir mon dossier" };
    case "PENDING":
      return { icon: "time", tone: "info", title: KYC_STATUS_LABEL.PENDING, text: "Un administrateur examine vos pièces. Vous serez prévenu dès que c'est fait.", cta: "Suivre mon dossier" };
    case "PARTIAL":
      return { icon: "shield-half", tone: "warn", title: KYC_STATUS_LABEL.PARTIAL, text: "Il manque encore une pièce pour finaliser la vérification.", cta: "Compléter mon dossier" };
    case "REJECTED":
      return { icon: "close-circle", tone: "danger", title: KYC_STATUS_LABEL.REJECTED, text: hasRejection ? "Une de vos pièces n'a pas été retenue. Envoyez-la à nouveau." : "Envoyez de nouveau vos pièces.", cta: "Renvoyer ma pièce" };
    case "EXPIRED":
      return { icon: "alert-circle", tone: "danger", title: KYC_STATUS_LABEL.EXPIRED, text: "Votre pièce d'identité a expiré. Envoyez-en une en cours de validité pour continuer à envoyer de l'argent.", cta: "Envoyer une nouvelle pièce" };
    default:
      return { icon: "id-card", tone: "warn", title: KYC_STATUS_LABEL.NOT_SUBMITTED, text: "Pour envoyer de l'argent, virer ou retirer, envoyez une pièce d'identité et un selfie. Cela prend 2 minutes.", cta: "Vérifier mon identité" };
  }
}

/** Identité vérifiée mais pièce qui expire dans moins de 30 jours : on prévient avant que les opérations ne soient bloquées. */
export function kycExpiringLook(expiry: KycExpiryView): Look {
  const d = expiry.daysLeft;
  return {
    icon: "hourglass",
    tone: d <= 7 ? "danger" : "warn",
    title: d <= 7 ? `Pièce expirée dans ${d} jour${d > 1 ? "s" : ""}` : "Pièce bientôt expirée",
    text: `Votre ${expiry.label.toLowerCase()} est valable jusqu'au ${formatDay(expiry.expiryDate)}. Envoyez-en une nouvelle pour ne pas être bloqué.`,
    cta: "Renouveler ma pièce",
  };
}

export function KycStatusCard({
  status, compact, onPress, hasRejection, expiry,
}: { status: KycOverall; compact?: boolean; onPress: () => void; hasRejection?: boolean; expiry?: KycExpiryView | null }) {
  const { C, R } = useUI();
  const expiring = status === "VERIFIED" && expiry && !expiry.expired ? expiry : null;
  const look = expiring ? kycExpiringLook(expiring) : kycLook(status, hasRejection);
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }).start();
  }, [enter]);

  useEffect(() => {
    if (status !== "PENDING") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const palette = {
    warn: { bg: C.warnBg, line: C.warnLine, fg: C.warn },
    danger: { bg: C.dangerBg, line: C.dangerLine, fg: C.danger },
    info: { bg: C.infoBg, line: C.infoLine, fg: C.info },
    pos: { bg: C.posBg, line: "#BFE5CD", fg: C.pos },
  }[look.tone];

  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${look.title}. ${look.cta}`}
        style={({ pressed }) => ({
          backgroundColor: palette.bg,
          borderColor: palette.line,
          borderWidth: 1,
          borderRadius: R.lg,
          padding: compact ? 14 : 18,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: compact ? 44 : 56, height: compact ? 44 : 56, alignItems: "center", justifyContent: "center" }}>
            {status === "PENDING" ? (
              <Animated.View
                style={{ position: "absolute", width: "100%", height: "100%", borderRadius: 99, backgroundColor: palette.fg, opacity: ringOpacity, transform: [{ scale: ring }] }}
              />
            ) : null}
            <View style={{ width: compact ? 44 : 56, height: compact ? 44 : 56, borderRadius: 99, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={look.icon as any} size={compact ? 22 : 28} color={palette.fg} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v={compact ? "subheading" : "heading"} color={palette.fg} numberOfLines={2}>{look.title}</UText>
            <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{look.text}</UText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.fg} />
        </View>
        {compact && (status !== "VERIFIED" || expiring) ? (
          <View style={{ marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 14, height: 34, borderRadius: R.pill, backgroundColor: palette.fg, alignItems: "center", justifyContent: "center" }}>
            <UText v="caption" color="#FFFFFF" style={{ fontWeight: "700" }}>{look.cta}</UText>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
