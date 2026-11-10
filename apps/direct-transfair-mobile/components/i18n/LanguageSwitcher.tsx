// apps/direct-transfair-mobile/components/i18n/LanguageSwitcher.tsx
// =========================================================
// SÉLECTEUR DE LANGUE (FR / EN / PT) — v1.0
//   • <LanguagePill />  : pastille « 🇫🇷 FR ⌄ » (connexion, inscription) — ouvre la feuille de choix ;
//   • <LanguageRow />   : ligne « Langue » pour les écrans Profil / Paramètres (affiche la langue actuelle) ;
//   • <LanguageSheet /> : feuille basse avec les trois langues et une coche sur la langue active.
// Le choix est immédiat (toute l'interface se redessine), mémorisé sur l'appareil et synchronisé avec le compte (voir <LanguageSync />).
// =========================================================

import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '../ui/Icon';
import { ListRow, Sheet, UText, useUI } from '../ui';
import { Text } from '../ui/Text';
import { LANGS, type Lang } from '../../i18n/core';
import { useI18n } from '../../providers/I18nProvider';

export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { lang, setLang, t } = useI18n();
  const { C } = useUI();

  const pick = (code: Lang) => {
    setLang(code);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('lang.choose')}>
      <View style={{ paddingBottom: 6 }}>
        <UText v="body" tone="muted" style={{ marginBottom: 6 }}>{t('lang.subtitle')}</UText>
        {LANGS.map((l, i) => {
          const active = l.code === lang;
          return (
            <ListRow
              key={l.code}
              title={l.label}
              subtitle={active ? t('lang.selected') : undefined}
              left={<Text style={s.flagBig}>{l.flag}</Text>}
              right={active ? <Ionicons name="checkmark-circle" size={24} color={C.accent} /> : <View style={{ width: 24 }} />}
              onPress={() => pick(l.code)}
              last={i === LANGS.length - 1}
            />
          );
        })}
      </View>
    </Sheet>
  );
}

/** Pastille « drapeau + sigle + flèche » (écrans de connexion). */
export function LanguagePill({ style }: { style?: object }) {
  const { info, t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('lang.change')} — ${t('lang.current', { name: info.label })}`}
        hitSlop={8}
        testID="language-pill"
        style={({ pressed }) => [s.pill, pressed && { opacity: 0.75 }, style]}
      >
        <Text style={s.pillFlag}>{info.flag}</Text>
        <Text style={s.pillTxt}>{info.short}</Text>
        <Ionicons name="chevron-down" size={14} color="#0F3A4D" />
      </Pressable>
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Ligne « Langue » pour Profil / Paramètres : drapeau + nom de la langue actuelle. */
export function LanguageRow({ last }: { last?: boolean }) {
  const { info, t } = useI18n();
  const { C } = useUI();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow
        icon="language-outline"
        title={t('lang.title')}
        subtitle={`${info.flag}  ${info.label}`}
        onPress={() => setOpen(true)}
        last={last}
        right={<Ionicons name="chevron-forward" size={18} color={C.faint} />}
      />
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  flagBig: { fontSize: 30, width: 44, textAlign: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0F3A4D', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: Platform.OS === 'android' ? 3 : 0,
  },
  pillFlag: { fontSize: 16 },
  pillTxt:  { fontSize: 13, fontWeight: '800', color: '#0F3A4D', letterSpacing: 0.3 },
});
