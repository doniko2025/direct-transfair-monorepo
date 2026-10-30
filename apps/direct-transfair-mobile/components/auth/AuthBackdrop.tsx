// apps/direct-transfair-mobile/components/auth/AuthBackdrop.tsx
// =========================================================
// FOND ANIMÉ DES ÉCRANS D'AUTHENTIFICATION v1.0 — Direct Transf'air
//
// Deux couches, derrière le logo et la carte :
//   1. quatre halos qui dérivent lentement (couleurs de la société) ;
//   2. un « corridor » : un arc en pointillés entre deux points (l'expéditeur et le bénéficiaire) sur lequel deux étincelles
//      voyagent en continu, avec une onde douce à chaque extrémité. C'est le métier de l'app : de l'argent qui passe d'un
//      pays à l'autre.
// Tout est animé par le pilote natif (transformations et opacité) : aucune charge sur le fil JavaScript.
// Respecte « Réduire les animations » du système : fond statique (arc et halos fixes, pas d'étincelles).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { alpha } from './authTheme';

type Props = {
  /** Décalage vertical de la zone du corridor (sous la barre d'état). */
  top: number;
  /** Ordonnée du centre du logo, mesurée depuis `top` : le sommet de l'arc passe derrière lui. */
  centerY: number;
  /** De combien les deux extrémités descendent sous le centre du logo. */
  drop?: number;
  leaf: string;
  sun: string;
};

const ARC_H = 150;
const SAMPLES = 24;

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduce(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return reduce;
}

/** Boucle 0 → 1 (après un délai optionnel), pilote natif. */
function useLoop(duration: number, delay: number, enabled: boolean, easing = Easing.inOut(Easing.quad)): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) { v.setValue(0); return; }
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true })),
    ]);
    anim.start();
    return () => anim.stop();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/** Va-et-vient 0 ↔ 1 (halos qui dérivent). */
function usePingPong(duration: number, enabled: boolean): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) { v.setValue(0.5); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

function Orb({ size, style, color, progress, dx, dy }: {
  size: number; style: object; color: string; progress: Animated.Value; dx: number; dy: number;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
        {
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-dx, dx] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [dy, -dy] }) },
          ],
        },
      ]}
    />
  );
}

export default function AuthBackdrop({ top, centerY, drop = 32, leaf, sun }: Props) {
  const { width: W } = useWindowDimensions();
  const reduce = useReduceMotion();
  const live = !reduce;

  const drift1 = usePingPong(7000, live);
  const drift2 = usePingPong(9000, live);
  const drift3 = usePingPong(8000, live);

  const t1 = useLoop(3600, 0, live);
  const t2 = useLoop(3600, 1800, live);
  const pulse = useLoop(2200, 0, live, Easing.out(Easing.quad));

  // Arc : de gauche à droite, sommet (au milieu) caché derrière le logo.
  const half = Math.min(W * 0.4, 190);
  const cx = W / 2;
  const x0 = cx - half;
  const x2 = cx + half;
  const y = centerY + drop;       // hauteur des extrémités
  const cy = 2 * centerY - y;     // point de contrôle : le sommet de la courbe tombe pile sur centerY

  const { xs, ys } = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      xs.push(a * x0 + b * cx + c * x2);
      ys.push(a * y + b * cy + c * y);
    }
    return { xs, ys };
  }, [x0, x2, cx, cy, y]);

  const input = useMemo(() => xs.map((_, i) => i / SAMPLES), [xs]);
  const DOT = 8;

  const spark = (v: Animated.Value) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: -DOT / 2, top: -DOT / 2, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: sun,
        shadowColor: sun, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4,
        opacity: v.interpolate({ inputRange: [0, 0.06, 0.92, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: v.interpolate({ inputRange: input, outputRange: xs }) },
          { translateY: v.interpolate({ inputRange: input, outputRange: ys }) },
        ],
      }}
    />
  );

  const node = (x: number) => (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - 5, top: y - 5, width: 10, height: 10 }}>
      <Animated.View
        style={{
          position: 'absolute', left: 0, top: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: sun,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }],
        }}
      />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sun, opacity: 0.95 }} />
    </View>
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Halos qui dérivent */}
      <Orb size={260} style={{ top: -90, right: -90 }}    color={alpha(leaf, 0.24)} progress={drift1} dx={22} dy={18} />
      <Orb size={170} style={{ top: 170, left: -80 }}     color={alpha(sun, 0.13)}  progress={drift2} dx={18} dy={22} />
      <Orb size={230} style={{ bottom: -90, left: -60 }}  color={alpha(leaf, 0.17)} progress={drift3} dx={20} dy={16} />
      <Orb size={110} style={{ bottom: 140, right: -40 }} color="rgba(255,255,255,0.07)" progress={drift2} dx={14} dy={14} />

      {/* Corridor */}
      <View style={{ position: 'absolute', top, left: 0, width: W, height: ARC_H }}>
        <Svg width={W} height={ARC_H} style={StyleSheet.absoluteFill}>
          <Path
            d={`M ${x0} ${y} Q ${cx} ${cy} ${x2} ${y}`}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray="1 7"
            fill="none"
          />
        </Svg>
        {node(x0)}
        {node(x2)}
        {live ? spark(t1) : null}
        {live ? spark(t2) : null}
      </View>
    </View>
  );
}
