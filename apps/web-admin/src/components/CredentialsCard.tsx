// src/components/CredentialsCard.tsx
// Affiche une seule fois les accès d'un compte qui vient d'être créé :
// lignes simples (copiables) et un mot de passe masqué par défaut.

import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { CopyButton } from './form';
import { Card, Notice } from './ui';

export interface CredentialRow {
  label: string;
  value: string;
  copy?: boolean;
  mono?: boolean;
}

export function CredentialsCard({
  title,
  intro,
  rows,
  password,
  children,
}: {
  title: string;
  intro: ReactNode;
  rows: readonly CredentialRow[];
  password: string;
  children?: ReactNode;
}) {
  const [shown, setShown] = useState(false);

  return (
    <Card className="credentials">
      <header className="credentials__head">
        <span className="section-card__icon">
          <Icon name="check" size={20} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>
      </header>

      <dl className="kv">
        {rows.map((row) => (
          <div className="kv__row" key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.copy ? 'inline-copy' : row.mono ? 'mono' : undefined}>
              {row.copy ? (
                <>
                  <span className="mono">{row.value}</span>
                  <CopyButton value={row.value} />
                </>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
        <div className="kv__row">
          <dt>Mot de passe temporaire</dt>
          <dd className="inline-copy">
            <span className="mono">{shown ? password : '•'.repeat(password.length)}</span>
            <button type="button" className="copy-btn" onClick={() => setShown((s) => !s)}>
              <Icon name={shown ? 'eyeOff' : 'eye'} size={16} />
              <span>{shown ? 'Masquer' : 'Afficher'}</span>
            </button>
            <CopyButton value={password} />
          </dd>
        </div>
      </dl>

      {children}

      <Notice tone="info">
        Ce mot de passe n'est affiché qu'ici. Une fois cette page quittée, il ne pourra plus être relu.
      </Notice>
    </Card>
  );
}
