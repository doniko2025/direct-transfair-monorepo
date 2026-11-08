// apps/direct-transfair-mobile/app/cashier/index.tsx
// =========================================================
// CAISSE (CAISSIER) v1.0 — Lot 13
// Espace d'une personne ajoutée comme caissier d'un ou plusieurs commerces. Elle reste en « Compte client » : son portefeuille
// n'est pas touché. Elle encaisse au nom du commerce (QR à usage unique, demande par téléphone), affiche le QR de caisse
// permanent et suit SES encaissements du jour. Elle ne voit ni le solde du commerce, ni les retraits, ni les autres caissiers.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import type { StaffDay, StaffMembership } from "../../services/merchantTypes";
import { useLoader } from "../../components/wallet/useLoader";
import { Button, Card, EmptyView, ErrorView, NavBar, Notice, Pill, Screen, SkeletonRows, UText } from "../../components/ui";
import { Rise, money } from "../../components/merchant/merchantUi";
import { ShopAvatar } from "../../components/merchant/ShopAvatar";

type Row = StaffMembership & { day: StaffDay | null };

function ShopCard({ m, onGo }: { m: Row; onGo: (path: string) => void }) {
  const total = m.day?.totals.find((t) => t.currency === m.currency);
  return (
    <Card pad={18} style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ShopAvatar shopId={m.shopId} version={m.logoVersion} name={m.businessName} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="subheading" numberOfLines={1}>{m.businessName}</UText>
          {!!m.city && <UText v="caption" tone="muted" numberOfLines={1}>{m.city}</UText>}
        </View>
        {!m.available && <Pill label="Indisponible" tone="warn" />}
      </View>

      <View style={{ marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.04)" }}>
        <UText v="caption" tone="muted">Mes encaissements aujourd'hui</UText>
        <UText v="title">{money(total?.gross ?? 0, m.currency)}</UText>
        <UText v="caption" tone="muted">{total?.count ?? 0} paiement(s){m.maxAmount ? ` · plafond ${money(m.maxAmount, m.currency)}` : ""}{m.canRefund ? " · remboursements autorisés" : ""}</UText>
      </View>

      {m.available ? (
        <View style={{ gap: 10, marginTop: 14 }}>
          <Button label="Encaisser" icon="qr-code-outline" onPress={() => onGo(`/merchant/collect?merchantId=${encodeURIComponent(m.shopId)}`)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button label="QR de caisse" icon="scan-outline" kind="outline" small onPress={() => onGo(`/merchant/qr?merchantId=${encodeURIComponent(m.shopId)}`)} /></View>
            <View style={{ flex: 1 }}><Button label="Mes paiements" icon="receipt-outline" kind="outline" small onPress={() => onGo(`/merchant/payments?merchantId=${encodeURIComponent(m.shopId)}`)} /></View>
          </View>
        </View>
      ) : (
        <Notice tone="warn" style={{ marginTop: 14 }}>Ce commerce ne peut pas encaisser pour le moment.</Notice>
      )}
    </Card>
  );
}

export default function CashierHome() {
  const router = useRouter();
  const load = useCallback(async (): Promise<Row[]> => {
    const list = await api.getStaffMemberships();
    return Promise.all(list.map(async (m) => ({ ...m, day: await api.getStaffDay(m.shopId).catch(() => null) })));
  }, []);
  const { data, status, error, reload, refreshing, refresh } = useLoader(load);
  const go = (path: string) => router.push(path as any);
  const header = <NavBar onBack={() => router.back()} title="Caisse" subtitle="Encaisser pour un commerce" />;

  if (status === "loading") return <Screen header={header}><SkeletonRows rows={3} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={header}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={refresh}>
      {data.length === 0 ? (
        <EmptyView icon="storefront-outline" title="Aucun commerce" message="Vous n'êtes caissier d'aucun commerce. Le propriétaire peut vous ajouter depuis « Équipe de caisse » avec votre numéro de téléphone." />
      ) : (
        data.map((m, i) => <Rise key={m.shopId} delay={i * 60}><ShopCard m={m} onGo={go} /></Rise>)
      )}
    </Screen>
  );
}
