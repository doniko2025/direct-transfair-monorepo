// apps/direct-transfair-mobile/components/auth/CountryPickerSheet.tsx
// =========================================================
// SÉLECTEUR DE PAYS v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Feuille plein écran avec recherche insensible aux accents, pays
// fréquents en tête, drapeau + indicatif. Sert au pays de résidence,
// à la nationalité et à l'indicatif du téléphone.
// =========================================================

import React, { useMemo, useState } from 'react';
import {
  FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AUTH_COUNTRIES, fold, POPULAR_COUNTRIES, type AuthCountry } from './authCountries';
import { FONT, N, RADIUS, WEB_INPUT_RESET } from './authTheme';

type Props = {
  visible: boolean;
  title: string;
  selected?: string;
  showDial?: boolean;
  accent: string;
  onSelect: (c: AuthCountry) => void;
  onClose: () => void;
};

type Row = { kind: 'header'; label: string } | { kind: 'country'; country: AuthCountry };

export default function CountryPickerSheet({ visible, title, selected, showDial = false, accent, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const rows = useMemo<Row[]>(() => {
    const q = fold(query);
    if (q) {
      return AUTH_COUNTRIES
        .filter((c) => fold(c.name).includes(q) || c.dial.includes(q))
        .map((country) => ({ kind: 'country', country }) as Row);
    }
    const popular = POPULAR_COUNTRIES
      .map((n) => AUTH_COUNTRIES.find((c) => c.name === n))
      .filter((c): c is AuthCountry => !!c);
    return [
      { kind: 'header', label: 'Fréquents' } as Row,
      ...popular.map((country) => ({ kind: 'country', country }) as Row),
      { kind: 'header', label: 'Tous les pays' } as Row,
      ...AUTH_COUNTRIES.map((country) => ({ kind: 'country', country }) as Row),
    ];
  }, [query]);

  const close = () => { setQuery(''); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent={false}>
      <View style={[s.root, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={s.head}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={26} color={N.ink} />
          </TouchableOpacity>
        </View>

        <View style={s.search}>
          <Ionicons name="search" size={18} color={N.muted} />
          <TextInput
            style={[s.searchInput, WEB_INPUT_RESET]}
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un pays"
            placeholderTextColor="#A5B3AE"
            autoCorrect={false}
            autoCapitalize="none"
            underlineColorAndroid="transparent"
            accessibilityLabel="Rechercher un pays"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={N.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={rows}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(r, i) => (r.kind === 'header' ? `h-${r.label}` : `c-${r.country.name}-${i}`)}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          ListEmptyComponent={<Text style={s.empty}>Aucun pays ne correspond à « {query} ».</Text>}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text style={s.section}>{item.label}</Text>
            ) : (
              <TouchableOpacity
                style={[s.row, item.country.name === selected && { backgroundColor: accent + '14' }]}
                onPress={() => { onSelect(item.country); setQuery(''); }}
                accessibilityRole="button"
                accessibilityLabel={`${item.country.name}${showDial ? ` ${item.country.dial}` : ''}`}
              >
                <Text style={s.flag}>{item.country.flag}</Text>
                <Text style={s.name} numberOfLines={1}>{item.country.name}</Text>
                {showDial ? <Text style={s.dial}>{item.country.dial}</Text> : null}
                {item.country.name === selected ? <Ionicons name="checkmark-circle" size={20} color={accent} /> : null}
              </TouchableOpacity>
            )
          }
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: N.surface },
  head:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: FONT.display, fontSize: 22, fontWeight: '800', color: N.ink },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 8,
    backgroundColor: N.field, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: N.border,
    paddingHorizontal: 14, minHeight: 50,
  },
  searchInput: { flex: 1, fontFamily: FONT.body, fontSize: 16, color: N.ink, paddingVertical: Platform.OS === 'ios' ? 12 : 8 },
  section: { fontFamily: FONT.medium, fontSize: 12, fontWeight: '800', color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, minHeight: 54 },
  flag:  { fontSize: 24 },
  name:  { flex: 1, fontFamily: FONT.body, fontSize: 16, fontWeight: '600', color: N.ink },
  dial:  { fontFamily: FONT.body, fontSize: 14, color: N.muted, fontWeight: '600' },
  empty: { fontFamily: FONT.body, textAlign: 'center', color: N.muted, marginTop: 40, paddingHorizontal: 30 },
});
