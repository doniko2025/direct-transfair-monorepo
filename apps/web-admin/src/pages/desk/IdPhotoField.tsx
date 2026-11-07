// src/pages/desk/IdPhotoField.tsx
// Prise de photo d'une face de la pièce d'identité du client de passage : bouton « Photographier » (appareil photo arrière sur
// téléphone, sélecteur de fichier sur ordinateur), aperçu, « Reprendre ». La photo est réduite avant l'envoi (voir imageCapture.ts).

import { useId, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, Spinner } from '../../components/ui';
import { prepareIdPhoto } from '../../lib/imageCapture';

interface Props {
  label: string;
  /** data-URL de la photo prise, ou null. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
  /** Mise en évidence quand le serveur a réclamé la photo. */
  invalid?: boolean;
}

export function IdPhotoField({ label, value, onChange, required, invalid }: Props) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await prepareIdPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo illisible.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ''; // permet de reprendre la même photo
    }
  }

  const problem = error ?? (invalid && !value ? 'Photo obligatoire pour ce client.' : null);

  return (
    <div className={`id-photo${invalid && !value ? ' id-photo--invalid' : ''}`}>
      <span className="id-photo__label" id={`${inputId}-label`}>
        {label}
        {required ? ' *' : ''}
      </span>
      <div className="id-photo__box">
        {busy ? (
          <Spinner label="Préparation de la photo" />
        ) : value ? (
          <img src={value} alt={`Aperçu : ${label}`} />
        ) : (
          <span className="id-photo__empty">
            <Icon name="file" size={26} />
            <small>Aucune photo</small>
          </span>
        )}
      </div>
      <input
        ref={input}
        id={inputId}
        className="id-photo__input"
        type="file"
        accept="image/*"
        capture="environment"
        aria-labelledby={`${inputId}-label`}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="id-photo__actions">
        <Button type="button" variant="secondary" icon={value ? 'refresh' : 'plus'} disabled={busy} onClick={() => input.current?.click()}>
          {value ? 'Reprendre' : 'Photographier'}
        </Button>
        {value ? (
          <Button type="button" variant="secondary" icon="trash" disabled={busy} onClick={() => onChange(null)}>
            Retirer
          </Button>
        ) : null}
      </div>
      {problem ? (
        <p className="id-photo__error" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
