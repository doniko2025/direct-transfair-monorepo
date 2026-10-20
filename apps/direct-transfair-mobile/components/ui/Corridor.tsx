// apps/direct-transfair-mobile/components/ui/Corridor.tsx
// =========================================================
// ÉLÉMENTS « CORRIDOR » v1.0 — Direct Transf'air
// Motifs partagés par l'accueil et la carte de solde : trame de points qui s'estompe vers les bords
// et capitales (ville + pays) pour le « couloir » d'envoi. Tout est dessiné en SVG (react-native-svg),
// aux couleurs du thème (forêt, soleil) : rien de figé par société.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** Trame de points 15 px, plus dense au centre (comme le masque elliptique de la maquette). */
export function DotGrid({ color = '#FFFFFF', opacity = 0.17, step = 15, style }: { color?: string; opacity?: number; step?: number; style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) setSize({ w: width, h: height });
  };
  const dots = useMemo(() => {
    const out: { x: number; y: number; o: number }[] = [];
    const { w, h } = size;
    if (!w || !h) return out;
    const cx = w * 0.5, cy = h * 0.55, rx = w * 0.8, ry = h * 0.9;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
        const k = d <= 0.2 ? 1 : d >= 1 ? 0 : 1 - (d - 0.2) / 0.8;
        if (k > 0.04) out.push({ x, y, o: opacity * k });
      }
    }
    return out;
  }, [size, step, opacity]);
  return (
    <View pointerEvents="none" onLayout={onLayout} style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, style]}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          {dots.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={1.4} fill={color} fillOpacity={d.o} />)}
        </Svg>
      )}
    </View>
  );
}

/** Capitales (code pays ISO-2 → ville) pour l'affichage « Paris / France ». Facultatif : sans entrée, seul le pays est affiché. */
const CAPITALS: Record<string, string> = {
  FR: 'Paris', BE: 'Bruxelles', DE: 'Berlin', ES: 'Madrid', IT: 'Rome', PT: 'Lisbonne', NL: 'Amsterdam', CH: 'Berne',
  GB: 'Londres', IE: 'Dublin', US: 'Washington', CA: 'Ottawa', LU: 'Luxembourg', AT: 'Vienne', SE: 'Stockholm', NO: 'Oslo',
  GN: 'Conakry', SN: 'Dakar', CI: 'Abidjan', ML: 'Bamako', BF: 'Ouagadougou', TG: 'Lomé', BJ: 'Porto-Novo', NE: 'Niamey',
  GW: 'Bissau', GM: 'Banjul', LR: 'Monrovia', SL: 'Freetown', CM: 'Yaoundé', GA: 'Libreville', CG: 'Brazzaville', CD: 'Kinshasa',
  MA: 'Rabat', DZ: 'Alger', TN: 'Tunis', EG: 'Le Caire', MR: 'Nouakchott', GH: 'Accra', NG: 'Abuja', CV: 'Praia',
  TD: "N'Djamena", CF: 'Bangui', DJ: 'Djibouti', KM: 'Moroni', MG: 'Antananarivo', AO: 'Luanda',
};
export function capitalOf(code?: string | null): string | undefined {
  return code ? CAPITALS[code.toUpperCase()] : undefined;
}
