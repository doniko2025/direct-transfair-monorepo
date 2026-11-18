// src/lib/keyboardFit.ts
// Saisie sur téléphone : le clavier ne doit jamais cacher le champ en cours.
//   • <meta viewport interactive-widget=resizes-content> (index.html) : la page se redimensionne au-dessus du clavier ;
//   • ici : à chaque prise de focus, le champ est ramené au centre de la zone visible, une fois le clavier ouvert ;
//   • les champs de montant / numériques perdent la barre de suggestions (clés, cartes, adresses) qui ajoute une rangée
//     au clavier sans rien apporter sur un montant.
// Sans effet sur ordinateur (pas de clavier à l'écran).

const FIELD = 'input, textarea, select';
const SKIP_TYPES = new Set(['checkbox', 'radio', 'file', 'button', 'submit', 'range', 'color', 'hidden']);

function isField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!(el instanceof HTMLElement) || !el.matches(FIELD)) return false;
  return !(el instanceof HTMLInputElement && SKIP_TYPES.has(el.type));
}

function reveal(el: HTMLElement): void {
  if (!el.isConnected || document.activeElement !== el) return;
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

let installed = false;

export function installKeyboardFit(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!isField(el)) return;

    // Barre de suggestions du clavier : inutile sur un montant ou un code (on ne touche jamais aux mots de passe ni aux e-mails).
    if (el instanceof HTMLInputElement && !el.hasAttribute('autocomplete')) {
      const mode = el.inputMode;
      if (mode === 'numeric' || mode === 'decimal' || el.type === 'number') el.setAttribute('autocomplete', 'off');
    }

    // Le clavier met ~250 ms à s'ouvrir : on recadre juste après, puis une seconde fois pour les claviers lents.
    window.setTimeout(() => reveal(el), 280);
    window.setTimeout(() => reveal(el), 650);
  });

  // Quand la zone visible change (ouverture / fermeture du clavier, rotation), le champ actif reste visible.
  window.visualViewport?.addEventListener('resize', () => {
    const el = document.activeElement;
    if (isField(el)) window.setTimeout(() => reveal(el), 60);
  });
}
