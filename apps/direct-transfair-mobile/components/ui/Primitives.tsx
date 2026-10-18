// apps/direct-transfair-mobile/components/ui/Primitives.tsx
// =========================================================
// BRIQUES DE BASE v2.0 — Direct Transf'air (thème clair, white-label)
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Texte, boutons, puces, onglets soulignés, carte, séparateur, avatar,
// pastille de statut, interrupteur, bandeau d'info. Toutes les couleurs
// viennent de useUI() : l'accent est celui de la société.
// =========================================================

import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Switch, Text, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI, type TextVariant, SYSTEM_FONT } from './theme';

// ─── Texte ───────────────────────────────────────────────
type UTextProps = TextProps & {
  v?: TextVariant;
  color?: string;
  tone?: 'ink' | 'muted' | 'faint' | 'accent' | 'pos' | 'danger' | 'warn';
  align?: TextStyle['textAlign'];
};
export function UText({ v = 'body', color, tone = 'ink', align, style, ...rest }: UTextProps) {
  const { C, T } = useUI();
  const tones: Record<string, string> = {
    ink: C.ink, muted: C.muted, faint: C.faint, accent: C.accentDeep, pos: C.pos, danger: C.danger, warn: C.warn,
  };
  return (
    <Text
      {...rest}
      style={[{ fontFamily: SYSTEM_FONT }, T[v], { color: color ?? tones[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}

// ─── Bouton ──────────────────────────────────────────────
type ButtonKind = 'primary' | 'dark' | 'outline' | 'soft' | 'ghost' | 'danger';
type ButtonProps = {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
export function Button({
  label, onPress, kind = 'primary', icon, iconRight, loading, disabled, small, full = true, style, testID,
}: ButtonProps) {
  const { C, R, T } = useUI();
  const palette: Record<ButtonKind, { bg: string; fg: string; bd?: string }> = {
    primary: { bg: C.accent, fg: C.accentInk },
    dark: { bg: C.dark, fg: C.darkInk },
    outline: { bg: 'transparent', fg: C.ink, bd: C.lineStrong },
    soft: { bg: C.accentSoft, fg: C.accentDeep },
    ghost: { bg: 'transparent', fg: C.ink },
    danger: { bg: C.dangerBg, fg: C.danger, bd: C.dangerLine },
  };
  const p = palette[kind];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        {
          height: small ? 42 : 56,
          paddingHorizontal: small ? 18 : 24,
          borderRadius: R.pill,
          backgroundColor: p.bg,
          borderWidth: p.bd ? 1.5 : 0,
          borderColor: p.bd,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
          transform: [{ scale: pressed && !off ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : (
        <>
          {!!icon && <Ionicons name={icon as any} size={small ? 16 : 19} color={p.fg} />}
          <Text style={[{ fontFamily: SYSTEM_FONT }, T.button, small && { fontSize: 14 }, { color: p.fg }]} numberOfLines={1}>{label}</Text>
          {!!iconRight && <Ionicons name={iconRight as any} size={small ? 16 : 19} color={p.fg} />}
        </>
      )}
    </Pressable>
  );
}

// ─── Bouton rond avec icône ──────────────────────────────
export function IconButton({
  icon, onPress, size = 44, kind = 'soft', badge, label, style,
}: {
  icon: string; onPress?: () => void; size?: number; kind?: 'soft' | 'dark' | 'accent' | 'plain';
  badge?: number; label?: string; style?: StyleProp<ViewStyle>;
}) {
  const { C } = useUI();
  const bg = kind === 'dark' ? C.dark : kind === 'accent' ? C.accent : kind === 'plain' ? 'transparent' : C.surface;
  const fg = kind === 'dark' ? C.darkInk : kind === 'accent' ? C.accentInk : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size, height: size, borderRadius: size / 2, backgroundColor: bg,
          borderWidth: kind === 'soft' ? 1 : 0, borderColor: C.line,
          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon as any} size={Math.round(size * 0.46)} color={fg} />
      {!!badge && badge > 0 && (
        <View style={{
          position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
          backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
          borderWidth: 2, borderColor: C.bg,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Puce (filtre / choix) : noire quand sélectionnée ────
export function Chip({
  label, active, onPress, icon, count, style,
}: { label: string; active?: boolean; onPress?: () => void; icon?: string; count?: number; style?: StyleProp<ViewStyle> }) {
  const { C, R } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [{
        height: 40, paddingHorizontal: 16, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: active ? C.dark : C.surface, borderWidth: 1, borderColor: active ? C.dark : C.line,
        opacity: pressed ? 0.85 : 1,
      }, style]}
    >
      {!!icon && <Ionicons name={icon as any} size={15} color={active ? C.darkInk : C.ink} />}
      <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 14, fontWeight: '600', color: active ? C.darkInk : C.ink }}>{label}</Text>
      {count !== undefined && count > 0 && (
        <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12, fontWeight: '700', color: active ? C.darkInk : C.muted, opacity: 0.8 }}>{count}</Text>
      )}
    </Pressable>
  );
}

// ─── Onglets soulignés (Wallet | Cash Pickup) ────────────
export function Tabs<K extends string>({
  items, value, onChange, style,
}: { items: { key: K; label: string; icon?: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  const { C } = useUI();
  return (
    <View style={[{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line }, style]}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
          >
            {!!it.icon && <Ionicons name={it.icon as any} size={16} color={on ? C.ink : C.muted} />}
            <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 15, fontWeight: on ? '800' : '600', color: on ? C.ink : C.muted }}>{it.label}</Text>
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: -1, height: 3, borderRadius: 2, backgroundColor: on ? C.ink : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Carte blanche ───────────────────────────────────────
export function Card({
  children, style, pad = 20, onPress, tone = 'surface',
}: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number; onPress?: () => void; tone?: 'surface' | 'sunken' | 'accent' | 'outline' }) {
  const { C, R, S } = useUI();
  const base: ViewStyle = {
    backgroundColor: tone === 'sunken' ? C.field : tone === 'accent' ? C.accentSoft : C.surface,
    borderRadius: R.lg,
    padding: pad,
    borderWidth: tone === 'surface' || tone === 'outline' ? 1 : tone === 'accent' ? 1 : 0,
    borderColor: tone === 'accent' ? C.accentLine : C.line,
    ...(tone === 'surface' ? S.sm : null),
  };
  if (onPress) {
    return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>{children}</Pressable>;
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const { C } = useUI();
  return <View style={[{ height: StyleSheet.hairlineWidth > 0.5 ? 1 : 1, backgroundColor: C.line, marginLeft: inset }, style]} />;
}

// ─── Avatar rond (beige, menthe si entrant) ──────────────
const AV = [
  { bg: '#EFEBE1', fg: '#5B5648' }, { bg: '#E7EEE3', fg: '#46603B' }, { bg: '#EAE7F2', fg: '#554A7A' },
  { bg: '#F3E8E4', fg: '#7A4A3C' }, { bg: '#E3EDF0', fg: '#3B5C66' }, { bg: '#F2EDDA', fg: '#6E5F25' },
];
export function initials(name?: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}
export function Avatar({
  name, size = 48, icon, incoming, uri,
}: { name?: string; size?: number; icon?: string; incoming?: boolean; uri?: string | null }) {
  const { C } = useUI();
  const tone = AV[((name || '?').charCodeAt(0) || 0) % AV.length];
  const bg = incoming ? C.posBg : tone.bg;
  const fg = incoming ? C.pos : tone.fg;
  void uri;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {icon ? (
        <Ionicons name={icon as any} size={Math.round(size * 0.44)} color={fg} />
      ) : (
        <Text style={{ fontFamily: SYSTEM_FONT, fontSize: Math.round(size * 0.36), fontWeight: '700', color: fg }}>{initials(name)}</Text>
      )}
    </View>
  );
}

// ─── Pastille de statut : point + libellé ────────────────
export function StatusDot({ color, label, size = 7 }: { color: string; label: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
      <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12.5, fontWeight: '600', color }}>{label}</Text>
    </View>
  );
}

/** Petit badge arrondi (taux, "Nouveau", niveau KYC…) — accent par défaut. */
export function Pill({
  label, tone = 'accent', icon, style,
}: { label: string; tone?: 'accent' | 'neutral' | 'pos' | 'warn' | 'danger' | 'info' | 'dark'; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { C, R } = useUI();
  const m = {
    accent: { bg: C.accent, fg: C.accentInk },
    neutral: { bg: C.beige, fg: C.text },
    pos: { bg: C.posBg, fg: C.pos },
    warn: { bg: C.warnBg, fg: C.warn },
    danger: { bg: C.dangerBg, fg: C.danger },
    info: { bg: C.infoBg, fg: C.info },
    dark: { bg: C.dark, fg: C.darkInk },
  }[tone];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 12, height: 28, borderRadius: R.pill, backgroundColor: m.bg }, style]}>
      {!!icon && <Ionicons name={icon as any} size={13} color={m.fg} />}
      <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 12.5, fontWeight: '700', color: m.fg }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── Interrupteur ────────────────────────────────────────
export function Toggle({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  const { C } = useUI();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: C.lineStrong, true: C.accent }}
      thumbColor="#FFFFFF"
      {...({ activeThumbColor: '#FFFFFF' } as any)}
    />
  );
}

// ─── Bandeau d'information ───────────────────────────────
export function Notice({
  tone = 'info', title, children, icon, action, onAction, style,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'pos' | 'accent';
  title?: string; children?: React.ReactNode; icon?: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const { C, R } = useUI();
  const m = {
    info: { bg: C.infoBg, bd: C.infoLine, fg: C.info, ic: 'information-circle' },
    warn: { bg: C.warnBg, bd: C.warnLine, fg: C.warn, ic: 'alert-circle' },
    danger: { bg: C.dangerBg, bd: C.dangerLine, fg: C.danger, ic: 'close-circle' },
    pos: { bg: C.posBg, bd: '#BFE5CD', fg: C.pos, ic: 'checkmark-circle' },
    accent: { bg: C.accentSoft, bd: C.accentLine, fg: C.accentDeep, ic: 'sparkles' },
  }[tone];
  return (
    <View style={[{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: R.md, backgroundColor: m.bg, borderWidth: 1, borderColor: m.bd }, style]}>
      <Ionicons name={(icon ?? m.ic) as any} size={20} color={m.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {!!title && <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 14, fontWeight: '700', color: m.fg }}>{title}</Text>}
        {typeof children === 'string'
          ? <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13.5, lineHeight: 19, color: C.text }}>{children}</Text>
          : children}
        {!!action && !!onAction && (
          <Pressable onPress={onAction} hitSlop={8} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13.5, fontWeight: '800', color: m.fg, textDecorationLine: 'underline' }}>{action}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
