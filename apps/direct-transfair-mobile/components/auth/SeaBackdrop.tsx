// apps/direct-transfair-mobile/components/auth/SeaBackdrop.tsx
// =========================================================
// FOND « MER » DES ÉCRANS D'AUTHENTIFICATION v1.0 — Direct Transf'air
//
// Eau claire et légère (dégradé bleu très doux, rayons de lumière, bulles) avec seulement des poissons bleus et verts, à peine plus soutenus
// que l'eau : ils s'y fondent. Fond de sable pâle et algues en bas. Tout est dessiné en SVG (net à toutes les tailles, aucune image à charger).
// Les poissons et les bulles flottent doucement (pilote natif : transformations seulement). « Réduire les animations » du système = rendu fixe.
// Posé derrière le contenu (pointerEvents none) ; AuthShell l'utilise via sa prop `sea`.
// =========================================================

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Polygon } from 'react-native-svg';

import { useReduceMotion } from './AuthBackdrop';

type FishSpec = { x: number; y: number; w: number; body: string; tail: string; flip?: boolean; stripe?: boolean; amp: number; dur: number };

// Positions en fractions de l'écran : haut (autour de l'emblème) et bas (sous la carte). Bleus et verts uniquement, peu contrastés avec l'eau.
const FISH: FishSpec[] = [
  { x: 0.06, y: 0.075, w: 46, body: '#7CC6E2', tail: '#5DB2D6', amp: 9,  dur: 5200 },
  { x: 0.78, y: 0.095, w: 40, body: '#79D2BE', tail: '#5BBFA9', flip: true, amp: 8, dur: 6100 },
  { x: 0.2,  y: 0.175, w: 30, body: '#6EBBDD', tail: '#4FA6CC', amp: 7,  dur: 4700, stripe: true },
  { x: 0.7,  y: 0.2,   w: 34, body: '#8ADBC8', tail: '#69C8B2', flip: true, amp: 8, dur: 5600 },
  { x: 0.05, y: 0.8,   w: 52, body: '#6FB7DD', tail: '#4E9FCB', amp: 10, dur: 6400, stripe: true },
  { x: 0.74, y: 0.78,  w: 44, body: '#6FCDB5', tail: '#4FB89F', flip: true, amp: 9, dur: 5300 },
  { x: 0.34, y: 0.85,  w: 36, body: '#8BCDE8', tail: '#69B8DA', amp: 8,  dur: 4900 },
  { x: 0.6,  y: 0.88,  w: 34, body: '#7DD6C2', tail: '#5CC1AB', flip: true, amp: 7, dur: 5800, stripe: true },
  { x: 0.12, y: 0.93,  w: 28, body: '#79C0E3', tail: '#59ABD3', amp: 6,  dur: 4400 },
  { x: 0.82, y: 0.94,  w: 30, body: '#86D8C6', tail: '#66C4AF', flip: true, amp: 6, dur: 5000 },
];

const BUBBLES: { x: number; y: number; r: number }[] = [
  { x: 0.08, y: 0.2,  r: 7 }, { x: 0.14, y: 0.15, r: 4 }, { x: 0.9,  y: 0.15, r: 6 }, { x: 0.84, y: 0.24, r: 4 },
  { x: 0.1,  y: 0.74, r: 8 }, { x: 0.9,  y: 0.72, r: 5 }, { x: 0.52, y: 0.8,  r: 6 }, { x: 0.28, y: 0.9,  r: 4 },
];

function Fish({ w, body, tail, flip, stripe }: Pick<FishSpec, 'w' | 'body' | 'tail' | 'flip' | 'stripe'>) {
  return (
    <Svg width={w} height={Math.round(w * 0.59)} viewBox="0 0 44 26" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Ellipse cx="22" cy="13" rx="17" ry="9" fill={body} />
      <Path d="M38 13 L48 3 L48 23Z" fill={tail} />
      <Circle cx="13" cy="11" r="1.9" fill="#1D5570" opacity={0.75} />
      {stripe ? <Path d="M21 5 Q25 13 21 21" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity={0.55} /> : null}
    </Svg>
  );
}

/** Balancement lent et continu (aller-retour), démarré avec un décalage pour que les poissons ne bougent pas en bloc. */
function useSway(dur: number, delay: number, still: boolean): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { v.setValue(0.5); return; }
    v.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), delay, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dur, delay, still]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

function Floating({ left, top, amp, dur, delay, still, children }: {
  left: number; top: number; amp: number; dur: number; delay: number; still: boolean; children: React.ReactNode;
}) {
  const v = useSway(dur, delay, still);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left, top,
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-amp, amp] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [amp * 0.35, -amp * 0.35] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function SeaBackdrop() {
  const { width: W, height: H } = useWindowDimensions();
  const still = useReduceMotion();
  const sandH = Math.round(Math.min(150, H * 0.17));

  const rays = useMemo(() => (
    <Svg width={W} height={H * 0.7} viewBox={`0 0 ${W} ${H * 0.7}`} style={StyleSheet.absoluteFill}>
      <Polygon points={`${W * 0.08},0 ${W * 0.22},0 ${W * 0.5},${H * 0.7} ${W * 0.2},${H * 0.7}`} fill="#FFFFFF" opacity={0.2} />
      <Polygon points={`${W * 0.38},0 ${W * 0.46},0 ${W * 0.8},${H * 0.7} ${W * 0.62},${H * 0.7}`} fill="#FFFFFF" opacity={0.14} />
      <Polygon points={`${W * 0.7},0 ${W * 0.8},0 ${W * 1.05},${H * 0.7} ${W * 0.9},${H * 0.7}`} fill="#FFFFFF" opacity={0.16} />
    </Svg>
  ), [W, H]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Eau claire et transparente : du bleu à peine teinté en haut, un peu plus d'eau vers le bas. */}
      <LinearGradient colors={['#EEF9FB', '#D3ECF4', '#B2DBEA']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {rays}

      {BUBBLES.map((b, i) => (
        <Floating key={`b${i}`} left={b.x * W} top={b.y * H} amp={4} dur={3600 + i * 350} delay={i * 220} still={still}>
          <View style={{ width: b.r * 2, height: b.r * 2, borderRadius: b.r, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </Floating>
      ))}

      {FISH.map((f, i) => (
        <Floating key={`f${i}`} left={f.x * W} top={f.y * H} amp={f.amp} dur={f.dur} delay={i * 300} still={still}>
          <View style={{ opacity: 0.82 }}><Fish w={f.w} body={f.body} tail={f.tail} flip={f.flip} stripe={f.stripe} /></View>
        </Floating>
      ))}

      {/* Fond marin : sable pâle et algues */}
      <Svg width={W} height={sandH} viewBox="0 0 390 120" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Path d="M0 50 Q60 20 130 46 T260 40 T390 30 V120 H0Z" fill="#E6E3C6" opacity={0.7} />
        <Path d="M0 80 Q80 56 160 76 T320 70 T390 66 V120 H0Z" fill="#F1EBCB" opacity={0.95} />
        <Path d="M40 72 q-4 -26 4 -40 q4 18 2 40z" fill="#5FBFA6" opacity={0.85} />
        <Path d="M52 74 q2 -22 12 -34 q-2 20 -6 34z" fill="#4AAF96" opacity={0.85} />
        <Path d="M340 76 q-6 -30 4 -46 q6 22 2 46z" fill="#5FBFA6" opacity={0.85} />
      </Svg>
    </View>
  );
}
