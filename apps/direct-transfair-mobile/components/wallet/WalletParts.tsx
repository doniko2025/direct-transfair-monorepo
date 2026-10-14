// apps/direct-transfair-mobile/components/wallet/WalletParts.tsx
// =========================================================
// PETITS COMPOSANTS WALLET v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
//   Card · SectionTitle · QuickAction · TransactionRow · SearchBar · FilterChips · Avatar
// =========================================================

import React from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FONT, N, RADIUS, avatarTone, describeTx, formatMoney, formatShortDate, initialsOf, useWalletTheme,
} from './walletTheme';

// ─── Carte blanche ombrée ────────────────────────────────
export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: ViewStyle; padded?: boolean }) {
  return <View style={[s.card, padded && { padding: 16 }, style]}>{children}</View>;
}

// ─── Titre de section ────────────────────────────────────
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { P } = useWalletTheme();
  return (
    <View style={s.secRow}>
      <Text style={s.secTitle}>{title}</Text>
      {!!action && (
        <TouchableOpacity onPress={onAction} hitSlop={10}>
          <Text style={[s.secAction, { color: P.accent }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Avatar à initiales ──────────────────────────────────
export function Avatar({ name, size = 44, round = true }: { name: string; size?: number; round?: boolean }) {
  const t = avatarTone(name);
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size / 2 : size * 0.3, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONT.display, fontSize: size * 0.38, fontWeight: '700', color: t.fg }}>{initialsOf(name)}</Text>
    </View>
  );
}

// ─── Action rapide (tuile) ───────────────────────────────
export function QuickAction({ icon, label, onPress, primary }: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  const { P } = useWalletTheme();
  return (
    <TouchableOpacity style={s.qaWrap} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[s.qaBox, primary ? { backgroundColor: P.action, borderColor: P.action } : { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
        <Ionicons name={icon as any} size={22} color={primary ? '#fff' : P.accent} />
      </View>
      <Text style={s.qaLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Ligne de transaction ────────────────────────────────
export function TransactionRow({ tx, userId, onPress, last }: { tx: any; userId?: string; onPress?: () => void; last?: boolean }) {
  const v = describeTx(tx, userId);
  const name = v.counterpart || v.title;
  return (
    <TouchableOpacity
      style={[s.txRow, !last && s.txDivider]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[s.txIcon, { backgroundColor: v.incoming ? N.okBg : '#F2F4F7' }]}>
        <Ionicons name={v.icon as any} size={20} color={v.incoming ? N.ok : N.inkSub} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.txName} numberOfLines={1}>{name}</Text>
        <View style={s.txMeta}>
          <Text style={s.txSub} numberOfLines={1}>{v.counterpart ? `${v.title} · ` : ''}{formatShortDate(tx.createdAt)}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <Text style={[s.txAmount, { color: v.incoming ? N.ok : N.ink }]} numberOfLines={1}>
          {v.incoming ? '+' : '−'}{formatMoney(v.amount, v.currency)} {v.currency}
        </Text>
        <View style={[s.pill, { backgroundColor: v.status.bg, borderColor: v.status.bd }]}>
          <Text style={[s.pillTxt, { color: v.status.fg }]}>{v.statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Barre de recherche ──────────────────────────────────
export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={18} color="rgba(255,255,255,0.75)" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.6)"
        style={[s.searchInput, { outlineWidth: 0 } as any]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        selectionColor="#fff"
        underlineColorAndroid="transparent"
      />
      {!!value && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Filtres (pastilles) ─────────────────────────────────
export function FilterChips<T extends string>({
  options, value, onChange,
}: { options: Array<{ key: T; label: string; count?: number }>; value: T; onChange: (k: T) => void }) {
  const { P } = useWalletTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            style={[s.chip, active ? { backgroundColor: P.action, borderColor: P.action } : { backgroundColor: '#fff', borderColor: N.border }]}
          >
            <Text style={[s.chipTxt, { color: active ? '#fff' : N.inkSub }]}>
              {o.label}{o.count ? `  ${o.count}` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg + 2, borderWidth: 1, borderColor: '#E8EEEC',
    shadowColor: '#06231C', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  secTitle: { fontFamily: FONT.medium, fontSize: 16.5, fontWeight: '700', color: N.ink },
  secAction: { fontFamily: FONT.medium, fontSize: 13.5, fontWeight: '700' },

  qaWrap: { flex: 1, alignItems: 'center', gap: 8 },
  qaBox: { width: 58, height: 58, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontFamily: FONT.medium, fontSize: 12, fontWeight: '600', color: N.inkSub },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  txDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F0' },
  txIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txName: { fontFamily: FONT.medium, fontSize: 14.5, fontWeight: '700', color: N.ink },
  txMeta: { flexDirection: 'row', marginTop: 3 },
  txSub: { fontFamily: FONT.body, fontSize: 12, color: N.muted, flexShrink: 1 },
  txAmount: { fontFamily: FONT.medium, fontSize: 14.5, fontWeight: '800' },
  pill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  pillTxt: { fontFamily: FONT.medium, fontSize: 10.5, fontWeight: '700' },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, fontFamily: FONT.body },

  chip: { height: 36, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700' },
});
