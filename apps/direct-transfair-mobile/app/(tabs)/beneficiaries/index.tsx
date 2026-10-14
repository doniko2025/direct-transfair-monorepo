// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
// =========================================================
// BENEFICIARIES v7.0 — Direct Transf'air
// ✅ v7.0 : 🔥 REFONTE TOTALE de l'écran « Contacts » + correction du chargement infini.
//    • Design : en-tête de marque avec recherche, contacts groupés par lettre dans des cartes, avatar à
//      initiales, lieu + téléphone, bouton d'envoi direct, bouton flottant « Nouveau contact ».
//    • Chargement : useLoader() borne l'attente (20 s) : squelettes, puis erreur claire avec « Réessayer ».
//      Un échec n'affiche plus « aucun contact » à la place d'une vraie erreur.
//    • Logique conservée : tri par nom, recherche (nom, téléphone, pays), regroupement alphabétique,
//      navigation vers la fiche, la création et l'envoi (/(tabs)/send?beneficiaryId=…).
// ✅ v6.3 : HERO — dégradé sombre identique à ClientDashboard
//    PUREMENT PRÉSENTATIONNEL — aucune ligne de logique métier touchée
//    (load, filtrage, groupage alphabétique : tout identique).
//    - Hero blanc neutre → LinearGradient sombre (#0A0F0D → #123324),
//      mêmes teintes que ClientDashboard.
//    - Titre, compteur, sous-titre, barre de recherche, bouton "+" du
//      hero : recolorés en blanc/"verre" pour rester lisibles sur fond
//      sombre. Le bouton "+" devient glass (comme les boutons d'icône
//      des autres heroes) — le FAB flottant en bas à droite (inchangé)
//      reste l'action principale "ajouter un contact".
//    - SafeAreaView passe en fond sombre ; le loader et la liste (sous
//      le hero) reçoivent un fond clair explicite (C.pageBg) pour ne
//      pas hériter du sombre du parent.
//    - useSafeAreaInsets (nouveau) remplace le paddingTop conditionnel
//      Platform.OS.
// ✅ v6.0 : UI compacte, groupage alphabétique, badge compteur
// ✅ v6.1 : fond blanc neutre #FAFAFA, ombres neutres
// ✅ v6.2 : Héro blanc neutre — plus de fond vert
// =========================================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../services/api";
import ScreenHeader, { HeaderIconButton } from "../../../components/wallet/ScreenHeader";
import { Avatar, Card, SearchBar } from "../../../components/wallet/WalletParts";
import { SkeletonList } from "../../../components/wallet/Skeleton";
import { EmptyState, ErrorState, SlowHint } from "../../../components/wallet/StateViews";
import { useLoader } from "../../../components/wallet/useLoader";
import { FONT, N, RADIUS, SHADOW, TAB_BAR_SPACE, useWalletTheme } from "../../../components/wallet/walletTheme";

type Group = { letter: string; items: any[] };

function ContactRow({ item, last }: { item: any; last: boolean }) {
  const router = useRouter();
  const { P } = useWalletTheme();
  const place = [item.city, item.country].filter(Boolean).join(", ");
  return (
    <TouchableOpacity
      style={[s.row, !last && s.divider]}
      activeOpacity={0.7}
      onPress={() => router.push(`/(tabs)/beneficiaries/${item.id}`)}
    >
      <Avatar name={item.fullName || "?"} size={46} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={1}>{item.fullName}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {[place, item.phone].filter(Boolean).join(" · ") || "Aucune information"}
        </Text>
      </View>
      <TouchableOpacity
        style={[s.sendBtn, { backgroundColor: P.tint, borderColor: P.tintBorder }]}
        onPress={() => router.push({ pathname: "/(tabs)/send", params: { beneficiaryId: item.id } })}
        hitSlop={8}
        accessibilityLabel={`Envoyer de l'argent à ${item.fullName}`}
      >
        <Ionicons name="paper-plane" size={16} color={P.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function BeneficiariesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { P } = useWalletTheme();
  const [q, setQ] = useState("");

  const { data, status, error, refreshing, slow, reload, refresh } = useLoader<any[]>(async () => {
    const res = await api.getBeneficiaries();
    const list = Array.isArray(res) ? res : [];
    return [...list].sort((a: any, b: any) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
  });
  const beneficiaries = data ?? [];

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase();
    if (!sq) return beneficiaries;
    return beneficiaries.filter((b) =>
      (b.fullName ?? "").toLowerCase().includes(sq) ||
      (b.phone ?? "").toLowerCase().includes(sq) ||
      (b.country ?? "").toLowerCase().includes(sq));
  }, [beneficiaries, q]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const b of filtered) {
      const letter = (b.fullName?.[0] ?? "#").toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(b);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([letter, items]) => ({ letter, items }));
  }, [filtered]);

  const goCreate = () => router.push("/(tabs)/beneficiaries/create");
  const count = beneficiaries.length;

  return (
    <View style={{ flex: 1, backgroundColor: N.page }}>
      <ScreenHeader
        title="Contacts"
        subtitle={status === "ready" ? `${count} bénéficiaire${count !== 1 ? "s" : ""} enregistré${count !== 1 ? "s" : ""}` : "Tes bénéficiaires"}
        right={<HeaderIconButton icon="person-add-outline" label="Ajouter un contact" onPress={goCreate} />}
      >
        <SearchBar value={q} onChangeText={setQ} placeholder="Nom, téléphone, pays…" />
      </ScreenHeader>

      {status === "loading" ? (
        <View style={s.pad}>
          <SlowHint visible={slow} />
          <Card><SkeletonList rows={6} /></Card>
        </View>
      ) : status === "error" ? (
        <ErrorState title={error?.title ?? "Chargement impossible"} message={error?.message ?? ""} onRetry={reload} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.letter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom + 72 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={P.accent} />}
          renderItem={({ item: g }) => (
            <View style={{ marginBottom: 16 }}>
              <Text style={s.letter}>{g.letter}</Text>
              <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
                {g.items.map((b, i) => <ContactRow key={b.id} item={b} last={i === g.items.length - 1} />)}
              </Card>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={q ? "Aucun résultat" : "Aucun contact"}
              message={q ? "Modifie ta recherche." : "Ajoute un proche pour lui envoyer de l'argent en quelques secondes."}
              actionLabel={q ? undefined : "Ajouter un contact"}
              onAction={goCreate}
            />
          }
        />
      )}

      {status === "ready" && count > 0 && (
        <TouchableOpacity
          style={[s.fab, SHADOW.button, { backgroundColor: P.action, bottom: TAB_BAR_SPACE - 18 + Math.max(insets.bottom - 16, 0) }]}
          onPress={goCreate}
          activeOpacity={0.9}
          accessibilityLabel="Ajouter un contact"
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={s.fabTxt}>Nouveau contact</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: 16, gap: 12 },
  list: { paddingHorizontal: 16, paddingTop: 18 },
  letter: { fontFamily: FONT.display, fontSize: 15, fontWeight: "700", color: N.muted, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#EEF2F0" },
  name: { fontFamily: FONT.medium, fontSize: 15, fontWeight: "700", color: N.ink },
  meta: { fontFamily: FONT.body, fontSize: 12.5, color: N.muted, marginTop: 3 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute", right: 18, height: 52, paddingHorizontal: 20, borderRadius: RADIUS.xl,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  fabTxt: { fontFamily: FONT.medium, fontSize: 14.5, fontWeight: "700", color: "#fff" },
});
