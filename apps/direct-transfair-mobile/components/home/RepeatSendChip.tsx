// apps/direct-transfair-mobile/components/home/RepeatSendChip.tsx
// =========================================================
// « RENVOYER » EN UN GESTE (lot 19) — une seule ligne discrète sur l'accueil : « Renvoyer 50 000 GNF à Mariama ».
// Elle propose le DERNIER envoi réussi de l'utilisateur (même destinataire, même montant) ; l'appui ouvre l'écran d'envoi déjà rempli
// (modes et paramètres déjà gérés par send.tsx), le code secret reste demandé comme pour tout envoi. Rien ne s'affiche s'il n'y en a pas.
// Chargement silencieux : une panne n'affiche simplement rien.
// =========================================================

import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useT } from "../../providers/I18nProvider";
import { fmtMoney } from "../../utils/amount";
import { userCurrency } from "../../utils/currency";
import { Rise } from "../merchant/merchantUi";
import { UText, useUI } from "../ui";
import { Ionicons } from "../ui/Icon";

type Last = { cash: boolean; beneficiaryId?: string; phone?: string; name: string; amount: number; currency: string };

/** Dernier envoi de l'utilisateur qui a abouti et qu'on sait refaire (destinataire identifiable). */
function lastRepeatable(txs: any[], userId?: string): Last | null {
  const sorted = [...txs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const tx of sorted) {
    const type = String(tx.type ?? "").toUpperCase();
    if ((type !== "TRANSFER" && type !== "SCHEDULED") || tx.senderId !== userId) continue;
    if (!["PAID", "VALIDATED", "PENDING"].includes(String(tx.status))) continue;
    const cash = String(tx.payoutMethod ?? "").toUpperCase() === "CASH_PICKUP";
    const benId = tx.beneficiaryId ?? tx.beneficiary?.id;
    const phone = tx.beneficiary?.phone;
    const name = String(tx.beneficiary?.fullName ?? "").split(" ")[0];
    if (!name || (cash ? !benId : !phone)) continue;
    return { cash, beneficiaryId: benId ? String(benId) : undefined, phone, name, amount: Number(tx.amount), currency: String(tx.currency) };
  }
  return null;
}

export default function RepeatSendChip() {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const [last, setLast] = useState<Last | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    api.getTransactions({ limit: 20, space: "client" } as any)
      .then((txs: any) => { if (alive) setLast(lastRepeatable(Array.isArray(txs) ? txs : [], user?.id)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [user?.id]));

  if (!last || !(last.amount > 0)) return null;
  const sameCurrency = last.currency === userCurrency(user);
  const go = () => router.push({
    pathname: "/(tabs)/send",
    params: {
      mode: last.cash ? "CASH" : "WALLET",
      ...(last.cash ? { beneficiaryId: last.beneficiaryId } : { phone: last.phone }),
      ...(sameCurrency ? { amount: String(last.amount) } : {}),
    },
  } as any);

  return (
    <Rise>
      <Pressable
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel={t("rep.chip", { amount: `${fmtMoney(last.amount, last.currency)} ${last.currency}`, name: last.name })}
        style={({ pressed }) => ({ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.beige, opacity: pressed ? 0.8 : 1 })}
      >
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={"refresh-outline" as any} size={16} color={C.accentInk} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="bodyStrong" numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 18 }}>{t("rep.chip", { amount: `${fmtMoney(last.amount, last.currency)} ${last.currency}`, name: last.name })}</UText>
          <UText v="caption" tone="muted" numberOfLines={1} style={{ fontSize: 11.5, lineHeight: 15 }}>{t("rep.chipSub")}</UText>
        </View>
        <Ionicons name={"chevron-forward" as any} size={16} color={C.muted} />
      </Pressable>
    </Rise>
  );
}
