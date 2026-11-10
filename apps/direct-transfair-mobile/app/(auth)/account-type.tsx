// apps/direct-transfair-mobile/app/(auth)/account-type.tsx
// =========================================================
// CHOIX DU TYPE DE COMPTE v1.0 — Lot 11
// « Je suis client / Je suis marchand » : deux grandes cartes animées, « Continuer » ouvre l'inscription
// avec le type choisi (?type=client | merchant). Le marchand a une étape de plus (« Votre commerce »).
// Si l'administrateur de la société a désactivé les comptes marchands, le serveur le refuse à l'inscription
// et l'écran d'inscription l'explique.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../components/ui/Icon';
import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthButton from '../../components/auth/AuthButton';
import { FONT, N } from '../../components/auth/authTheme';
import { Text } from '../../components/ui/Text';
import { useT } from '../../providers/I18nProvider';
import type { MessageKey } from '../../i18n/catalog';
import { themed } from '../../components/wallet/brand';

type Kind = 'client' | 'merchant';

const OPTIONS: { kind: Kind; icon: string; title: MessageKey; text: MessageKey }[] = [
  { kind: 'client', icon: 'person-outline', title: 'acct.client.title', text: 'acct.client.text' },
  { kind: 'merchant', icon: 'storefront-outline', title: 'acct.merchant.title', text: 'acct.merchant.text' },
];

function ChoiceCard({
  option, selected, onPress, delay, accent, tint,
}: { option: (typeof OPTIONS)[number]; selected: boolean; onPress: () => void; delay: number; accent: string; tint: string }) {
  const t = useT();
  const enter = useRef(new Animated.Value(0)).current;
  const pick = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, delay]);
  useEffect(() => {
    Animated.spring(pick, { toValue: selected ? 1 : 0, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [pick, selected]);
  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: pick.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={t(option.title)}
        testID={`account-type-${option.kind}`}
        style={[s.card, { borderColor: selected ? accent : N.border, backgroundColor: selected ? tint : N.surface }]}
      >
        <View style={[s.iconWrap, { backgroundColor: selected ? accent : tint }]}>
          <Ionicons name={option.icon as any} size={26} color={selected ? '#FFFFFF' : accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>{t(option.title)}</Text>
          <Text style={s.text}>{t(option.text)}</Text>
        </View>
        <View style={[s.radio, { borderColor: selected ? accent : N.border, backgroundColor: selected ? accent : 'transparent' }]}>
          {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AccountTypeScreen() {
  const router = useRouter();
  const t = useT();
  const P = useAuthPalette();
  const [kind, setKind] = useState<Kind | null>(null);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login-v2');
  };

  return (
    <AuthShell compact showLang title={t('acct.title')} subtitle={t('acct.subtitle')} onBack={back}>
      <Text style={s.step}>{t('acct.step')}</Text>
      <View style={{ gap: 14 }}>
        {OPTIONS.map((o, i) => (
          <ChoiceCard key={o.kind} option={o} selected={kind === o.kind} onPress={() => setKind(o.kind)} delay={80 + i * 140} accent={P.action} tint={P.tint} />
        ))}
      </View>
      <View style={{ height: 22 }} />
      <AuthButton
        label={t('common.continue')}
        icon="arrow-forward"
        iconRight
        accent={P.action}
        disabled={!kind}
        onPress={() => kind && router.push({ pathname: '/(auth)/register', params: { type: kind } } as any)}
        testID="account-type-next"
      />
      <View style={s.loginRow}>
        <Text style={s.loginTxt}>{t('acct.haveAccount')}</Text>
        <AuthButton label={t('login.submit')} variant="link" accent={P.accent} onPress={() => router.replace('/(auth)/login-v2')} />
      </View>
    </AuthShell>
  );
}

const s = themed(() => StyleSheet.create({
  step: { fontFamily: FONT.medium, fontSize: 12, fontWeight: '700', color: N.muted, marginBottom: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, borderWidth: 2 },
  iconWrap: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.display, fontSize: 17, fontWeight: '800', color: N.ink, marginBottom: 3 },
  text: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19, color: N.inkSub },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' },
  loginTxt: { fontFamily: FONT.body, fontSize: 14, color: N.inkSub },
}));
