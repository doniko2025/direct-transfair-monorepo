// apps/direct-transfair-mobile/components/ui/BalanceCard.tsx
// =========================================================
// CARTE DE SOLDE v2.0 — Direct Transf'air (thème clair, white-label)
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Maquette « Flash Transfert » : carte blanche qui se fond vers la couleur
// d'accent de la société, gros solde, œil, « réservé », pastille de taux.
// =========================================================

import React from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from './theme';
import { Pill, UText } from './Primitives';
import { Bone } from './Feedback';
import { currencySymbol, formatMoney } from '../wallet/walletTheme';

export default function BalanceCard({
  currency, available, reserved = 0, hidden, onToggleHidden, loading, rateLabel, onPressRate, label = 'Solde disponible',
}: {
  currency: string; available: number; reserved?: number; hidden: boolean; onToggleHidden: () => void;
  loading?: boolean; rateLabel?: string | null; onPressRate?: () => void; label?: string;
}) {
  const { C, R, S } = useUI();
  return (
    <View style={[{ borderRadius: R.xl }, S.md]}>
      <LinearGradient
        colors={[C.surface, C.accentSoft, C.accent]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: R.xl, padding: 22, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <UText v="overline" tone="muted">{label}</UText>
          <Pressable onPress={onToggleHidden} hitSlop={10} accessibilityLabel={hidden ? 'Afficher le solde' : 'Masquer le solde'}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink} />
          </Pressable>
        </View>

        {loading ? (
          <Bone width={200} height={48} radius={12} style={{ marginTop: 10 }} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <UText v="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ flexShrink: 1 }}>
              {hidden ? '••••••' : formatMoney(available, currency)}
            </UText>
            {!hidden && <UText v="heading" tone="muted">{currencySymbol(currency)}</UText>}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 10 }}>
          <View style={{ flexShrink: 1 }}>
            {reserved > 0 && !hidden ? (
              <UText v="caption" style={{ color: C.ink, opacity: 0.7 }}>
                dont {formatMoney(reserved, currency)} {currencySymbol(currency)} réservé
              </UText>
            ) : <UText v="caption" style={{ color: C.ink, opacity: 0.7 }}>{currency}</UText>}
          </View>
          {!!rateLabel && (
            <Pressable onPress={onPressRate} disabled={!onPressRate} accessibilityRole="button">
              <Pill label={rateLabel} tone="dark" icon="swap-horizontal" />
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}
