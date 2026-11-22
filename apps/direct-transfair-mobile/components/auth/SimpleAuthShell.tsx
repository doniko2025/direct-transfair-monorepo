// apps/direct-transfair-mobile/components/auth/SimpleAuthShell.tsx
// =========================================================
// CADRE D'AUTHENTIFICATION ÉPURÉ v1.0 — Direct Transf'air
// Page blanche, flèche de retour et bouton d'aide en pastilles rondes, grand titre à gauche, puis le formulaire (esprit « Taptap Send »).
// COULEURS : aucune couleur écrite en dur. Tout vient de useUI() (fond, encre, pastilles) donc de la couleur principale et de la
// couleur d'accent que le super admin choisit pour la société. Thème clair / sombre suivi automatiquement.
// Les éléments arrivent en cascade (composant Reveal). Largeur limitée à 480 px : l'écran reste propre sur tablette et sur le web.
// =========================================================

import React from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../ui/Icon';
import { Text } from '../ui/Text';
import { useUI, SYSTEM_FONT } from '../ui/theme';
import { useT } from '../../providers/I18nProvider';
import { LanguagePill } from '../i18n/LanguageSwitcher';
import { ThemePill } from '../theme/ThemeSwitcher';
import Reveal from '../flow/Reveal';
import { safeTop } from '../../utils/safeArea';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Élément placé à droite, avant l'aide (ex. pastille d'état du serveur). */
  headerRight?: React.ReactNode;
  /** Affiche les pastilles thème + langue (défaut : oui). */
  showLang?: boolean;
  /** Contenu sous le formulaire (inscription, liens légaux). */
  below?: React.ReactNode;
  /** Version resserrée (titre 24, marges réduites) : l'écran tient sans défilement. Défaut : oui. */
  compact?: boolean;
  children: React.ReactNode;
};

function RoundButton({ icon, label, onPress, size = 44 }: { icon: string; label: string; onPress: () => void; size?: number }) {
  const { C } = useUI();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: size / 2, backgroundColor: C.beige,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon as any} size={size >= 44 ? 22 : 19} color={C.ink} />
    </Pressable>
  );
}

export default function SimpleAuthShell({ title, subtitle, onBack, headerRight, showLang = true, below, compact = true, children }: Props) {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = safeTop(insets.top) + (compact ? 4 : 8);   // jamais sous la barre d'état (Android edge-to-edge : insets.top peut valoir 0)
  const bottom = Math.max(insets.bottom, 10) + (compact ? 8 : 18);
  const btn = compact ? 38 : 44;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <StatusBar barStyle={C.isDark ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: top, paddingBottom: bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, flexGrow: 1 }}>
          {/* Rangée du haut : retour · (état serveur, thème, langue) · aide */}
          <Reveal delay={0} distance={-8} duration={380}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: btn }}>
              {onBack ? <RoundButton size={btn} icon="arrow-back" label={t('common.back')} onPress={onBack} /> : <View style={{ width: 0 }} />}
              <View style={{ flex: 1 }} />
              {headerRight}
              {showLang ? <ThemePill /> : null}
              {showLang ? <LanguagePill /> : null}
              <RoundButton size={btn} icon="help-circle-outline" label={t('login.legal.help')} onPress={() => router.push('/(auth)/assistance')} />
            </View>
          </Reveal>

          <Reveal delay={90}>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: SYSTEM_FONT, fontSize: compact ? 24 : 32, lineHeight: compact ? 30 : 38, fontWeight: '800', letterSpacing: -0.6, color: C.ink, marginTop: compact ? 12 : 28 }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontFamily: SYSTEM_FONT, fontSize: compact ? 13.5 : 15, lineHeight: compact ? 19 : 22, color: C.muted, marginTop: 4 }}>{subtitle}</Text>
            ) : null}
          </Reveal>

          <View style={{ marginTop: compact ? 14 : 22, gap: 2 }}>{children}</View>

          {below ? <View style={{ marginTop: 'auto', paddingTop: compact ? 12 : 22 }}>{below}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
