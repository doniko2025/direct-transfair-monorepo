// src/components/RefreshButton.tsx
// Bouton « Actualiser » compact (icône seule) pour les barres d'outils.
// Visible uniquement sur mobile (voir styles/mobile-layout.css) : sur grand écran, le bouton
// texte « Actualiser » de l'en-tête de page reste en place. Sur mobile, il vient se ranger
// sur la même ligne que la recherche ou le filtre principal.

import { Button } from './ui';

export function RefreshButton({ onClick, busy = false }: { onClick: () => void; busy?: boolean }) {
  return (
    <Button
      variant="secondary"
      icon="refresh"
      className="toolbar__refresh"
      onClick={onClick}
      busy={busy}
      aria-label="Actualiser"
      title="Actualiser"
    />
  );
}
