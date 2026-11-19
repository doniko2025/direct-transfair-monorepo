// apps/direct-transfair-mobile/components/home/GrowthCards.tsx
// =========================================================
// Accueil client (lot 16) : deux cartes d'accès — « Demander de l'argent » (avec le nombre de demandes à régler) et
// « Parrainer un ami » (avec les envois sans frais disponibles). Chargement silencieux : une panne n'affiche rien de cassé,
// les cartes restent simplement sans pastille.
// =========================================================

import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { useMyReferral } from "../../hooks/useMyReferral";
import { Rise } from "../merchant/merchantUi";
import { Card, UText, useUI } from "../ui";
import { Ionicons } from "../ui/Icon";

function Tile({ icon, title, sub, badge, onPress }: { icon: string; title: string; sub: string; badge?: string; onPress: () => void }) {
  const { C } = useUI();
  return (
    <Card tone="accent" pad={14} onPress={onPress} style={{ flex: 1, minWidth: 0, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon as any} size={21} color={C.accentDeep} />
        </View>
        {!!badge && (
          <View style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: C.warn, alignItems: "center", justifyContent: "center" }}>
            <UText v="label" color="#FFFFFF" numberOfLines={1}>{badge}</UText>
          </View>
        )}
      </View>
      <View>
        <UText v="bodyStrong" numberOfLines={2}>{title}</UText>
        <UText v="caption" tone="muted" numberOfLines={3} style={{ marginTop: 2 }}>{sub}</UText>
      </View>
    </Card>
  );
}

export default function GrowthCards() {
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
    <Rise delay={160}>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
        <Tile
          icon="cash-outline"
          title={t("grw.mr.entry")}
          sub={toPay > 0 ? t("grw.mr.entryPending", { count: toPay }) : t("grw.mr.entrySub")}
          badge={toPay > 0 ? String(toPay) : undefined}
          onPress={() => router.push("/money-requests" as any)}
        />
        <Tile
          icon="gift-outline"
          title={t("grw.ref.entry")}
          sub={left > 0 ? t("grw.ref.entryLeft", { count: left }) : t("grw.ref.entrySub")}
          onPress={() => router.push("/referral" as any)}
        />
      </View>
    </Rise>
  );
}
