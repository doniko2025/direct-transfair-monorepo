// apps/direct-transfair-mobile/components/flow/Reveal.tsx
// =========================================================
// REVEAL v1.0 — Direct Transf'air
// Apparition douce d'un bloc (fondu + glissement vers le haut), avec un délai pour faire arriver les éléments « en cascade ».
// Respecte l'option système « réduire les animations » : le bloc est alors affiché tout de suite.
// ✅ v1.1 : prop `fromX` (glissement horizontal, utilisée par les étapes de l'écran de connexion). Sans elle : rendu inchangé.
// Aucune couleur ici : le composant n'habille rien, il anime seulement ce qu'on lui donne.
// =========================================================

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from '../auth/AuthBackdrop';

type Props = {
  children: React.ReactNode;
  /** Délai avant le début (ms). */
  delay?: number;
  /** Distance du glissement (px, positive = vient du bas). */
  distance?: number;
  duration?: number;
  /** Ajoute un léger effet de « rebond » (pastilles, coches). */
  pop?: boolean;
  /** Glissement horizontal (px, positif = vient de la droite, négatif = vient de la gauche) à la place du glissement vertical. */
  fromX?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Reveal({ children, delay = 0, distance = 14, duration = 480, pop = false, fromX, style }: Props) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    v.setValue(0);
    const anim = pop
      ? Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true })])
      : Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, delay, duration, pop]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [
            pop
              ? { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }
              : fromX !== undefined
                ? { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) }
                : { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
