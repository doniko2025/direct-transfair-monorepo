// src/components/Rosette.tsx
// Rosace de type « guilloché », le motif de sécurité des billets de banque.
// Générée par le calcul : une famille de courbes r(θ) = R + a·sin(kθ + δᵢ)
// dont les phases décalées créent le moiré caractéristique.
// Un seul mouvement : le tracé se dessine à l'ouverture de la page
// (désactivé si l'utilisateur préfère réduire les animations — voir base.css).

import { useMemo, type CSSProperties } from 'react';

interface RosetteProps {
  className?: string;
  /** Nombre de courbes de la famille principale. */
  layers?: number;
  /** Nombre de lobes (k). */
  lobes?: number;
}

const SIZE = 640;
const CENTER = SIZE / 2;
const STEPS = 220;

function curve(radius: number, amplitude: number, lobes: number, phase: number): string {
  let d = '';
  for (let s = 0; s <= STEPS; s += 1) {
    const t = (s / STEPS) * Math.PI * 2;
    const r = radius + amplitude * Math.sin(lobes * t + phase);
    const x = CENTER + r * Math.cos(t);
    const y = CENTER + r * Math.sin(t);
    d += `${s === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

export function Rosette({ className, layers = 34, lobes = 7 }: RosetteProps) {
  const paths = useMemo(() => {
    const main = Array.from({ length: layers }, (_, i) =>
      curve(168, 92, lobes, (i / layers) * Math.PI),
    );
    const inner = Array.from({ length: Math.round(layers / 2) }, (_, i) =>
      curve(70, 34, lobes + 4, (i / (layers / 2)) * Math.PI * 1.5),
    );
    return [...main, ...inner];
  }, [layers, lobes]);

  return (
    <svg
      className={['rosette', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength={1}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </svg>
  );
}
