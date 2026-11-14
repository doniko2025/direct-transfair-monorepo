// apps/direct-transfair-mobile/components/auth/SimpleAuthShell.tsx
// =========================================================
// CADRE D'AUTHENTIFICATION ÉPURÉ v1.0 — Direct Transf'air
// Page blanche, flèche de retour et bouton d'aide en pastilles rondes, grand titre à gauche, puis le formulaire (esprit « Taptap Send »).
// COULEURS : aucune couleur écrite en dur. Tout vient de useUI() (fond, encre, pastilles) donc de la couleur principale et de la
// couleur d'accent que le super admin choisit pour la société. Thème clair / sombre suivi automatiquement.
// Les éléments arrivent en cascade (composant Reveal). Largeur limitée à 480 px : l'écran reste propre sur tablette et sur le web.
// =========================================================

import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../ui/Icon';
import { Text } from '../ui/Text';
import { useUI, SYSTEM_FONT } from '../ui/theme';
import { useT } from '../../providers/I18nProvider';
import { LanguagePill } from '../i18n/LanguageSwitcher';
import { ThemePill } from '../theme/ThemeSwitcher';
import Reveal from '../flow/Reveal';

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
  children: React.ReactNode;
};

function RoundButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { C } = useUI();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22, backgroundColor: C.beige,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon as any} size={22} color={C.ink} />
    </Pressable>
  );
}

export default function SimpleAuthShell({ title, subtitle, onBack, headerRight, showLang = true, below, children }: Props) {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 12) + 8;
  const bottom = Math.max(insets.bottom, 14) + 18;

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
              {onBack ? <RoundButton icon="arrow-back" label={t('common.back')} onPress={onBack} /> : <View style={{ width: 0 }} />}
              <View style={{ flex: 1 }} />
              {headerRight}
              {showLang ? <ThemePill /> : null}
              {showLang ? <LanguagePill /> : null}
              <RoundButton icon="help-circle-outline" label={t('login.legal.help')} onPress={() => router.push('/(auth)/assistance')} />
            </View>
          </Reveal>

          <Reveal delay={90}>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: SYSTEM_FONT, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8, color: C.ink, marginTop: 28 }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 15, lineHeight: 22, color: C.muted, marginTop: 6 }}>{subtitle}</Text>
            ) : null}
          </Reveal>

          <View style={{ marginTop: 22, gap: 2 }}>{children}</View>

          {below ? <View style={{ marginTop: 'auto', paddingTop: 22 }}>{below}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
