// src/components/DocumentPicker.tsx
// Choix d'un document (photo ou PDF) depuis l'appareil : ordinateur, galerie, appareil photo ou fichiers du téléphone.
// Le fichier est contrôlé (type, 6 Mo au plus) puis lu en data URL base64, envoyée telle quelle au serveur, qui relit le type réel.

import { useRef, useState, type ChangeEvent } from 'react';
import { Icon } from './Icon';
import { Button } from './ui';

export const MAX_DOC_BYTES = 6 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export interface PickedDocument {
  name: string;
  sizeBytes: number;
  mimeType: string;
  /** Data URL base64 du fichier. */
  dataUrl: string;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'));
    reader.readAsDataURL(file);
  });
}

/** Contrôle et lit un fichier choisi. Lève une Error au message clair s'il ne convient pas. */
export async function pickDocument(file: File): Promise<PickedDocument> {
  const okType = ACCEPT.split(',').includes(file.type);
  if (!okType) throw new Error('Format non accepté : photo (JPEG, PNG, WebP) ou PDF.');
  if (file.size > MAX_DOC_BYTES) throw new Error(`Fichier trop lourd (${formatSize(file.size)}) : 6 Mo au maximum.`);
  if (file.size < 8 * 1024) throw new Error('Fichier trop petit pour être un document lisible. Reprenez la photo.');
  return { name: file.name, sizeBytes: file.size, mimeType: file.type, dataUrl: await readAsDataUrl(file) };
}

interface Props {
  id: string;
  label: string;
  hint?: string;
  value: PickedDocument | null;
  onChange: (value: PickedDocument | null) => void;
  error?: string | null;
  disabled?: boolean;
}

export function DocumentPicker({ id, label, hint, value, onChange, error, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shownError = problem || error || null;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permet de rechoisir le même fichier
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      onChange(await pickDocument(file));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Impossible de charger ce fichier.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field doc-picker">
      <label htmlFor={`${id}-file`}>{label}</label>
      <div className={`doc-picker__row${value ? ' doc-picker__row--filled' : ''}`}>
        <span className="doc-picker__icon" aria-hidden="true">
          <Icon name={value ? 'check' : 'file'} size={20} />
        </span>
        <div className="doc-picker__info">
          {value ? (
            <>
              <strong className="doc-picker__name">{value.name}</strong>
              <span className="muted">
                {value.mimeType === 'application/pdf' ? 'PDF' : 'Photo'} · {formatSize(value.sizeBytes)}
              </span>
            </>
          ) : (
            <span className="muted">Aucun fichier choisi</span>
          )}
        </div>
        <input
          id={`${id}-file`}
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          disabled={disabled || busy}
          onChange={(e) => void onFile(e)}
        />
        <div className="doc-picker__actions">
          <Button variant="secondary" busy={busy} disabled={disabled} onClick={() => inputRef.current?.click()}>
            {value ? 'Changer' : 'Choisir'}
          </Button>
          {value ? (
            <Button variant="ghost" icon="trash" disabled={disabled || busy} onClick={() => { setProblem(null); onChange(null); }}>
              Retirer
            </Button>
          ) : null}
        </div>
      </div>
      {shownError ? (
        <p className="field__error" role="alert">
          {shownError}
        </p>
      ) : hint ? (
        <p className="field__hint">{hint}</p>
      ) : null}
    </div>
  );
}
