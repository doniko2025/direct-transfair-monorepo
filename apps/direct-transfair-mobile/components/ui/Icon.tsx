// apps/direct-transfair-mobile/components/ui/Icon.tsx
// =========================================================
// ICÔNES v1.0 — Direct Transf'air (design « Corridor »)
// Trait fin arrondi de la famille Lucide (tracés dans iconNodes.ts, rendu react-native-svg).
//   • <Icon name="send" />                : noms Lucide ;
//   • <Ionicons name="paper-plane" />     : remplaçant direct d'Ionicons — les noms existants sont
//     traduits en Lucide ; un nom inconnu retombe sur la vraie police Ionicons (rien ne disparaît).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React from 'react';
import { Ionicons as RealIonicons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { ION_TO_LUCIDE, LUCIDE } from './iconNodes';

export const ICON_STROKE = 1.9;

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Remplit la forme (cercle de l'onglet actif, etc.). */
  fill?: string;
  style?: StyleProp<ViewStyle>;
};

const TAGS: Record<string, React.ComponentType<any>> = { path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline, polygon: Polygon, ellipse: Ellipse };

export function hasIcon(name: string): boolean {
  return !!LUCIDE[name] || !!LUCIDE[ION_TO_LUCIDE[name]];
}

export function Icon({ name, size = 24, color = '#10231B', strokeWidth = ICON_STROKE, fill, style }: IconProps) {
  const nodes = LUCIDE[name] ?? LUCIDE[ION_TO_LUCIDE[name]];
  if (!nodes) return <RealIonicons name={name as any} size={size} color={color} style={style as any} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {nodes.map(([tag, attrs], i) => {
        const Tag = TAGS[tag];
        return Tag ? <Tag key={i} {...attrs} {...(fill ? { fill } : {})} /> : null;
      })}
    </Svg>
  );
}

/** Remplaçant d'Ionicons (même signature : name, size, color, style). */
function IoniconsLike({ name, size, color, style }: { name: string; size?: number; color?: string; style?: StyleProp<any> }) {
  return <Icon name={name} size={size} color={color} style={style} />;
}
export const Ionicons = Object.assign(IoniconsLike, { glyphMap: ION_TO_LUCIDE as Record<string, string> });

export default Icon;
