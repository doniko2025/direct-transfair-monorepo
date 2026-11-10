// apps/direct-transfair-mobile/components/ui/OptionPicker.tsx
// =========================================================
// SÉLECTEUR À LISTE v1.0 — Direct Transf'air
// Un seul champ (comme les autres champs de formulaire) qui ouvre une feuille basse avec la liste des choix,
// à la place de pastilles éparpillées sur plusieurs lignes : catégorie du commerce, filtre de statut, etc.
// Import direct (non exporté par index.ts).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "./Icon";
import { useUI } from "./theme";
import { SelectRow } from "./Field";
import { ListRow, Sheet } from "./Layout";
import { useT } from "../../providers/I18nProvider";

export type PickerOption = { key: string; label: string; hint?: string };

export function OptionPicker({
  label, title, value, options, onChange, icon = "options-outline", placeholder, error, hint,
}: {
  /** Libellé du champ (au-dessus). */
  label?: string;
  /** Titre de la feuille (défaut : le libellé). */
  title?: string;
  /** Clé du choix actuel (null/"" = aucun, sauf si une option a la clé ""). */
  value: string | null;
  options: readonly PickerOption[];
  onChange: (key: string) => void;
  icon?: string;
  placeholder?: string;
  error?: string | null;
  hint?: string;
}) {
  const { C } = useUI();
  const t = useT();
  const ph = placeholder ?? t('state.choose');
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === (value ?? ""));
  return (
    <>
      <SelectRow label={label} value={current?.label} placeholder={ph} icon={icon} error={error} hint={hint} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={title ?? label ?? ph}>
        <View style={{ paddingTop: 6 }}>
          {options.map((o, i) => {
            const on = o.key === (value ?? "");
            return (
              <ListRow
                key={o.key || "__all"}
                title={o.label}
                subtitle={o.hint}
                last={i === options.length - 1}
                chevron={false}
                right={on ? <Ionicons name="checkmark" size={20} color={C.accentDeep} /> : undefined}
                onPress={() => { setOpen(false); if (!on) onChange(o.key); }}
              />
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

export default OptionPicker;
