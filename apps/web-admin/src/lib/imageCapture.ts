// apps/web-admin/src/lib/imageCapture.ts
// Photographier une pièce d'identité depuis l'ordinateur ou le téléphone (appareil photo, galerie, fichiers).
// La photo est lue dans le navigateur, remise à l'endroit (EXIF géré par le navigateur), réduite à 1 600 px sur son plus grand côté
// et ré-encodée en JPEG ; on vise moins de 900 Ko pour que l'envoi passe même en 3G (le serveur accepte jusqu'à 6 Mo).

export const MAX_PHOTO_FILE_BYTES = 25 * 1024 * 1024;
/** Longueur maximale de la data-URL produite (≈ 900 Ko d'image). */
export const MAX_PHOTO_DATA_CHARS = 1_250_000;
const MIN_PHOTO_BYTES = 8 * 1024; // le serveur refuse en dessous de 8 Ko : une image aussi petite n'est pas lisible
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const SIDES = [1600, 1280, 1024];
const QUALITIES = [0.85, 0.75, 0.62];

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire cette photo. Reprenez-la ou choisissez un fichier JPEG ou PNG.'));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, side: number): HTMLCanvasElement {
  const w0 = img.naturalWidth || side;
  const h0 = img.naturalHeight || side;
  const scale = Math.min(1, side / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * scale));
  canvas.height = Math.max(1, Math.round(h0 * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Votre navigateur ne permet pas de préparer la photo.");
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Vérifie le fichier choisi, le réduit et renvoie une data-URL JPEG. Lève une Error au message lisible. */
export async function prepareIdPhoto(file: File): Promise<string> {
  const type = (file.type || '').toLowerCase();
  if (type && !ACCEPTED.includes(type)) throw new Error('Format non pris en charge. Prenez une photo ou choisissez un fichier JPEG, PNG ou WebP.');
  if (file.size > MAX_PHOTO_FILE_BYTES) throw new Error('Ce fichier dépasse 25 Mo. Reprenez la photo.');
  if (file.size < MIN_PHOTO_BYTES) throw new Error('Cette image est trop petite pour être lisible. Reprenez la photo de plus près.');

  const img = await load(file);
  let last = '';
  for (const side of SIDES) {
    const canvas = draw(img, side);
    for (const q of QUALITIES) {
      last = canvas.toDataURL('image/jpeg', q);
      if (last.length <= MAX_PHOTO_DATA_CHARS) return last;
    }
  }
  if (last && last.length <= MAX_PHOTO_DATA_CHARS * 3) return last; // photo très détaillée : reste sous la limite du serveur (6 Mo)
  throw new Error('Cette photo reste trop lourde. Reprenez-la avec une résolution plus faible.');
}
