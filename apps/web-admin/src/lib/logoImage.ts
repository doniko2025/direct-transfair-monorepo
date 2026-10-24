// apps/web-admin/src/lib/logoImage.ts
// Importer un logo depuis l'appareil (ordinateur ou téléphone : galerie, appareil photo, fichiers).
// L'image est lue dans le navigateur, redimensionnée (256 px au plus, transparence conservée) puis convertie en
// « data URL » qui part dans Client.logoUrl. Le serveur borne la taille (le corps d'une requête JSON est limité à
// 100 Ko) : on vise 90 000 caractères au plus, en réduisant la taille puis la qualité si nécessaire.

/** Taille maximale du fichier choisi (avant réduction). */
export const MAX_LOGO_FILE_BYTES = 10 * 1024 * 1024;
/** Longueur maximale de la data URL produite (le serveur accepte jusqu'à 100 000). */
export const MAX_LOGO_DATA_CHARS = 90_000;

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
const SIZES = [256, 192, 128, 96];

export function isImportedLogo(value: string | null | undefined): boolean {
  return /^data:image\//i.test(value ?? '');
}

export function isWebLogo(value: string | null | undefined): boolean {
  return /^https?:\/\/\S+$/i.test(value ?? '');
}

/** Peut-on afficher cette valeur comme image ? (adresse web ou image importée) */
export function isDisplayableLogo(value: string | null | undefined): boolean {
  return isImportedLogo(value) || isWebLogo(value);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire cette image. Essayez un autre fichier (PNG, JPG, WebP, GIF ou SVG)."));
    };
    img.src = url;
  });
}

function render(img: HTMLImageElement, size: number, background: string | null): HTMLCanvasElement {
  const naturalW = img.naturalWidth || size;
  const naturalH = img.naturalHeight || size;
  const longest = Math.max(naturalW, naturalH);
  // Une image raster plus petite que la cible n'est pas agrandie ; un SVG (sans dimensions utiles) est tracé à la cible.
  const scale = img.naturalWidth && img.naturalHeight ? Math.min(1, size / longest) : size / longest;
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Votre navigateur ne permet pas de préparer l'image.");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Prépare le logo choisi : vérifie le fichier, le réduit et renvoie une data URL (PNG si possible, sinon WebP puis JPEG).
 * Lève une Error au message lisible en cas de problème.
 */
export async function prepareLogo(file: File): Promise<string> {
  const type = file.type.toLowerCase();
  if (!ACCEPTED_TYPES.includes(type)) {
    throw new Error('Format non pris en charge. Choisissez une image PNG, JPG, WebP, GIF ou SVG.');
  }
  if (file.size > MAX_LOGO_FILE_BYTES) {
    throw new Error('Ce fichier dépasse 10 Mo. Choisissez une image plus légère.');
  }

  const img = await loadImage(file);

  for (const size of SIZES) {
    // 1) PNG : garde la transparence, idéal pour un logo.
    const png = render(img, size, null).toDataURL('image/png');
    if (png.length <= MAX_LOGO_DATA_CHARS) return png;

    // 2) WebP avec transparence (le navigateur peut renvoyer du PNG s'il ne sait pas l'encoder : on le détecte).
    for (const quality of [0.9, 0.75]) {
      const webp = render(img, size, null).toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp') && webp.length <= MAX_LOGO_DATA_CHARS) return webp;
    }
  }

  // 3) Dernier recours : JPEG sur fond blanc (la transparence est perdue).
  for (const size of SIZES) {
    for (const quality of [0.85, 0.7, 0.5]) {
      const jpeg = render(img, size, '#ffffff').toDataURL('image/jpeg', quality);
      if (jpeg.length <= MAX_LOGO_DATA_CHARS) return jpeg;
    }
  }

  throw new Error("Cette image reste trop lourde même après réduction. Choisissez un logo plus simple.");
}
