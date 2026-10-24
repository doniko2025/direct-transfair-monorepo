// apps/web-admin/src/pages/companies/AppearancePreview.tsx
// Aperçu de la page de connexion de la société (couleurs, slogan, logo). Partagé entre la fiche société (édition de
// l'apparence) et le formulaire de création : on voit le résultat pendant la saisie.

import { useEffect, useState } from 'react';
import { readableOn } from '../../lib/colors';
import { safeColor } from '../../lib/companyRules';
import { isDisplayableLogo } from '../../lib/logoImage';

export function AppearancePreview({ draft }: { draft: Record<string, string> }) {
  const primary = safeColor(draft.primaryColor, '#059669');
  const accent = safeColor(draft.secondaryColor, '#10B981');
  const logo = isDisplayableLogo(draft.logoUrl) ? draft.logoUrl : '';

  // Un logo introuvable ne doit pas laisser une image cassée : on retombe sur la pastille de couleur.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [logo]);

  return (
    <div className="preview" aria-label="Aperçu de la page de connexion">
      <div className="preview__brand" style={{ background: primary, color: readableOn(primary) }}>
        {logo && !broken ? (
          <img
            src={logo}
            alt=""
            onError={() => setBroken(true)}
            style={{ height: 30, maxWidth: '60%', objectFit: 'contain', justifySelf: 'start' }}
          />
        ) : (
          <span className="preview__dot" style={{ background: accent }} aria-hidden="true" />
        )}
        <strong style={draft.fontFamily ? { fontFamily: `"${draft.fontFamily}", inherit` } : undefined}>
          {draft.tagline || 'Votre slogan apparaît ici'}
        </strong>
      </div>
      <div className="preview__form" aria-hidden="true">
        <span />
        <span />
        <i style={{ background: primary }} />
      </div>
    </div>
  );
}
