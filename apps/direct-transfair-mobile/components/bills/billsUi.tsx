// apps/direct-transfair-mobile/components/bills/billsUi.tsx
// =========================================================
// PAIEMENT DE FACTURES (lot 14) — briques communes : icône et nom de catégorie, pastille de statut, ligne de facturier,
// carte « facture enregistrée », ligne de paiement. Cartes animées (apparition en cascade), thème clair / sombre.
// =========================================================

import React from "react";
import { View } from "react-native";
import { Ionicons } from "../ui/Icon";
import { Card, Pill, UText, useUI } from "../ui";
import { Rise, money, shortDateTime } from "../merchant/merchantUi";
import { useT } from "../../providers/I18nProvider";
import { tr } from "../../i18n/runtime";
import type { MessageKey } from "../../i18n/catalog";
import { CATALOG } from "../../i18n/catalog";
import type { BillerView, BillPaymentStatus, BillPaymentView, SavedBillView } from "../../services/billTypes";

const CATEGORY_ICON: Record<string, string> = {
  ELECTRICITY: "flash-outline",
  WATER: "water-outline",
  GAS: "flame-outline",
  INTERNET_TV: "wifi-outline",
  TELECOM: "call-outline",
  INSURANCE_AUTO: "car-outline",
  INSURANCE_MOTO: "bicycle-outline",
  INSURANCE_HOME: "home-outline",
  INSURANCE_HEALTH: "medkit-outline",
  SCHOOL_FEES: "school-outline",
  UNIVERSITY_FEES: "library-outline",
  RENT: "key-outline",
  TAXES: "document-text-outline",
  HEALTH: "heart-outline",
  TRANSPORT: "bus-outline",
  OTHER: "receipt-outline",
};

export const categoryIcon = (category: string): string => CATEGORY_ICON[category] ?? "receipt-outline";

/** Nom traduit d'une catégorie ; une catégorie inventée par la société s'affiche lisiblement (« FRAIS_SCOLAIRES » → « Frais scolaires »). */
export function billCategoryLabel(category: string): string {
  const key = `bill.cat.${category}` as MessageKey;
  if (key in CATALOG) return tr(key);
  const nice = category.toLowerCase().replace(/_/g, " ");
  return nice.charAt(0).toUpperCase() + nice.slice(1);
}

export const STATUS_TONE: Record<BillPaymentStatus, "warn" | "info" | "pos" | "danger"> = {
  SUBMITTED: "warn", PROCESSING: "info", COMPLETED: "pos", REFUNDED: "danger",
};

export function BillStatusPill({ status }: { status: BillPaymentStatus }) {
  const t = useT();
  return <Pill label={t(`bill.st.${status}` as MessageKey)} tone={STATUS_TONE[status]} />;
}

export function CategoryBadge({ category, size = 48 }: { category: string; size?: number }) {
  const { C } = useUI();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.4, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={categoryIcon(category) as any} size={size * 0.46} color={C.accentDeep} />
    </View>
  );
}

/** Tuile d'une catégorie (grille de l'accueil des factures). */
export function CategoryTile({ category, count, onPress, delay = 0 }: { category: string; count: number; onPress: () => void; delay?: number }) {
  return (
    <Rise delay={delay}>
      <Card onPress={onPress} pad={14} style={{ alignItems: "center", gap: 8, minHeight: 112, justifyContent: "center" }}>
        <CategoryBadge category={category} size={46} />
        <UText v="caption" align="center" numberOfLines={2} style={{ fontWeight: "700" }}>{billCategoryLabel(category)}</UText>
        <UText v="caption" tone="muted">{count}</UText>
      </Card>
    </Rise>
  );
}

export function BillerRow({ biller, onPress, delay = 0 }: { biller: BillerView; onPress: () => void; delay?: number }) {
  const t = useT();
  const { C } = useUI();
  return (
    <Rise delay={delay}>
      <Card onPress={onPress} pad={16} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <CategoryBadge category={biller.category} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <UText v="bodyStrong" numberOfLines={1}>{biller.name}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{billCategoryLabel(biller.category)}{biller.country ? ` · ${biller.country}` : ""}</UText>
          </View>
          {biller.simulated ? <Pill label="TEST" tone="warn" /> : <Ionicons name={"chevron-forward" as any} size={18} color={C.faint} />}
        </View>
        {!!biller.description && <UText v="caption" tone="muted" numberOfLines={2} style={{ marginTop: 8 }}>{biller.description}</UText>}
        {biller.simulated ? <UText v="caption" tone="muted" style={{ marginTop: 6 }}>{t("bill.simulated")}</UText> : null}
      </Card>
    </Rise>
  );
}

export function SavedBillCard({ saved, onPay, onRemove, delay = 0 }: { saved: SavedBillView; onPay: () => void; onRemove: () => void; delay?: number }) {
  const t = useT();
  const { C } = useUI();
  return (
    <Rise delay={delay}>
      <Card onPress={saved.available ? onPay : undefined} pad={16} style={{ width: 230, marginRight: 12, opacity: saved.available ? 1 : 0.55 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <CategoryBadge category={saved.biller.category} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="bodyStrong" numberOfLines={1}>{saved.label}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{saved.biller.name}</UText>
          </View>
        </View>
        <UText v="caption" tone="muted" numberOfLines={1} style={{ marginTop: 10 }}>
          {saved.accountRef}{saved.customerName ? ` · ${saved.customerName}` : ""}
        </UText>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <UText v="caption" color={C.accent} style={{ fontWeight: "800" }}>{saved.available ? t("bill.payShort") : t("bill.unavailable")}</UText>
          <UText v="caption" tone="muted" onPress={onRemove} style={{ textDecorationLine: "underline" }}>{t("bill.removeSaved")}</UText>
        </View>
      </Card>
    </Rise>
  );
}

export function BillPaymentRow({ p, onPress, delay = 0 }: { p: BillPaymentView; onPress: () => void; delay?: number }) {
  return (
    <Rise delay={delay}>
      <Card onPress={onPress} pad={16} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <CategoryBadge category={p.biller.category} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <UText v="bodyStrong" numberOfLines={1}>{p.biller.name}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{shortDateTime(p.createdAt)} · {p.accountRef}</UText>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <UText v="bodyStrong" style={p.status === "REFUNDED" ? { textDecorationLine: "line-through" } : undefined}>−{money(p.amount, p.currency)}</UText>
            <BillStatusPill status={p.status} />
          </View>
        </View>
      </Card>
    </Rise>
  );
}
