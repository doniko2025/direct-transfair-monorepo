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
import { KYC_DOC_LABEL, KYC_STATUS_LABEL, formatDay, type KycExpiryView, type KycOverall } from "../../services/kyc";
import { tr } from "../../i18n/runtime";

type Look = { icon: string; tone: "warn" | "danger" | "info" | "pos"; title: string; text: string; cta: string };

export function kycLook(status: KycOverall, hasRejection = false): Look {
  switch (status) {
    case "VERIFIED":
      return { icon: "shield-checkmark", tone: "pos", title: KYC_STATUS_LABEL.VERIFIED, text: tr("kcard.verifiedText"), cta: tr("kcard.verifiedCta") };
    case "PENDING":
      return { icon: "time", tone: "info", title: KYC_STATUS_LABEL.PENDING, text: tr("kcard.pendingText"), cta: tr("kcard.pendingCta") };
    case "PARTIAL":
      return { icon: "shield-half", tone: "warn", title: KYC_STATUS_LABEL.PARTIAL, text: tr("kcard.partialText"), cta: tr("kcard.partialCta") };
    case "REJECTED":
      return { icon: "close-circle", tone: "danger", title: KYC_STATUS_LABEL.REJECTED, text: hasRejection ? tr("kcard.rejectedText1") : tr("kcard.rejectedText2"), cta: tr("kcard.rejectedCta") };
    case "EXPIRED":
      return { icon: "alert-circle", tone: "danger", title: KYC_STATUS_LABEL.EXPIRED, text: tr("kcard.expiredText"), cta: tr("kcard.expiredCta") };
    default:
      return { icon: "id-card", tone: "warn", title: KYC_STATUS_LABEL.NOT_SUBMITTED, text: tr("kcard.newText"), cta: tr("kcard.newCta") };
  }
}

/** Identité vérifiée mais pièce qui expire dans moins de 30 jours : on prévient avant que les opérations ne soient bloquées. */
export function kycExpiringLook(expiry: KycExpiryView): Look {
  const d = expiry.daysLeft;
  return {
    icon: "hourglass",
    tone: d <= 7 ? "danger" : "warn",
    title: d <= 7 ? tr("kcard.expDays", { count: d }) : tr("kcard.expSoon"),
    text: tr("kcard.expText", { doc: (KYC_DOC_LABEL[expiry.type] ?? expiry.label).toLowerCase(), date: formatDay(expiry.expiryDate) }),
    cta: tr("kcard.expCta"),
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
