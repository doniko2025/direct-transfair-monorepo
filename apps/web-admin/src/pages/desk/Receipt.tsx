// src/pages/desk/Receipt.tsx
// Reçu d'une opération de guichet : affiché après la validation, imprimable (la feuille ne montre que le reçu).

import type { ReactNode } from 'react';
import { CopyButton } from '../../components/form';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/ui';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useTenant } from '../../providers/TenantProvider';
import { personName } from '../../lib/deskRules';

export interface ReceiptLine {
  label: string;
  value: ReactNode;
  /** Mise en avant (montant principal). */
  strong?: boolean;
}

interface ReceiptProps {
  title: string;
  /** Phrase de confirmation, sous le titre. */
  lead: string;
  /** Date de l'opération (ISO). */
  at: string;
  reference?: string;
  /** Le code à remettre ou à noter : affiché en grand avec un bouton « Copier ». */
  code?: { label: string; value: string };
  lines: ReceiptLine[];
  /** Mention en bas du reçu (ex. validation en attente). */
  note?: string;
  agencyName?: string | null;
  children?: ReactNode;
}

function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function Receipt({ title, lead, at, reference, code, lines, note, agencyName, children }: ReceiptProps) {
  const me = useCurrentUser();
  const { branding } = useTenant();
  const agent = personName(me) || me.email;

  return (
    <article className="receipt" aria-label={`Reçu : ${title}`}>
      <header className="receipt__head">
        <span className="receipt__badge" aria-hidden="true">
          <Icon name="check" size={22} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{lead}</p>
        </div>
      </header>

      {code ? (
        <div className="receipt__code">
          <span>{code.label}</span>
          <strong>{code.value}</strong>
          <CopyButton value={code.value} label="Copier le code" />
        </div>
      ) : null}

      <dl className="receipt__lines">
        {lines.map((l) => (
          <div key={l.label} className={`receipt__line${l.strong ? ' receipt__line--strong' : ''}`}>
            <dt>{l.label}</dt>
            <dd>{l.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="receipt__foot">
        <p>
          {branding.name}
          {agencyName ? ` — ${agencyName}` : ''}
        </p>
        <p>
          Opération saisie par {agent} le {longDate(at)}
          {reference ? <> · Réf. {reference}</> : null}
        </p>
        {note ? <p className="receipt__note">{note}</p> : null}
      </footer>

      <div className="receipt__actions">
        <Button variant="secondary" icon="list" onClick={() => window.print()}>
          Imprimer le reçu
        </Button>
        {children}
      </div>
    </article>
  );
}
