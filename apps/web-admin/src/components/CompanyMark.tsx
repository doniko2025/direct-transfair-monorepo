// src/components/CompanyMark.tsx
// Marque d'une société CLIENTE affichée dans les listes : logo si fourni, sinon monogramme
// à sa couleur. Distinct de BrandMark, qui représente le portail courant (couleur --brand).

import { useState } from 'react';
import { readableOn } from '../lib/colors';
import { safeColor } from '../lib/companyRules';

export function CompanyMark({
  name,
  logoUrl,
  color,
  size = 48,
}: {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const bg = safeColor(color, '#059669');

  if (logoUrl && !failed) {
    return (
      <img
        className="company-mark company-mark--logo"
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
    <span
      className="company-mark"
      style={{ width: size, height: size, background: bg, color: readableOn(bg), fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}
