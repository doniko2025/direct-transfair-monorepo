// apps/direct-transfair-mobile/components/bills/billsUi.tsx
// =========================================================
// ✅ v1.1 : héro en carte blanche ombrée (plus de bleu) ; « Factures programmées » en vert léger ; palette des catégories sans bleu / indigo / violet.
// PAIEMENT DE FACTURES (lot 14) — briques communes : icône et nom de catégorie, pastille de statut, ligne de facturier,
// carte « facture enregistrée », ligne de paiement. Cartes animées (apparition en cascade), thème clair / sombre.
// =========================================================

import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "../ui/Icon";
import { Pill, UText, useUI } from "../ui";
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

// ── Identité de couleur par catégorie (teinte vive, lisible en thème clair comme sombre : on n'utilise que des transparences) ──
const CATEGORY_HUE: Record<string, string> = {
  ELECTRICITY: "#F59E0B", WATER: "#14B8A6", GAS: "#F97316", INTERNET_TV: "#0D9488", TELECOM: "#14B8A6",
  INSURANCE_AUTO: "#22A06B", INSURANCE_MOTO: "#16A34A", INSURANCE_HOME: "#22A06B", INSURANCE_HEALTH: "#EC4899",
  SCHOOL_FEES: "#22C55E", UNIVERSITY_FEES: "#16A34A", RENT: "#E11D74", TAXES: "#64748B", HEALTH: "#EF4444",
  TRANSPORT: "#0D9488", OTHER: "#94A3B8",
};
const FALLBACK_HUES = ["#22A06B", "#14B8A6", "#F59E0B", "#EC4899", "#0D9488", "#22C55E", "#F97316", "#16A34A"];

/** Teinte d'une catégorie ; une catégorie inventée par la société reçoit toujours la même couleur (calculée sur son nom). */
export function categoryHue(category: string): string {
  if (CATEGORY_HUE[category]) return CATEGORY_HUE[category];
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
  return FALLBACK_HUES[h % FALLBACK_HUES.length];
}

export { alpha, shade, TintCard } from "../ui/Tint";
import { alpha, shade, TintCard } from "../ui/Tint";

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
  const hue = categoryHue(category);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, overflow: "hidden", alignItems: "center", justifyContent: "center", shadowColor: hue, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
      <LinearGradient colors={[hue, shade(hue, 0.28)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Ionicons name={categoryIcon(category) as any} size={size * 0.48} color="#FFFFFF" />
    </View>
  );
}

/** Tuile d'une catégorie (grille de l'accueil des factures). `wide` : pleine largeur, icône à gauche (une seule catégorie, ou dernière tuile impaire). */
export function CategoryTile({ category, count, onPress, delay = 0, wide }: { category: string; count: number; onPress: () => void; delay?: number; wide?: boolean }) {
  const t = useT();
  const { C } = useUI();
  const hue = categoryHue(category);
  const countLabel = t("bill.billersCount", { n: String(count) });
  return (
    <Rise delay={delay}>
      <TintCard hue={hue} mark={categoryIcon(category)} onPress={onPress} pad={wide ? 18 : 16}>
        {wide ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <CategoryBadge category={category} size={60} />
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <UText v="subheading" numberOfLines={2}>{billCategoryLabel(category)}</UText>
              <View style={{ alignSelf: "flex-start", backgroundColor: alpha(hue, 0.16), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <UText v="caption" color={C.text} style={{ fontWeight: "700" }}>{countLabel}</UText>
              </View>
            </View>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: alpha(hue, 0.18), alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={"arrow-forward" as any} size={17} color={C.text} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12, minHeight: 124, justifyContent: "space-between" }}>
            <CategoryBadge category={category} size={52} />
            <View style={{ gap: 6 }}>
              <UText v="bodyStrong" numberOfLines={2} style={{ fontWeight: "800" }}>{billCategoryLabel(category)}</UText>
              <View style={{ alignSelf: "flex-start", backgroundColor: alpha(hue, 0.16), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <UText v="caption" color={C.text} style={{ fontWeight: "700" }}>{countLabel}</UText>
              </View>
            </View>
          </View>
        )}
      </TintCard>
    </Rise>
  );
}

/** Bandeau d'accueil des factures : carte BLANCHE ombrée (couleur de l'app pour l'icône et les pastilles, aucun bleu). */
export function BillsHero() {
  const t = useT();
  const { C, S } = useUI();
  return (
    <Rise>
      <View style={[{ borderRadius: 24, overflow: "hidden", marginTop: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }, S.md]}>
        <View pointerEvents="none" style={{ position: "absolute", right: -14, top: -16, transform: [{ rotate: "12deg" }] }}>
          <Ionicons name={"receipt-outline" as any} size={130} color={alpha(C.accent, 0.07)} />
        </View>
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={"flash-outline" as any} size={20} color={C.accentDeep} />
          </View>
          <UText v="subheading" style={{ fontWeight: "800", fontSize: 17, lineHeight: 22 }}>{t("bill.categories")}</UText>
          <UText v="caption" tone="muted" style={{ fontSize: 12.5, lineHeight: 18 }}>{t("bill.heroSub")}</UText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
            {([["flash-outline", "bill.heroChipInstant"], ["shield-checkmark-outline", "bill.heroChipRefund"]] as const).map(([icon, key]) => (
              <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Ionicons name={icon as any} size={13} color={C.accentDeep} />
                <UText v="caption" color={C.accentDeep} style={{ fontWeight: "700", fontSize: 12 }}>{t(key)}</UText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Rise>
  );
}

/** Entrée « Factures programmées » : carte teintée VERT léger (le texte n'est plus tronqué). */
export function ScheduleEntryCard({ title, subtitle, onPress, delay = 0 }: { title: string; subtitle: string; onPress: () => void; delay?: number }) {
  const { C } = useUI();
  const hue = "#22A06B";
  return (
    <Rise delay={delay}>
      <TintCard hue={hue} mark="calendar-outline" onPress={onPress} pad={16} style={{ marginTop: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            <LinearGradient colors={[hue, shade(hue, 0.3)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Ionicons name={"calendar-outline" as any} size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <UText v="bodyStrong" style={{ fontWeight: "800" }}>{title}</UText>
            <UText v="caption" tone="muted">{subtitle}</UText>
          </View>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: alpha(hue, 0.18), alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={"chevron-forward" as any} size={17} color={C.text} />
          </View>
        </View>
      </TintCard>
    </Rise>
  );
}

/** « Derniers paiements » quand il n'y en a pas encore : une vraie carte, pas une simple ligne de texte. */
export function EmptyPayments() {
  const t = useT();
  const { C } = useUI();
  return (
    <Rise delay={80}>
      <View style={{ borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.lineStrong, padding: 22, alignItems: "center", gap: 8 }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.field, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={"receipt-outline" as any} size={26} color={C.muted} />
        </View>
        <UText v="bodyStrong" align="center">{t("bill.none")}</UText>
        <UText v="caption" tone="muted" align="center">{t("bill.noneHint")}</UText>
      </View>
    </Rise>
  );
}

export function BillerRow({ biller, onPress, delay = 0 }: { biller: BillerView; onPress: () => void; delay?: number }) {
  const t = useT();
  const { C } = useUI();
  const hue = categoryHue(biller.category);
  return (
    <Rise delay={delay}>
      <TintCard hue={hue} mark={categoryIcon(biller.category)} onPress={onPress} pad={16} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <CategoryBadge category={biller.category} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <UText v="bodyStrong" numberOfLines={1} style={{ fontWeight: "800" }}>{biller.name}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{billCategoryLabel(biller.category)}{biller.country ? ` · ${biller.country}` : ""}</UText>
          </View>
          {biller.simulated ? <Pill label="TEST" tone="warn" /> : (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: alpha(hue, 0.18), alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={"chevron-forward" as any} size={16} color={C.text} />
            </View>
          )}
        </View>
        {!!biller.description && <UText v="caption" tone="muted" numberOfLines={2} style={{ marginTop: 10 }}>{biller.description}</UText>}
        {biller.simulated ? <UText v="caption" tone="muted" style={{ marginTop: 6 }}>{t("bill.simulated")}</UText> : null}
      </TintCard>
    </Rise>
  );
}

export function SavedBillCard({ saved, onPay, onRemove, delay = 0 }: { saved: SavedBillView; onPay: () => void; onRemove: () => void; delay?: number }) {
  const t = useT();
  const hue = categoryHue(saved.biller.category);
  return (
    <Rise delay={delay}>
      <TintCard hue={hue} mark={categoryIcon(saved.biller.category)} onPress={saved.available ? onPay : undefined} pad={16} dim={!saved.available} style={{ width: 236, marginRight: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <CategoryBadge category={saved.biller.category} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <UText v="bodyStrong" numberOfLines={1} style={{ fontWeight: "800" }}>{saved.label}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{saved.biller.name}</UText>
          </View>
        </View>
        <UText v="caption" tone="muted" numberOfLines={1} style={{ marginTop: 12 }}>
          {saved.accountRef}{saved.customerName ? ` · ${saved.customerName}` : ""}
        </UText>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <View style={{ backgroundColor: saved.available ? hue : alpha(hue, 0.3), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <UText v="caption" color="#FFFFFF" style={{ fontWeight: "800" }}>{saved.available ? t("bill.payShort") : t("bill.unavailable")}</UText>
          </View>
          <UText v="caption" tone="muted" onPress={onRemove} style={{ textDecorationLine: "underline" }}>{t("bill.removeSaved")}</UText>
        </View>
      </TintCard>
    </Rise>
  );
}

export function BillPaymentRow({ p, onPress, delay = 0 }: { p: BillPaymentView; onPress: () => void; delay?: number }) {
  const hue = categoryHue(p.biller.category);
  return (
    <Rise delay={delay}>
      <TintCard hue={hue} onPress={onPress} pad={14} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <CategoryBadge category={p.biller.category} size={46} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <UText v="bodyStrong" numberOfLines={1} style={{ fontWeight: "800" }}>{p.biller.name}</UText>
            <UText v="caption" tone="muted" numberOfLines={1}>{shortDateTime(p.createdAt)} · {p.accountRef}</UText>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <UText v="bodyStrong" style={[{ fontWeight: "800" }, p.status === "REFUNDED" ? { textDecorationLine: "line-through" } : null] as any}>−{money(p.amount, p.currency)}</UText>
            <BillStatusPill status={p.status} />
          </View>
        </View>
      </TintCard>
    </Rise>
  );
}
