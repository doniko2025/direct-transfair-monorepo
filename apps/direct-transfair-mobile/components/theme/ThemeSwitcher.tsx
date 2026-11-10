// apps/direct-transfair-mobile/components/theme/ThemeSwitcher.tsx
// =========================================================
// SÉLECTEUR DE THÈME (Clair / Sombre / Automatique) — v1.0
//   • <ThemeCards />   : trois cartes avec un aperçu de l'écran (page « Préférences » et feuille de choix) ;
//   • <ThemeSheet />   : feuille basse avec les trois cartes ;
//   • <ThemePill />    : pastille ronde « soleil / lune / auto » (écrans de connexion, à côté de la langue) — ouvre la feuille.
// Le choix est immédiat (toute l'interface se redessine) et mémorisé sur l'appareil (voir providers/ThemeProvider.tsx).
// =========================================================

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '../ui/Icon';
import { Sheet, UText, useUI } from '../ui';
import { Text } from '../ui/Text';
import type { ThemeMode } from '../ui/themeMode';
import { useT } from '../../providers/I18nProvider';
import { useTheme } from '../../providers/ThemeProvider';
import type { MessageKey } from '../../i18n/catalog';

const MODES: Array<{ mode: ThemeMode; label: MessageKey; sub: MessageKey; icon: string }> = [
  { mode: 'light', label: 'th.light', sub: 'th.lightSub', icon: 'sun' },
  { mode: 'dark',  label: 'th.dark',  sub: 'th.darkSub',  icon: 'moon' },
  { mode: 'auto',  label: 'th.auto',  sub: 'th.autoSub',  icon: 'contrast' },
];

/** Libellé court du choix actuel (ex. « Sombre ») — pour les lignes de liste et l'accessibilité. */
export function useThemeLabel(): string {
  const t = useT();
  const { mode } = useTheme();
  return t(MODES.find((m) => m.mode === mode)!.label);
}

// ─── Aperçu d'un écran (dessiné, sans image) ─────────────
function Mini({ dark, brand }: { dark: boolean; brand: string }) {
  const bg = dark ? '#0D0F12' : '#F6F6F7';
  const card = dark ? '#16191E' : '#FFFFFF';
  const line = dark ? '#2B3038' : '#E3E3E6';
  const ink = dark ? '#F4F5F7' : '#111111';
  const soft = dark ? '#3A404A' : '#D9D9DD';
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 8, gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: soft }} />
        <View style={{ height: 5, width: '38%', borderRadius: 3, backgroundColor: ink }} />
      </View>
      <View style={{ height: 38, borderRadius: 10, backgroundColor: brand, padding: 7, justifyContent: 'flex-end' }}>
        <View style={{ height: 6, width: '52%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)' }} />
      </View>
      <View style={{ backgroundColor: card, borderRadius: 9, borderWidth: 1, borderColor: line, padding: 6, gap: 6 }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: soft }} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ height: 4, width: i ? '55%' : '70%', borderRadius: 2, backgroundColor: ink, opacity: 0.85 }} />
              <View style={{ height: 3, width: '40%', borderRadius: 2, backgroundColor: soft }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mode automatique : moitié claire, moitié sombre. */
function MiniSplit({ brand }: { brand: string }) {
  const [w, setW] = useState(0);
  return (
    <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Mini dark={false} brand={brand} />
      {w > 0 ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: w / 2, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: w }}>
            <Mini dark brand={brand} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ThemeCard({ mode, label, selected, onPick }: { mode: ThemeMode; label: string; selected: boolean; onPick: () => void }) {
  const { C } = useUI();
  const sel = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(sel, { toValue: selected ? 1 : 0, useNativeDriver: true, friction: 7, tension: 120 }).start();
  }, [selected, sel]);
  const scale = sel.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={`theme-${mode}`}
      style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[s.preview, { borderColor: C.line, backgroundColor: C.surface }]}>
          {mode === 'auto' ? <MiniSplit brand={C.sun} /> : <Mini dark={mode === 'dark'} brand={C.sun} />}
          {/* anneau de sélection (opacité animée, pilote natif) */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.ring, { borderColor: C.accent, opacity: sel }]} />
        </View>
        <Animated.View style={[s.check, { backgroundColor: C.accent, opacity: sel, transform: [{ scale: sel }] }]}>
          <Ionicons name="checkmark" size={13} color={C.accentInk} />
        </Animated.View>
      </Animated.View>
      <Text style={[s.label, { color: selected ? C.ink : C.muted, fontWeight: selected ? '800' : '600' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Trois cartes + description du choix actif. */
export function ThemeCards({ onPicked }: { onPicked?: (m: ThemeMode) => void }) {
  const t = useT();
  const { C } = useUI();
  const { mode, setMode, isDark } = useTheme();
  const active = MODES.find((m) => m.mode === mode)!;
  return (
    <View accessibilityRole="radiogroup">
      <View style={s.row}>
        {MODES.map((m) => (
          <ThemeCard
            key={m.mode}
            mode={m.mode}
            label={t(m.label)}
            selected={m.mode === mode}
            onPick={() => { setMode(m.mode); onPicked?.(m.mode); }}
          />
        ))}
      </View>
      <View style={[s.desc, { backgroundColor: C.accentSoft, borderColor: C.accentLine }]}>
        <Ionicons name={active.icon} size={18} color={C.accentDeep} />
        <View style={{ flex: 1 }}>
          <UText v="bodyStrong">{t(active.label)}</UText>
          <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{t(active.sub)}</UText>
          {mode === 'auto' ? (
            <UText v="caption" tone="muted" style={{ marginTop: 2 }}>{t('th.autoNow', { name: t(isDark ? 'th.dark' : 'th.light') })}</UText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ThemeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('th.choose')}>
      <View style={{ paddingTop: 8, paddingBottom: 6 }}>
        <ThemeCards onPicked={() => setTimeout(onClose, 220)} />
      </View>
    </Sheet>
  );
}

/** Pastille ronde « soleil / lune / auto » (écrans de connexion). */
export function ThemePill({ style }: { style?: object }) {
  const t = useT();
  const { mode, isDark } = useTheme();
  const label = useThemeLabel();
  const [open, setOpen] = useState(false);
  const fg = isDark ? '#F4F5F7' : '#0F3A4D';
  const icon = mode === 'auto' ? 'contrast' : isDark ? 'moon' : 'sun';
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('th.change')} — ${t('th.current', { name: label })}`}
        hitSlop={8}
        testID="theme-pill"
        style={({ pressed }) => [s.pill, isDark && s.pillDark, pressed && { opacity: 0.75 }, style]}
      >
        <Ionicons name={icon} size={17} color={fg} />
      </Pressable>
      <ThemeSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  preview: { aspectRatio: 0.78, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  ring: { borderWidth: 2.5, borderRadius: 16 },
  check: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', fontSize: 13.5, marginTop: 9 },
  desc: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 16 },
  pill: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0F3A4D', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: Platform.OS === 'android' ? 3 : 0,
  },
  pillDark: { backgroundColor: 'rgba(22,25,30,0.85)', borderColor: 'rgba(255,255,255,0.14)' },
});
