// src/pages/desk/PhoneField.tsx
// Téléphone en deux parties : indicatif du pays (liste) + numéro. Le numéro peut aussi être saisi en entier
// avec « + » ; le parent compose la valeur envoyée au serveur avec parsePhone().

import { COUNTRIES } from '../../lib/countries';
import { DIAL_CODES } from '../../lib/dialCodes';

interface PhoneFieldProps {
  id: string;
  label: string;
  dial: string;
  value: string;
  onDial: (dial: string) => void;
  onValue: (value: string) => void;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}

const NAME = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export function PhoneField({ id, label, dial, value, onDial, onValue, hint, error, disabled, autoFocus }: PhoneFieldProps) {
  const noteId = `${id}-note`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="phone-field">
        <div className="field__control field__control--select phone-field__dial">
          <select
            aria-label={`${label} — indicatif du pays`}
            value={dial}
            onChange={(e) => onDial(e.target.value)}
            disabled={disabled}
          >
            {DIAL_CODES.map((d) => (
              <option key={d.country} value={d.dial}>
                {NAME.get(d.country) ?? d.country} (+{d.dial})
              </option>
            ))}
          </select>
        </div>
        <div className="field__control phone-field__number">
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder="620 00 00 00"
            value={value}
            onChange={(e) => onValue(e.target.value)}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? noteId : undefined}
          />
        </div>
      </div>
      {error ? (
        <p className="field__error" id={noteId}>
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={noteId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
