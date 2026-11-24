// apps/direct-transfair-mobile/components/brand/BrandLogo.tsx
// =========================================================
// LOGO DE LA SOCIÉTÉ v1.0 — Direct Transf'air
// UN SEUL composant, UNE seule taille standard (BRAND_LOGO_SIZE) partout dans l'app : accueil, connexion, inscription, codes…
//
// REDIMENSIONNEMENT AUTOMATIQUE
//   • On lit les dimensions réelles de l'image (une seule fois par adresse, mises en cache) et on en déduit son ratio.
//   • Logo carré (ou presque) → carré de `size` × `size` px, coins arrondis proportionnels : AUCUNE tuile ni cadre autour,
//     le contenant a donc exactement la forme du logo (fini le logo carré posé dans une tuile d'une autre forme).
//   • Logo large (ex. texte + symbole) → largeur jusqu'à 2,4 × `size`, hauteur déduite du ratio : jamais déformé ni rogné.
//   • Logo haut → hauteur `size`, largeur déduite.
//   • Image introuvable / lien cassé / hors ligne → marque de secours : monogramme de la plateforme (société système) ou, pour une société,
//     SES initiales sur sa couleur d'accent. Jamais le logo de la plateforme ni celui d'une autre société (séparation des rôles).
// COULEURS : la marque de secours utilise les couleurs du super admin (useUI) ; le logo, lui, est affiché tel quel.
// =========================================================

import React, { useEffect, useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTenant } from '../../providers/TenantProvider';
import { useUI } from '../ui/theme';
import { TenantMark } from './BrandMark';

/** Taille standard du logo, identique sur tous les écrans. */
export const BRAND_LOGO_SIZE = 80;

// Ratios (largeur / hauteur) déjà connus : évite tout « saut » d'affichage quand on change d'écran.
const ratioCache = new Map<string, number>();

function useImageRatio(uri: string | null): number | null {
  const [ratio, setRatio] = useState<number | null>(uri ? (ratioCache.get(uri) ?? null) : null);
  useEffect(() => {
    if (!uri) { setRatio(null); return; }
    const known = ratioCache.get(uri);
    if (known) { setRatio(known); return; }
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        const r = w > 0 && h > 0 ? w / h : 1;
        ratioCache.set(uri, r);
        if (alive) setRatio(r);
      },
      () => { if (alive) setRatio(1); },   // dimensions illisibles : on suppose un carré, onError (ci-dessous) gère le lien cassé
    );
    return () => { alive = false; };
  }, [uri]);
  return ratio;
}

export default function BrandLogo({ size = BRAND_LOGO_SIZE, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const { branding } = useTenant();
  const { C } = useUI();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const uri = branding.logoUrl && /^(https?:|data:)/i.test(branding.logoUrl) && branding.logoUrl !== failedUrl ? branding.logoUrl : null;
  const ratio = useImageRatio(uri);

  // Pas de logo exploitable : marque de secours à la même taille standard.
  if (!uri) {
    return <TenantMark size={size} radius={Math.round(size * 0.24)} background={C.accent} iconColor={C.accentInk} logoScale={0.78} style={style} />;
  }

  const r = ratio ?? 1;
  const maxW = size * 2.4;
  // Carré : size × size. Large : plafonné à maxW. Haut : hauteur = size.
  const w = r >= 1 ? Math.min(size * r, maxW) : size * r;
  const h = r >= 1 ? w / r : size;
  const squareish = r > 0.87 && r < 1.15;
  const radius = Math.round(Math.min(w, h) * (squareish ? 0.22 : 0.1));

  return (
    <View style={[{ width: w, height: h, borderRadius: radius, overflow: 'hidden', alignSelf: 'center' }, style]}>
      <Image
        source={{ uri }}
        onError={() => setFailedUrl(uri)}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
        accessibilityLabel={branding.name}
      />
    </View>
  );
}
