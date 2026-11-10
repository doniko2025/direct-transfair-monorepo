// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
// =========================================================
// BENEFICIARIES v8.0 — Direct Transf'air
// ✅ v8.0 : 🔥 REFONTE TOTALE en thème clair : gros titre « Contacts », recherche en pilule, contacts
//    groupés par lettre en lignes à filets (avatar beige, lieu · téléphone, bouton d'envoi direct),
//    bouton « Nouveau contact » en pilule à la couleur d'accent de la société. Design system components/ui.
//    Logique INCHANGÉE : getBeneficiaries en chargement borné (useLoader 20 s), tri par nom, recherche
//    (nom, téléphone, pays), regroupement alphabétique, navigation fiche / création / envoi.
// ✅ v7.0 : refonte « wallet » + chargement borné.
// ✅ v6.x : historique (groupage alphabétique, hero sombre, fonds neutres) — remplacé.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../services/api";
import { useLoader } from "../../../components/wallet/useLoader";
import { useT } from "../../../providers/I18nProvider";
import { localizeCountry } from "../../../utils/countryNames";
import {
  Avatar, Button, EmptyView, ErrorView, IconButton, ListRow, PageTitle, Screen, SearchPill, SkeletonRows, SlowNote, UText,
} from "../../../components/ui";

type Group = { letter: string; items: any[] };

export default function BeneficiariesScreen() {
  const router = useRouter();
  const t = useT();
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
    <Screen tabSpace refreshing={refreshing} onRefresh={refresh}>
      <PageTitle
        title={t("bn.title")}
        subtitle={status === "ready" ? t("bn.count", { count }) : t("bn.sub")}
        right={<IconButton icon="person-add-outline" label={t("bn.add")} onPress={goCreate} />}
      />
      <SearchPill value={q} onChangeText={setQ} placeholder={t("bn.search")} />

      <SlowNote visible={slow && status === "loading"} />

      {status === "loading" ? (
        <View style={{ marginTop: 12 }}><SkeletonRows rows={6} /></View>
      ) : status === "error" ? (
        <ErrorView title={error?.title ?? t("tx.loadFail")} message={error?.message ?? ""} onRetry={reload} />
      ) : groups.length === 0 ? (
        <EmptyView
          icon="people-outline"
          title={q ? t("bn.noResult") : t("bn.none")}
          message={q ? t("bn.adjust") : t("bn.emptyMsg")}
          actionLabel={q ? undefined : t("bn.add")}
          onAction={goCreate}
        />
      ) : (
        groups.map((g) => (
          <View key={g.letter}>
            <UText v="overline" tone="muted" style={{ marginTop: 18, marginBottom: 2 }}>{g.letter}</UText>
            {g.items.map((b, i) => {
              const place = [b.city, localizeCountry(b.country)].filter(Boolean).join(", ");
              return (
                <ListRow
                  key={b.id}
                  left={<Avatar name={b.fullName || "?"} size={48} />}
                  title={b.fullName}
                  subtitle={[place, b.phone].filter(Boolean).join(" · ") || t("bn.noInfo")}
                  onPress={() => router.push(`/(tabs)/beneficiaries/${b.id}`)}
                  last={i === g.items.length - 1}
                  right={
                    <IconButton
                      icon="paper-plane"
                      size={40}
                      kind="dark"
                      label={t("bn.sendTo", { name: b.fullName })}
                      onPress={() => router.push({ pathname: "/(tabs)/send", params: { beneficiaryId: b.id } })}
                    />
                  }
                />
              );
            })}
          </View>
        ))
      )}

      {status === "ready" && count > 0 && (
        <Button label={t("bn.new")} icon="person-add-outline" kind="dark" onPress={goCreate} style={{ marginTop: 28 }} />
      )}
    </Screen>
  );
}
