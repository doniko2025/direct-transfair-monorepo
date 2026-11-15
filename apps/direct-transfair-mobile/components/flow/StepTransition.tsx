// apps/direct-transfair-mobile/components/flow/StepTransition.tsx
// =========================================================
// TRANSITION ENTRE ÉTAPES v1.0 — Direct Transf'air
// Enveloppe le contenu d'une étape de formulaire. À chaque changement de `stepKey` :
//   • le contenu glisse depuis la droite (étape suivante) ou depuis la gauche (retour) en fondu ;
//   • les champs arrivent ensuite EN CASCADE (léger décalage entre chacun) ;
// Respecte « réduire les animations » (affichage immédiat). Aucune couleur : le composant n'habille rien.
// Pilote natif (transform + opacity) : fluide même sur un téléphone d'entrée de gamme.
// =========================================================

import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from '../auth/AuthBackdrop';
import Reveal from './Reveal';

type Props = {
  /** Clé de l'étape affichée : un changement déclenche l'animation. */
  stepKey: string;
  /** Indice de l'étape : s'il augmente, on avance (glisse depuis la droite) ; s'il diminue, on recule. */
  index: number;
  children: React.ReactNode;
};

/**
 * Aplatit les fragments pour que chaque champ devienne un enfant à part entière (et donc se révèle en cascade).
 * Le rang compte AUSSI les enfants vides (condition fausse) : la clé d'un champ ne change donc jamais quand un autre apparaît ou disparaît
 * (sinon le champ serait recréé et le clavier se fermerait pendant la saisie).
 */
function flatten(nodes: React.ReactNode, counter = { n: 0 }): { pos: number; node: React.ReactNode }[] {
  const out: { pos: number; node: React.ReactNode }[] = [];
  React.Children.forEach(nodes, (n) => {
    if (React.isValidElement(n) && n.type === React.Fragment) {
      out.push(...flatten((n.props as any).children, counter));
      return;
    }
    const pos = counter.n++;
    if (n !== null && n !== undefined && n !== false && n !== true) out.push({ pos, node: n });
  });
  return out;
}

export default function StepTransition({ stepKey, index, children }: Props) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  const last = useRef(index);
  const dir = useRef(1);

  // Sens calculé AVANT le rendu de la nouvelle étape (pendant le rendu) : +1 = avance, −1 = recule.
  if (last.current !== index) { dir.current = index > last.current ? 1 : -1; last.current = index; }

  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    v.setValue(0);
    const anim = Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [stepKey, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = flatten(children);

  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.8, 1] }),
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [46 * dir.current, 0] }) }],
      }}
    >
      {items.map(({ pos, node }, i) => (
        // key = étape + rang stable : les champs rejouent leur apparition à chaque nouvelle étape, jamais pendant la saisie.
        <Reveal key={`${stepKey}-${pos}`} delay={90 + i * 70} distance={16} duration={420}>
          {node}
        </Reveal>
      ))}
    </Animated.View>
  );
}
