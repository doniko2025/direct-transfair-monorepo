// apps/web-admin/src/components/LogoUploader.tsx
// Choix du logo d'une société : depuis l'appareil (ordinateur, galerie ou appareil photo du téléphone) ou par adresse web.
// L'image importée est réduite dans le navigateur (lib/logoImage.ts). La valeur est soit une adresse web, soit une data URL.

import { useRef, useState, type ChangeEvent } from 'react';
import { Icon } from './Icon';
import { Button, Field } from './ui';
import { isDisplayableLogo, isImportedLogo, prepareLogo } from '../lib/logoImage';

interface Props {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export function LogoUploader({ id, label = 'Logo', value, onChange, error, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const imported = isImportedLogo(value);
  const showImage = isDisplayableLogo(value) && !broken;
  const shownError = problem || error || null;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permet de rechoisir le même fichier
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      onChange(await prepareLogo(file));
      setBroken(false);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Impossible d'importer cette image.");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setProblem(null);
    setBroken(false);
    onChange('');
  }

  return (
    <div className="field logo-field">
      <label htmlFor={`${id}-file`}>{label}</label>

      <div className="logo-field__row">
        <div className="logo-field__tile" aria-hidden={showImage ? undefined : true}>
          {showImage ? (
            <img src={value} alt="Logo de la société" onError={() => setBroken(true)} />
          ) : (
            <Icon name="building" size={26} />
          )}
        </div>

        <div className="logo-field__actions">
          <input
            ref={inputRef}
            id={`${id}-file`}
            type="file"
            accept="image/*"
            hidden
            disabled={disabled || busy}
            onChange={(e) => void onFile(e)}
          />
          <Button variant="secondary" busy={busy} disabled={disabled} onClick={() => inputRef.current?.click()}>
            {value ? "Changer l'image" : 'Choisir une image'}
          </Button>
          {value ? (
            <Button variant="ghost" icon="trash" disabled={disabled || busy} onClick={clear}>
              Retirer
            </Button>
          ) : null}
        </div>
      </div>

      {shownError ? (
        <p className="field__error" role="alert">
          {shownError}
        </p>
      ) : (
        <p className="field__hint">
          {imported
            ? 'Image importée depuis votre appareil, ajustée automatiquement.'
            : 'Depuis votre ordinateur ou votre téléphone (galerie, appareil photo, fichiers). PNG, JPG, WebP, GIF ou SVG : l’image est réduite automatiquement.'}
        </p>
      )}

      <details className="logo-field__url" open={!!value && !imported}>
        <summary>Ou utiliser l’adresse d’une image en ligne</summary>
        <Field
          id={`${id}-url`}
          label="Adresse de l’image"
          type="url"
          value={imported ? '' : value}
          placeholder="https://"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          onChange={(e) => {
            setProblem(null);
            setBroken(false);
            onChange(e.target.value.trim());
          }}
        />
      </details>
    </div>
  );
}
