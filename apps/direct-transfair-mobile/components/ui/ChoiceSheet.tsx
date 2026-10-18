// apps/direct-transfair-mobile/components/ui/ChoiceSheet.tsx
// =========================================================
// CHOICE SHEET v1.0 — Direct Transf'air (design system clair)
// Feuille basse de sélection avec recherche : pays, ville, indicatif téléphonique…
// Générique (T) : le parent fournit la clé, le libellé, l'élément de gauche (drapeau…),
// un texte optionnel à droite (indicatif) et l'état « sélectionné ».
// Ajouté pour la refonte thème clair (écrans Contact : créer / détail) ; fichier neuf,
// non exporté par index.ts (import direct) afin de ne pas toucher à l'existant.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUI } from "./theme";
import { UText } from "./Primitives";
import { SearchPill } from "./Field";
import { ListRow, Sheet } from "./Layout";
import { EmptyView } from "./Feedback";

export function ChoiceSheet<T>({
  visible, onClose, title, items, getKey, getLabel, getLeft, getRight, isSelected, onPick, searchPlaceholder = "Rechercher",
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getLeft?: (item: T) => React.ReactNode;
  getRight?: (item: T) => string | undefined;
  isSelected: (item: T) => boolean;
  onPick: (item: T) => void;
  searchPlaceholder?: string;
}) {
  const { C } = useUI();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((i) => getLabel(i).toLowerCase().includes(needle)) : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items]);
  const close = () => { onClose(); setQ(""); };

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <View style={{ paddingTop: 8, paddingBottom: 6 }}>
        <SearchPill value={q} onChangeText={setQ} placeholder={searchPlaceholder} autoFocus />
      </View>
      {filtered.length === 0 ? (
        <EmptyView icon="search-outline" title="Aucun résultat" />
      ) : (
        filtered.map((item, i) => (
          <ListRow
            key={getKey(item)}
            title={getLabel(item)}
            left={getLeft?.(item)}
            last={i === filtered.length - 1}
            chevron={false}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {!!getRight?.(item) && <UText v="label" tone="muted">{getRight(item)}</UText>}
                {isSelected(item) && <Ionicons name="checkmark" size={18} color={C.accentDeep} />}
              </View>
            }
            onPress={() => { onPick(item); close(); }}
          />
        ))
      )}
    </Sheet>
  );
}

export default ChoiceSheet;
