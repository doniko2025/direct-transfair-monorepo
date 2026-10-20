// src/components/BrandMark.tsx
// Logo de la société (si fourni) ou monogramme à la couleur de marque.
// ✅ phase 8 (logo « t’ ») : le logo de la plateforme (« t’ », déjà en tuile arrondie) s'affiche sans fond blanc ni arrondi ajouté.

import { useState } from 'react';
import { PLATFORM_LOGO_URL } from '../config';

export function BrandMark({
  name,
  logoUrl,
  size = 40,
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name.trim()[0] ?? 'D').toUpperCase();

  if (logoUrl && !failed) {
    return (
      <img
        className="brand-mark brand-mark--logo"
        style={logoUrl === PLATFORM_LOGO_URL ? { background: 'none', borderRadius: 0 } : undefined}
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="brand-mark brand-mark--monogram" style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  );
}
