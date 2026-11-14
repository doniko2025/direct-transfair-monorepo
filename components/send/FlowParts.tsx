// apps/direct-transfair-mobile/components/send/FlowParts.tsx
// =========================================================
// ÉLÉMENTS DU PARCOURS D'ENVOI v1.0 — Direct Transf'air
//   • <StepProgress />  : barre de progression en segments, chaque segment se remplit en douceur ;
//   • <RecapChips />    : puces récapitulatives (type, destinataire, montant) qui apparaissent en « rebond » au fil des étapes ;
//   • <ChoiceCard />    : grande carte de choix (Wallet / Cash Pickup) avec pastille d'icône.
// COULEURS : 100 % dynamiques, lues dans useUI() — barre = couleur principale de la société, puces et pastilles = couleur d'accent.
// Aucune couleur n'est écrite en dur : elles suivent ce que le super admin choisit, ainsi que le thème clair / sombre.
// =========================================================

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Ionicons } from '../ui/Icon';
import { UText, useUI } from '../ui';
import Reveal from '../flow/Reveal';

// ─── Barre de progression ────────────────────────────────
export function StepProgress({ count, index }: { count: number; index: number }) {
  const { C } = useUI();
  const vals = useRef<Animated.Value[]>([]).current;
  while (vals.length < count) vals.push(new Animated.Value(0));

  useEffect(() => {
    const anims = vals.slice(0, count).map((v, i) =>
      Animated.timing(v, { toValue: i <= index ? 1 : 0, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: false }));
    Animated.parallel(anims).start();
  }, [index, count]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      style={{ flexDirection: 'row', gap: 6 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: count, now: Math.min(index + 1, count) }}
    >
      {vals.slice(0, count).map((v, i) => (
        <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
          <Animated.View
            style={{ height: 5, borderRadius: 3, backgroundColor: C.sun, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
          />
        </View>
      ))}
    </View>
  );
}

// ─── Puces récapitulatives ───────────────────────────────
export type RecapChip = { key: string; icon: string; label: string };

export function RecapChips({ chips }: { chips: RecapChip[] }) {
  const { C, R } = useUI();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 34 }}>
      {chips.map((c) => (
        // key = clé de la puce : elle ne rejoue son apparition que lorsqu'elle apparaît pour la première fois.
        <Reveal key={c.key} pop delay={60}>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: R.pill,
              backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, maxWidth: 220,
            }}
          >
            <Ionicons name={c.icon as any} size={14} color={C.accentDeep} />
            <UText v="label" color={C.accentDeep} numberOfLines={1} style={{ flexShrink: 1 }}>{c.label}</UText>
          </View>
        </Reveal>
      ))}
    </View>
  );
}

// ─── Carte de choix ──────────────────────────────────────
export function ChoiceCard({
  icon, title, subtitle, selected, onPress, delay = 0,
}: { icon: string; title: string; subtitle?: string; selected?: boolean; onPress: () => void; delay?: number }) {
  const { C, R, S } = useUI();
  return (
    <Reveal delay={delay}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        style={({ pressed }) => [
          {
            flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: R.lg, borderWidth: 1.5,
            borderColor: selected ? C.accent : C.line, backgroundColor: selected ? C.accentSoft : C.surface,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
          selected ? null : S.sm,
        ]}
      >
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: selected ? C.surface : C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as any} size={26} color={C.accentDeep} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UText v="subheading" numberOfLines={1}>{title}</UText>
          {!!subtitle && <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{subtitle}</UText>}
        </View>
        <Ionicons name={selected ? 'checkmark-circle' : 'chevron-forward'} size={selected ? 24 : 20} color={selected ? C.accent : C.faint} />
      </Pressable>
    </Reveal>
  );
}
