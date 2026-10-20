// apps/direct-transfair-mobile/components/ui/BalanceCard.tsx
// =========================================================
// CARTE DE SOLDE v3.0 — Direct Transf'air (design « Corridor », white-label)
// ✅ v3.0 : carte vert forêt (couleur de marque assombrie pour une autre société) avec trame de points,
//    solde en blanc Manrope 800, œil, « réservé », pastille de taux blanche. Mêmes propriétés qu'avant.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from './Icon';
import { useUI, alpha } from './theme';
import { UText } from './Primitives';
import { Bone } from './Feedback';
import { DotGrid } from './Corridor';
import { Text } from './Text';
import { currencySymbol, formatMoney } from '../wallet/walletTheme';

export default function BalanceCard({
  currency, available, reserved = 0, hidden, onToggleHidden, loading, rateLabel, onPressRate, label = 'Solde disponible',
}: {
  currency: string; available: number; reserved?: number; hidden: boolean; onToggleHidden: () => void;
  loading?: boolean; rateLabel?: string | null; onPressRate?: () => void; label?: string;
}) {
  const { C, R, S } = useUI();
  const soft = alpha('#FFFFFF', 0.7);
  return (
    <View style={[{ borderRadius: R.lg, backgroundColor: C.forest, overflow: 'hidden', padding: 22 }, S.md]}>
      <DotGrid />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <UText v="caption" color={soft}>{label}</UText>
        <Pressable onPress={onToggleHidden} hitSlop={10} accessibilityLabel={hidden ? 'Afficher le solde' : 'Masquer le solde'}>
          <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {loading ? (
        <Bone width={200} height={48} radius={12} style={{ marginTop: 10, backgroundColor: alpha('#FFFFFF', 0.18) }} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <UText v="display" color="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ flexShrink: 1 }}>
            {hidden ? '••••••' : formatMoney(available, currency)}
          </UText>
          {!hidden && <UText v="heading" color={C.sun}>{currencySymbol(currency)}</UText>}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 10 }}>
        <View style={{ flexShrink: 1 }}>
          <UText v="caption" color={soft}>
            {reserved > 0 && !hidden ? `dont ${formatMoney(reserved, currency)} ${currencySymbol(currency)} réservé` : currency}
          </UText>
        </View>
        {!!rateLabel && (
          <Pressable
            onPress={onPressRate}
            disabled={!onPressRate}
            accessibilityRole="button"
            style={{ height: 34, paddingLeft: 10, paddingRight: 14, borderRadius: 17, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7 }}
          >
            <Ionicons name="swap-horizontal" size={16} color={C.leaf} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.forest }} numberOfLines={1}>{rateLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
