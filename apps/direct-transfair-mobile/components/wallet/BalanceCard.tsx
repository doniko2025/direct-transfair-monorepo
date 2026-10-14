// apps/direct-transfair-mobile/components/wallet/BalanceCard.tsx
// =========================================================
// CARTE DE SOLDE v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Carte « bancaire » en dégradé de marque : solde disponible en grand,
// masquable, réservé, devise, et (option) le taux du jour cliquable.
// =========================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FONT, RADIUS, SHADOW, alpha, currencySymbol, formatMoney, useWalletTheme } from './walletTheme';
import { Skeleton } from './Skeleton';

type Props = {
  currency: string;
  available: number;
  reserved?: number;
  hidden: boolean;
  onToggleHidden: () => void;
  holder?: string;
  loading?: boolean;
  rateLabel?: string | null;
  onPressRate?: () => void;
};

export default function BalanceCard({
  currency, available, reserved = 0, hidden, onToggleHidden, holder, loading, rateLabel, onPressRate,
}: Props) {
  const { P, brandName } = useWalletTheme();
  return (
    <View style={[s.shadow, SHADOW.card]}>
      <LinearGradient
        colors={[P.action, P.bg3, P.bg2]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.card}
      >
        <View pointerEvents="none" style={[s.orb, s.orbA, { backgroundColor: alpha('#FFFFFF', 0.07) }]} />
        <View pointerEvents="none" style={[s.orb, s.orbB, { backgroundColor: alpha('#FFFFFF', 0.05) }]} />

        <View style={s.top}>
          <View style={s.brandRow}>
            <View style={s.chip}><Ionicons name="wallet-outline" size={15} color="#fff" /></View>
            <Text style={s.brand} numberOfLines={1}>{brandName || "Direct Transf'air"}</Text>
          </View>
          <TouchableOpacity onPress={onToggleHidden} hitSlop={10} accessibilityLabel={hidden ? 'Afficher le solde' : 'Masquer le solde'}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Solde disponible</Text>
        {loading ? (
          <Skeleton width={180} height={38} radius={10} style={{ backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 6 }} />
        ) : (
          <View style={s.amountRow}>
            <Text style={s.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {hidden ? '••••••' : formatMoney(available, currency)}
            </Text>
            {!hidden && <Text style={s.cur}>{currencySymbol(currency)}</Text>}
          </View>
        )}

        <View style={s.bottom}>
          <Text style={s.holder} numberOfLines={1}>{holder ? holder.toUpperCase() : ' '}</Text>
          {reserved > 0 && !hidden ? (
            <View style={s.reserved}>
              <Ionicons name="lock-closed-outline" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={s.reservedTxt}>Réservé {formatMoney(reserved, currency)}</Text>
            </View>
          ) : null}
        </View>

        {rateLabel ? (
          <TouchableOpacity style={s.rate} onPress={onPressRate} activeOpacity={0.8} disabled={!onPressRate}>
            <Ionicons name="trending-up-outline" size={14} color="#fff" />
            <Text style={s.rateTxt} numberOfLines={1}>{rateLabel}</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  shadow: { borderRadius: RADIUS.xl },
  card: { borderRadius: RADIUS.xl, padding: 20, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  orbA: { width: 220, height: 220, top: -90, right: -60 },
  orbB: { width: 160, height: 160, bottom: -70, left: -40 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  chip: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.92)', flexShrink: 1 },
  label: { fontFamily: FONT.body, fontSize: 12.5, color: 'rgba(255,255,255,0.72)', marginTop: 22 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  amount: { fontFamily: FONT.display, fontSize: 40, fontWeight: '700', color: '#fff', letterSpacing: -1, flexShrink: 1 },
  cur: { fontFamily: FONT.medium, fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, gap: 10 },
  holder: { fontFamily: FONT.medium, fontSize: 11.5, letterSpacing: 1.4, color: 'rgba(255,255,255,0.75)', flexShrink: 1 },
  reserved: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  reservedTxt: { fontFamily: FONT.medium, fontSize: 11, fontWeight: '600', color: '#fff' },
  rate: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  rateTxt: { flex: 1, fontFamily: FONT.medium, fontSize: 12.5, fontWeight: '600', color: '#fff' },
});
