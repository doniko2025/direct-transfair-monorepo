// apps/direct-transfair-mobile/components/home/GrowthCards.tsx
// =========================================================
// RACCOURCIS DE L'ACCUEIL CLIENT v2.0 (design E) — quatre pastilles rondes : Recharger · Demander · Parrainer · Factures.
// ✅ v2.0 : les deux grandes cartes du lot 16 deviennent des raccourcis ronds (même données, mêmes destinations) :
//    « Demander » garde sa pastille du nombre de demandes à régler, « Parrainer » celle des envois sans frais disponibles,
//    « Factures » n'apparaît que si la société a ouvert le paiement de factures (billsOpen), « Recharger » remplace le gros
//    bouton de l'accueil. Chargement silencieux : une panne n'affiche rien de cassé, les pastilles restent simplement sans badge.
// (lot 16) « Demander de l'argent » (avec le nombre de demandes à régler) et « Parrainer un ami » (avec les envois sans frais).
// =========================================================

import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { useMyReferral } from "../../hooks/useMyReferral";
import { Rise } from "../merchant/merchantUi";
import { useUI } from "../ui";
import { Text } from "../ui/Text";
import { Ionicons } from "../ui/Icon";

function Shortcut({ icon, label, badge, a11y, onPress, testID }: { icon: string; label: string; badge?: string; a11y?: string; onPress: () => void; testID?: string }) {
  const { C } = useUI();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as any} size={21} color={C.ink} />
        {!!badge && (
          <View style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.sun, borderWidth: 2, borderColor: C.surface, alignItems: "center", justifyContent: "center" }}>
            <Text allowFontScaling={false} numberOfLines={1} style={{ fontSize: 10, lineHeight: 13, fontWeight: "800", color: C.sunInk, includeFontPadding: false }}>{badge}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, fontWeight: "600", color: C.ink }}>{label}</Text>
    </Pressable>
  );
}

export default function GrowthCards({ billsOpen, onTopup }: { billsOpen?: boolean; onTopup: () => void }) {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const referral = useMyReferral(user?.id);
  const [toPay, setToPay] = useState(0);

  useFocusEffect(useCallback(() => {
    let alive = true;
    api.getMoneyRequests().then((r) => { if (alive) setToPay(r.pendingToPay); }).catch(() => undefined);
    return () => { alive = false; };
  }, []));

  const left = referral.data?.freeTransfersLeft ?? 0;
  return (
    <Rise delay={140}>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Shortcut icon="add" label={t("home.sc.topup")} onPress={onTopup} testID="home-topup" />
        <Shortcut
          icon="cash-outline"
          label={t("home.sc.request")}
          badge={toPay > 0 ? String(toPay) : undefined}
          a11y={toPay > 0 ? `${t("grw.mr.entry")} — ${t("grw.mr.entryPending", { count: toPay })}` : t("grw.mr.entry")}
          onPress={() => router.push("/money-requests" as any)}
        />
        <Shortcut
          icon="gift-outline"
          label={t("home.sc.refer")}
          badge={left > 0 ? String(left) : undefined}
          a11y={left > 0 ? `${t("grw.ref.entry")} — ${t("grw.ref.entryLeft", { count: left })}` : t("grw.ref.entry")}
          onPress={() => router.push("/referral" as any)}
        />
        {billsOpen ? <Shortcut icon="receipt-outline" label={t("home.sc.bills")} a11y={t("bill.homeTitle")} onPress={() => router.push("/bills" as any)} /> : null}
      </View>
    </Rise>
  );
}
