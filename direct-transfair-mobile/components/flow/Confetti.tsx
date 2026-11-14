// apps/direct-transfair-mobile/components/flow/Confetti.tsx
// =========================================================
// CONFETTI v1.0 — Direct Transf'air
// Petite explosion de confettis à l'arrivée sur la page de succès. Une seule fois, ~2,4 s, puis tout disparaît (rien ne reste monté
// à l'écran). Animation native (transform + opacité) : fluide, sans coût pour le fil JavaScript.
// COULEURS : 100 % dynamiques — palette tirée de useUI() (couleur principale, accent, vert de succès de la société) ; aucune couleur
// écrite en dur. Respecte « réduire les animations » : le composant n'affiche alors rien.
// ✅ pointerEvents="none" : ne gêne jamais les boutons placés dessous.
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, useWindowDimensions } from 'react-native';
import { useUI } from '../ui';
import { useReduceMotion } from '../auth/AuthBackdrop';

type Piece = { dx: number; up: number; fall: number; rot: number; size: number; round: boolean; color: number; delay: number; dur: number };

export default function Confetti({ count = 30, originY = 56 }: { count?: number; originY?: number }) {
  const { C } = useUI();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const [alive, setAlive] = useState(true);
  const progress = useRef<Animated.Value[]>([]).current;
  while (progress.length < count) progress.push(new Animated.Value(0));

  const palette = [C.sun, C.accent, C.accentDeep, C.pos, C.accentLine];
  const spread = Math.min(width, 480) * 0.5;

  const pieces = useMemo<Piece[]>(
    () => Array.from({ length: count }, () => ({
      dx: (Math.random() * 2 - 1) * spread,
      up: 60 + Math.random() * 120,
      fall: 240 + Math.random() * 220,
      rot: (Math.random() * 2 - 1) * 540,
      size: 7 + Math.random() * 6,
      round: Math.random() > 0.65,
      color: Math.floor(Math.random() * 5),
      delay: Math.random() * 220,
      dur: 1700 + Math.random() * 800,
    })),
    [count, spread],
  );

  useEffect(() => {
    if (reduce) return;
    const anims = pieces.map((p, i) =>
      Animated.timing(progress[i], { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    Animated.parallel(anims).start(() => setAlive(false));
  }, [reduce, pieces]); // eslint-disable-line react-hooks/exhaustive-deps

  if (reduce || !alive) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 0, alignItems: 'center', zIndex: 10 }}>
      {pieces.map((p, i) => {
        const v = progress[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: originY,
              width: p.size,
              height: p.round ? p.size : p.size * 0.55,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: palette[p.color % palette.length],
              opacity: v.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, -p.up, p.fall] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
