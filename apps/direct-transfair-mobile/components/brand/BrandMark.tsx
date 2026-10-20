// apps/direct-transfair-mobile/components/brand/BrandMark.tsx
// =========================================================
// MARQUE « t’ » v1.0 — Direct Transf'air
// ✅ v1.0 : nouvelle identité visuelle (monogramme « t’ » : un t blanc et une apostrophe jaune qui arrive en
//    étincelle). Deux composants :
//      • <BrandMark />  — le monogramme seul (tuile verte + t + apostrophe), dessiné en SVG (net à toutes les
//        tailles), statique ou animé (le t se dessine, l'apostrophe file jusqu'à sa place et s'écrase, une onde
//        se propage). L'animation respecte « Réduire les animations » du système.
//      • <TenantMark /> — la marque à afficher pour la société courante (white-label) :
//          1. la société a un logo (logoUrl) → son logo, dans une tuile à sa couleur d'accent (priorité inchangée) ;
//          2. sinon, société = plateforme → le monogramme « t’ » ;
//          3. sinon (autre société sans logo) → icône neutre « échange ».
//    Aucun nom ni domaine en dur : le nom reste fourni par la configuration du tenant.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { Ionicons } from '../ui/Icon';
import { isPlatformCode } from '../../services/platformConfig';
import { useTenant } from '../../providers/TenantProvider';

// Palette du monogramme (identité graphique de la plateforme).
export const BRAND_MARK_COLORS = {
  tile: '#0E3B2D',   // forêt
  line: '#46C58C',   // feuille (liseré de la tuile)
  ink: '#E8F0EA',    // brume (le « t »)
  spark: '#F5C32C',  // soleil (l'apostrophe)
} as const;

type BrandMarkProps = {
  /** Côté du carré, en pixels. */
  size?: number;
  /** Joue l'animation d'entrée (sauf si le système demande de réduire les animations). */
  animated?: boolean;
  /** Rejoue l'animation en boucle (toutes les `loopEvery` ms, défaut 6 s). */
  loop?: boolean;
  loopEvery?: number;
  /** Supprime la tuile (monogramme seul, pour poser le « t’ » sur un fond déjà coloré). */
  bare?: boolean;
  /** Couleur du « t » quand `bare` (défaut : brume). */
  inkColor?: string;
  /** Couleur de l'apostrophe (défaut : soleil). */
  sparkColor?: string;
  style?: StyleProp<ViewStyle>;
};

// Longueurs approximatives des tracés (viewBox 200) pour l'animation « le t se dessine ».
const STEM_LEN = 140;
const BAR_LEN = 70;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function BrandMark({
  size = 64, animated = false, loop = false, loopEvery = 6000, bare = false, inkColor, sparkColor, style,
}: BrandMarkProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const k = size / 200; // échelle viewBox → pixels
  const ink = inkColor ?? BRAND_MARK_COLORS.ink;
  const spark = sparkColor ?? BRAND_MARK_COLORS.spark;

  const tile   = useRef(new Animated.Value(1)).current; // pop de la tuile (JS : opacité + échelle)
  const stem   = useRef(new Animated.Value(0)).current; // 0 = tracé caché, 1 = tracé complet
  const bar    = useRef(new Animated.Value(0)).current;
  const shoot  = useRef(new Animated.Value(1)).current; // 0 = arrivée, 1 = départ (hors cadre, étiré)
  const tilt   = useRef(new Animated.Value(1)).current; // 0 = 18°, 1 = 90°
  const settle = useRef(new Animated.Value(1)).current; // 0 = repos, 1 = écrasé
  const ring   = useRef(new Animated.Value(1)).current; // 0 = départ de l'onde, 1 = fin

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduceMotion(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const playing = animated && !reduceMotion;

  useEffect(() => {
    const rest = () => { tile.setValue(1); stem.setValue(1); bar.setValue(1); shoot.setValue(0); tilt.setValue(0); settle.setValue(0); ring.setValue(1); };
    if (!playing) { rest(); return; }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: Animated.CompositeAnimation | undefined;

    const play = () => {
      tile.setValue(0); stem.setValue(0); bar.setValue(0); shoot.setValue(1); tilt.setValue(1); settle.setValue(1); ring.setValue(0);
      running = Animated.parallel([
        Animated.timing(tile, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.6)), useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(250),
          Animated.timing(stem, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.delay(750),
          Animated.timing(bar, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.delay(1000),
          Animated.parallel([
            Animated.timing(shoot, { toValue: 0, duration: 900, easing: Easing.bezier(0.1, 0.85, 0.2, 1), useNativeDriver: false }),
            Animated.timing(tilt, { toValue: 0, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          ]),
          Animated.timing(settle, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(2.2)), useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.delay(1900),
          Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ]),
      ]);
      running.start(({ finished }) => {
        if (finished && loop && !stopped) timer = setTimeout(play, Math.max(0, loopEvery - 2800));
      });
    };

    play();
    return () => { stopped = true; if (timer) clearTimeout(timer); running?.stop(); };
  }, [playing, loop, loopEvery]); // eslint-disable-line react-hooks/exhaustive-deps

  // — Dérivées d'animation —
  const stemOffset = stem.interpolate({ inputRange: [0, 1], outputRange: [STEM_LEN, 0] });
  const barOffset  = bar.interpolate({ inputRange: [0, 1], outputRange: [BAR_LEN, 0] });
  // Le bout arrondi d'un tracé « vide » laisse un point : on masque le tracé tant qu'il n'a pas commencé.
  const stemOpac   = stem.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] });
  const barOpac    = bar.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] });
  const tileScale  = tile.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const tileOpac   = tile.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });
  const sparkX     = shoot.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 1.6] });
  const sparkStretch = shoot.interpolate({ inputRange: [0, 1], outputRange: [1, 7] });
  const sparkRot     = tilt.interpolate({ inputRange: [0, 1], outputRange: ['18deg', '90deg'] });
  const settleX      = settle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const settleY      = settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
  const ringScale  = ring.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.4] });
  const ringOpac   = ring.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 0.9, 0] });

  const capW = 16 * k;            // épaisseur de la capsule
  const capH = 28 * k + capW;     // longueur (segment + bouts arrondis)
  const cx = 152 * k;
  const cy = 48 * k;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Logo : un t suivi d'une apostrophe jaune"
    >
      <Animated.View style={{ width: size, height: size, opacity: playing ? tileOpac : 1, transform: [{ scale: playing ? tileScale : 1 }] }}>
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
          {!bare && (
            <Rect x={1} y={1} width={198} height={198} rx={52} fill={BRAND_MARK_COLORS.tile} stroke={BRAND_MARK_COLORS.line} strokeOpacity={0.4} strokeWidth={2} />
          )}
          <AnimatedPath
            d="M88 44 V124 Q88 154 118 154 Q128 154 136 150"
            stroke={ink} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={playing ? `${STEM_LEN} ${STEM_LEN}` : undefined}
            strokeDashoffset={playing ? (stemOffset as unknown as number) : undefined}
            strokeOpacity={playing ? (stemOpac as unknown as number) : undefined}
          />
          <AnimatedPath
            d="M56 82 H124"
            stroke={ink} strokeWidth={20} strokeLinecap="round"
            strokeDasharray={playing ? `${BAR_LEN} ${BAR_LEN}` : undefined}
            strokeDashoffset={playing ? (barOffset as unknown as number) : undefined}
            strokeOpacity={playing ? (barOpac as unknown as number) : undefined}
          />
          {!playing && (
            <G transform="translate(152 48) rotate(18)">
              <Line x1={0} y1={-14} x2={0} y2={14} stroke={spark} strokeWidth={16} strokeLinecap="round" />
            </G>
          )}
        </Svg>
      </Animated.View>

      {playing && (
        <>
          {/* Onde qui se propage quand l'apostrophe arrive */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', left: cx - 22 * k, top: cy - 22 * k, width: 44 * k, height: 44 * k, borderRadius: 22 * k,
              borderWidth: Math.max(1, 3 * k), borderColor: spark,
              opacity: ringOpac, transform: [{ scale: ringScale }],
            }}
          />
          {/* Apostrophe : arrive en étincelle, se redresse, s'écrase puis se pose */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', left: cx - capW / 2, top: cy - capH / 2, width: capW, height: capH, borderRadius: capW / 2,
              backgroundColor: spark,
              transform: [{ translateX: sparkX }, { scaleX: sparkStretch }, { rotate: sparkRot }, { scaleX: settleX }, { scaleY: settleY }],
            }}
          />
        </>
      )}
    </View>
  );
}

type TenantMarkProps = {
  size?: number;
  /** Rayon de la tuile quand c'est un logo de société ou l'icône neutre (défaut : 0,3 × taille). */
  radius?: number;
  /** Fond de la tuile d'un logo de société (couleur d'accent du tenant). */
  background: string;
  /** Couleur de l'icône neutre. */
  iconColor: string;
  /** Part de la tuile occupée par le logo d'une société (défaut 0,75). */
  logoScale?: number;
  animated?: boolean;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TenantMark({
  size = 38, radius, background, iconColor, logoScale = 0.75, animated = false, loop = false, style,
}: TenantMarkProps) {
  const { branding } = useTenant();
  const r = radius ?? Math.round(size * 0.3);

  if (!branding.logoUrl && isPlatformCode(branding.code)) {
    return <BrandMark size={size} animated={animated} loop={loop} style={style} />;
  }

  return (
    <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {branding.logoUrl
        ? <Image source={{ uri: branding.logoUrl }} style={{ width: `${logoScale * 100}%`, height: `${logoScale * 100}%` }} resizeMode="contain" />
        : <Ionicons name="swap-horizontal" size={Math.round(size * 0.5)} color={iconColor} />}
    </View>
  );
}
