// src/pages/supervision/AuditSection.tsx
// Journal d'audit : qui a fait quoi, quand et depuis où. Filtres par action, par réussite/échec et
// (super admin) par société. Le serveur n'expose ni le détail brut ni le navigateur de l'acteur.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AuditEntry, CompanySummary } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { AUDIT_OPTIONS, ROLE_SHORT, actorName, auditView, fullDate, when } from '../../lib/supervisionRules';
import { usePagedList } from '../../lib/usePagedList';
import { useResource } from '../../lib/useResource';

const PAGE = 30;

interface Props {
  refreshKey: number;
  /** Le filtre par société n'a de sens que pour le super admin. */
  canFilterCompany: boolean;
}

export default function AuditSection({ refreshKey, canFilterCompany }: Props) {
  const [action, setAction] = useState('');
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [companyId, setCompanyId] = useState('');

  // La liste des sociétés sert uniquement au filtre : si elle ne charge pas, le filtre disparaît sans gêner le reste.
  const companies = useResource<CompanySummary[]>(
    () => (canFilterCompany ? api.companies.list().catch(() => []) : Promise.resolve([])),
    [canFilterCompany],
  );
  const companyOptions = useMemo(
    () =>
      (companies.data ?? [])
        .map((c) => ({ value: String(c.id), label: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [companies.data],
  );

  const list = usePagedList<AuditEntry>(
    (page) =>
      api.supervision.auditLogs(page, PAGE, {
        ...(action ? { action } : {}),
        ...(failuresOnly ? { successful: false } : {}),
        ...(companyId ? { clientId: Number(companyId) } : {}),
      }),
    [action, failuresOnly, companyId],
  );

  const seenKey = useRef(refreshKey);
  useEffect(() => {
    if (seenKey.current !== refreshKey) {
      seenKey.current = refreshKey;
      list.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtered = action !== '' || failuresOnly || companyId !== '';

  function clearFilters() {
    setAction('');
    setFailuresOnly(false);
    setCompanyId('');
  }

  return (
    <section id="audit" aria-labelledby="sv-audit-title" className="sv-section">
      <div className="sv-section__head">
        <h2 id="sv-audit-title">Journal d’audit</h2>
        <p>Les actions enregistrées sur la plateforme, de la plus récente à la plus ancienne.</p>
      </div>

      <div className="toolbar">
        <SelectField
          id="sv-audit-action"
          label="Action"
          className="toolbar__select"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          options={AUDIT_OPTIONS}
          placeholder="Toutes les actions"
        />
        {canFilterCompany && companyOptions.length > 1 ? (
          <SelectField
            id="sv-audit-company"
            label="Société"
            className="toolbar__select"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            options={companyOptions}
            placeholder="Toutes les sociétés"
          />
        ) : null}
        <button type="button" className="tab tab--toggle" aria-pressed={failuresOnly} onClick={() => setFailuresOnly((v) => !v)}>
          Échecs seulement
        </button>
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block center-block--sm">
          <Spinner label="Chargement du journal" />
        </div>
      ) : list.error && list.items.length === 0 ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger le journal"
            action={
              <button type="button" className="link-btn" onClick={list.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty empty--compact">
          <span className="empty__icon">
            <Icon name={filtered ? 'search' : 'list'} size={26} />
          </span>
          <h3>{filtered ? 'Aucune entrée pour ces filtres' : 'Le journal est vide'}</h3>
          <p>{filtered ? 'Aucune action enregistrée ne correspond.' : 'Les connexions et les opérations sensibles apparaîtront ici.'}</p>
          {filtered ? (
            <Button variant="secondary" onClick={clearFilters}>
              Effacer les filtres
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          <p className="sv-count" aria-live="polite">
            <strong>
              {list.total.toLocaleString('fr-FR')} entrée{list.total > 1 ? 's' : ''}
            </strong>
          </p>
          <ul className="sv-audit-grid">
            {list.items.map((e) => {
              const view = auditView(e.action);
              const tone = e.successful ? view.tone : 'danger';
              return (
                <li key={e.id} className="sv-audit">
                  <span className={`sv-audit__icon sv-audit__icon--${tone}`} aria-hidden="true">
                    <Icon name={view.icon} size={20} />
                  </span>
                  <div className="sv-audit__main">
                    <div className="sv-audit__title">
                      <strong>{view.label}</strong>
                      {!e.successful ? <Pill tone="danger">Échec</Pill> : null}
                    </div>
                    <span className="sv-audit__who">
                      {actorName(e.user)}
                      {e.user ? ` · ${ROLE_SHORT[e.user.role] ?? e.user.role}` : ''}
                      {e.client ? ` · ${e.client.name}` : ''}
                    </span>
                    {e.ipAddress || e.country ? (
                      <span className="sv-audit__meta">
                        {[e.ipAddress, e.country].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                    {!e.successful && e.errorMsg ? <span className="sv-audit__error">{e.errorMsg}</span> : null}
                  </div>
                  <time className="sv-audit__time" dateTime={e.createdAt} title={fullDate(e.createdAt)}>
                    {when(e.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
          {list.moreError ? (
            <div className="stack stack--tight">
              <Notice tone="error" title="Impossible de charger la suite">
                {describeError(list.moreError).message}
              </Notice>
            </div>
          ) : null}
          {list.hasMore ? (
            <div className="more">
              <Button variant="secondary" busy={list.loadingMore} onClick={list.loadMore}>
                Afficher plus ({Math.max(0, list.total - list.items.length).toLocaleString('fr-FR')} restantes)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
