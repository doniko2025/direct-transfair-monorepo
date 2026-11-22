// apps/direct-transfair-mobile/components/auth/SimpleAuthShell.tsx
// =========================================================
// CADRE D'AUTHENTIFICATION ÉPURÉ v2.0 — Direct Transf'air
// ✅ v2.0 : LOGO EN HAUT (logo de la société via <BrandLogo />, « t' » par défaut) centré au-dessus du titre sur CHAQUE étape ; titre centré ;
//    barre de progression en 2 traits (prop `step`) ; fond doux teinté de la couleur principale ; contenu RÉPARTI sur toute la hauteur
//    (plus de grand vide sous les boutons) ; clavier ouvert → logo réduit et sous-titre masqué pour que le bouton reste visible.
//    La pastille d'état du serveur passe SOUS l'en-tête (centrée) pour ne pas pousser l'aide hors de l'écran.
//    Les cartes blanches ombrées et les lignes d'options sont dans components/auth/AuthCards.tsx.
// ✅ v1.0 : page blanche, retour et aide en pastilles rondes, grand titre à gauche.
// COULEURS : aucune couleur écrite en dur. Tout vient de useUI() (fond, encre, pastilles) donc de la couleur principale et de la
// couleur d'accent que le super admin choisit pour la société. Thème clair / sombre suivi automatiquement.
// Largeur limitée à 480 px : l'écran reste propre sur tablette et sur le web (responsive).
// =========================================================

import React, { useEffect, useRef } from 'react';
import { KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../ui/Icon';
import { Text } from '../ui/Text';
import { useUI, SYSTEM_FONT } from '../ui/theme';
import { useKeyboardOpen } from '../ui/Layout';
import { useT } from '../../providers/I18nProvider';
import { LanguagePill } from '../i18n/LanguageSwitcher';
import { ThemePill } from '../theme/ThemeSwitcher';
import BrandLogo from '../brand/BrandLogo';
import Reveal from '../flow/Reveal';
import { safeTop } from '../../utils/safeArea';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Élément affiché centré sous l'en-tête (ex. pastille « Le serveur démarre… ») : il ne pousse plus les boutons d'aide / langue hors de l'écran. */
  headerRight?: React.ReactNode;
  /** Affiche les pastilles thème + langue (défaut : oui). */
  showLang?: boolean;
  /** Contenu ancré en bas de l'écran (inscription, liens légaux). */
  below?: React.ReactNode;
  /** Étape en cours (1 ou 2) : affiche la barre de progression. Sans cette prop : pas de barre. */
  step?: 1 | 2;
  /** Taille du logo quand le clavier est fermé (défaut 92) ; réduit à 56 clavier ouvert. */
  logoSize?: number;
  /** Répartit les blocs sur toute la hauteur (défaut : oui). Mettre `false` pour un écran à un seul bloc : il se range sous le titre. */
  spread?: boolean;
  children: React.ReactNode;
};

const LOGO_SMALL = 56;

function RoundButton({ icon, label, onPress, size = 40 }: { icon: string; label: string; onPress: () => void; size?: number }) {
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
      <Ionicons name={icon as any} size={21} color={C.ink} />
    </Pressable>
  );
}

export default function SimpleAuthShell({ title, subtitle, onBack, headerRight, showLang = true, below, step, logoSize = 92, spread = true, children }: Props) {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardOpen();

  // Le logo se réduit et le sous-titre disparaît en douceur quand le clavier s'ouvre.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (Platform.OS === 'web') return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
  }, [kb]);

  const top = safeTop(insets.top) + 4;   // jamais sous la barre d'état (Android edge-to-edge : insets.top peut valoir 0)
  const bottom = Math.max(insets.bottom, 10) + 8;
  const size = kb ? LOGO_SMALL : logoSize;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <StatusBar barStyle={C.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      {/* Fond doux : teinte de la couleur principale en haut, fond de page en bas */}
      <LinearGradient pointerEvents="none" colors={[C.sunSoft, C.bg]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.62 }} style={StyleSheet.absoluteFill} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 }}>
              {onBack ? <RoundButton icon="arrow-back" label={t('common.back')} onPress={onBack} /> : <View style={{ width: 0 }} />}
              <View style={{ flex: 1 }} />
              {showLang ? <ThemePill /> : null}
              {showLang ? <LanguagePill /> : null}
              <RoundButton icon="help-circle-outline" label={t('login.legal.help')} onPress={() => router.push('/(auth)/assistance')} />
            </View>
          </Reveal>

          {/* Progression : 2 traits (étape 1 / étape 2) */}
          {step ? (
            <View
              style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('login.step', { n: step, total: 2 })}
            >
              {[1, 2].map((n) => (
                <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? C.sun : C.line }} />
              ))}
            </View>
          ) : null}

          {headerRight ? <View style={{ alignItems: 'center', marginTop: 8 }}>{headerRight}</View> : null}

          {/* Logo + titre, centrés, sur chaque étape */}
          <Reveal delay={60}>
            <View style={{ alignItems: 'center', marginTop: kb ? 10 : 22 }}>
              <BrandLogo size={size} />
              <Text
                accessibilityRole="header"
                style={{ fontFamily: SYSTEM_FONT, fontSize: kb ? 22 : 26, lineHeight: kb ? 28 : 32, fontWeight: '800', letterSpacing: -0.6, color: C.ink, marginTop: kb ? 8 : 14, textAlign: 'center' }}
              >
                {title}
              </Text>
              {subtitle && !kb ? (
                <Text style={{ fontFamily: SYSTEM_FONT, fontSize: 13.5, lineHeight: 19, color: C.muted, marginTop: 4, textAlign: 'center' }}>{subtitle}</Text>
              ) : null}
            </View>
          </Reveal>

          {/* Corps : les blocs se répartissent sur la hauteur disponible (pas de grand vide en bas) */}
          <View style={{ flex: 1, justifyContent: spread ? 'space-evenly' : 'flex-start', paddingTop: spread ? (kb ? 12 : 8) : (kb ? 14 : 24), paddingBottom: 8, gap: kb || !spread ? 12 : 0 }}>{children}</View>

          {below ? <View style={{ paddingTop: 6 }}>{below}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
