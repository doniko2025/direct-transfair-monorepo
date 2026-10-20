// apps/direct-transfair-mobile/components/ui/Layout.tsx
// =========================================================
// MISE EN PAGE v3.1 — Direct Transf'air (design « Corridor », white-label)
// ✅ v3.1 : ListRow cliquable avec un élément interactif à droite (ex. bouton « Envoyer ») — sur le web, la ligne n'est plus
//    rendue en <button> (un <button> dans un <button> est invalide en HTML : erreur d'hydratation, clics instables).
//    Mobile natif inchangé ; la ligne reste cliquable et focalisable au clavier.
// ✅ v3.0 : design « Corridor » — fond brume, titres Fraunces vert forêt, intitulés de section en Manrope gras,
//    pastilles d'icône teintées forêt, lignes de liste séparées par le filet vert pâle.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Screen (fond crème, zone sûre, défilement, tirer-pour-rafraîchir, clavier),
// NavBar (retour + titre), PageTitle (gros titre), SectionHeader, ListRow et
// TxRow (lignes séparées par un filet, sans cartes lourdes), Sheet (feuille basse).
// =========================================================

import React from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from './Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUI, SYSTEM_FONT, TAB_SPACE, type UIColors } from './theme';
import { Avatar, IconButton, UText } from './Primitives';
import { describeTx, formatMoney, formatShortDate, currencySymbol } from '../wallet/walletTheme';

import { Text } from './Text';
// ─── Écran ───────────────────────────────────────────────
type ScreenProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  /** Réserve la place de la barre d'onglets (écrans de l'onglet principal). */
  tabSpace?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  maxWidth?: number;
};
export function Screen({
  children, header, footer, scroll = true, tabSpace, refreshing, onRefresh, padded = true, keyboard = true, contentStyle, maxWidth = 640,
}: ScreenProps) {
  const { C } = useUI();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12);
  const bottom = tabSpace ? TAB_SPACE + insets.bottom : Math.max(insets.bottom, 12) + 16;

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingBottom: footer ? 24 : bottom, flexGrow: 1 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} colors={[C.accent]} /> : undefined}
    >
      <View style={[{ width: '100%', maxWidth, alignSelf: 'center' }, padded && { paddingHorizontal: 20 }]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, width: '100%', maxWidth, alignSelf: 'center' }, padded && { paddingHorizontal: 20 }, contentStyle]}>{children}</View>
  );

  const content = (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: top }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {header}
      {body}
      {footer ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) + 8, backgroundColor: C.bg, width: '100%', maxWidth, alignSelf: 'center' }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  );
}

// ─── Barre de navigation ─────────────────────────────────
export function NavBar({
  title, onBack, right, subtitle, style,
}: { title?: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, minHeight: 64 }, style]}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} label="Retour" /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {!!title && <UText v="heading" numberOfLines={1}>{title}</UText>}
        {!!subtitle && <UText v="caption" tone="muted" numberOfLines={1}>{subtitle}</UText>}
      </View>
      {right}
    </View>
  );
}

/** Gros titre de page + sous-titre (maquettes : « Transfert », « Activité »). */
export function PageTitle({ title, subtitle, right, style }: { title: string; subtitle?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 8, paddingBottom: 18 }, style]}>
      <View style={{ flex: 1 }}>
        <UText v="hero">{title}</UText>
        {!!subtitle && <UText v="body" tone="muted" style={{ marginTop: 4 }}>{subtitle}</UText>}
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({
  title, action, onAction, style,
}: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  const { C } = useUI();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 6 }, style]}>
      <UText v="subheading" color={C.dark}>{title}</UText>
      {!!action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 14, fontWeight: '800', color: C.accent }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Ligne de liste (filet, sans carte) ──────────────────
type RowProps = {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  icon?: string;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
};
export function ListRow({ title, subtitle, left, right, icon, onPress, chevron, last, danger, style }: RowProps) {
  const { C } = useUI();
  const inner = (
    <>
      {left ?? (icon ? (
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: danger ? C.dangerBg : C.beige, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as any} size={20} color={danger ? C.danger : C.dark} />
        </View>
      ) : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <UText v="bodyStrong" numberOfLines={1} color={danger ? C.danger : undefined}>{title}</UText>
        {!!subtitle && <UText v="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</UText>}
      </View>
      {right}
      {(chevron ?? !!onPress) && !right ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null}
    </>
  );
  const base: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line,
  };
  if (onPress) {
    // Web : si la ligne contient déjà un bouton (zone `right`), elle ne doit pas être un <button> elle-même.
    const role = Platform.OS === 'web' && right ? undefined : 'button';
    return <Pressable onPress={onPress} accessibilityRole={role} style={({ pressed }) => [base, { opacity: pressed ? 0.6 : 1 }, style]}>{inner}</Pressable>;
  }
  return <View style={[base, style]}>{inner}</View>;
}

/** Groupe de lignes dans une carte blanche arrondie (pour les listes de réglages). */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { C, R } = useUI();
  return (
    <View style={[{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

// ─── Statut d'une transaction ────────────────────────────
export function statusColor(C: UIColors, status: string): string {
  switch (String(status).toUpperCase()) {
    case 'PAID': return C.pos;
    case 'VALIDATED': return C.info;
    case 'PENDING': return C.warn;
    case 'PROCESSING':
    case 'REFUNDED': return C.violet;
    case 'FAILED': return C.danger;
    default: return C.muted;
  }
}

// ─── Ligne de transaction (maquette « Activité ») ────────
export function TxRow({
  tx, userId, onPress, last, showStatus = true,
}: { tx: any; userId?: string; onPress?: () => void; last?: boolean; showStatus?: boolean }) {
  const { C } = useUI();
  const v = describeTx(tx, userId);
  const col = statusColor(C, String(tx?.status ?? ''));
  const name = v.counterpart || v.title;
  const date = tx?.createdAt ? formatShortDate(tx.createdAt) : '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line, opacity: pressed ? 0.6 : 1,
      }]}
    >
      <Avatar name={name} incoming={v.incoming} icon={v.counterpart ? undefined : v.icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <UText v="bodyStrong" numberOfLines={1}>{name}</UText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {showStatus && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />}
          <UText v="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {showStatus ? `${v.statusLabel} · ${date}` : date}
          </UText>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <UText v="bodyStrong" style={{ color: v.incoming ? C.pos : C.ink, fontWeight: '800' }} numberOfLines={1}>
          {v.incoming ? '+' : '−'}{formatMoney(v.amount, v.currency)} {currencySymbol(v.currency)}
        </UText>
        {!!v.converted && (
          <UText v="caption" tone="muted" numberOfLines={1}>
            {formatMoney(v.converted.amount, v.converted.currency)} {currencySymbol(v.converted.currency)}
          </UText>
        )}
      </View>
    </Pressable>
  );
}

// ─── Feuille basse ───────────────────────────────────────
export function Sheet({
  visible, onClose, title, children, footer,
}: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const { C, R } = useUI();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '88%', paddingBottom: Math.max(insets.bottom, 12) + 8, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.lineStrong }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
            <UText v="title" style={{ flex: 1 }} numberOfLines={1}>{title ?? ''}</UText>
            <IconButton icon="close" onPress={onClose} label="Fermer" size={40} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}