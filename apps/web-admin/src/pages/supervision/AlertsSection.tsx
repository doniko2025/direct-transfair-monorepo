// src/pages/supervision/AlertsSection.tsx
// Alertes de la plateforme : à traiter / traitées / toutes, filtre de gravité, résolution avec confirmation.

import { useEffect, useRef, useState } from 'react';
import type { AlertSeverity, SupervisionAlert } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import {
  ALERT_TABS,
  ALERT_TYPE_LABEL,
  SEVERITY_LABEL,
  SEVERITY_OPTIONS,
  SEVERITY_TONE,
  fullDate,
  when,
  type AlertTab,
} from '../../lib/supervisionRules';
import { usePagedList } from '../../lib/usePagedList';

const PAGE = 20;

interface Props {
  /** Change à chaque « Actualiser » de la page : recharge la première page en gardant la liste affichée. */
  refreshKey: number;
  /** Appelé après une résolution réussie : la page rafraîchit ses compteurs. */
  onResolved: () => void;
}

export default function AlertsSection({ refreshKey, onResolved }: Props) {
  const [tab, setTab] = useState<AlertTab>('open');
  const [severity, setSeverity] = useState<AlertSeverity | ''>('');

  const list = usePagedList<SupervisionAlert>(
    (page) => api.supervision.alerts(page, PAGE, { status: tab, ...(severity ? { severity } : {}) }),
    [tab, severity],
  );

  const seenKey = useRef(refreshKey);
  useEffect(() => {
    if (seenKey.current !== refreshKey) {
      seenKey.current = refreshKey;
      list.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const [target, setTarget] = useState<SupervisionAlert | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function close() {
    setTarget(null);
    setFailure(null);
  }

  async function resolve() {
    if (!target) return;
    setBusy(true);
    setFailure(null);
    try {
      await api.supervision.resolveAlert(target.id);
      setTarget(null);
      list.reload();
      onResolved();
    } catch (err) {
      setFailure(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = severity !== '' || tab !== 'open';

  return (
    <section id="alerts" aria-labelledby="sv-alerts-title" className="sv-section">
      <div className="sv-section__head">
        <h2 id="sv-alerts-title">Alertes</h2>
        <p>Les signalements de sécurité et de conformité, à traiter ou déjà traités.</p>
      </div>

      <div className="sv-filters">
        <div className="tabs tabs--row" role="group" aria-label="Filtrer les alertes">
          {ALERT_TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <SelectField
          id="sv-alert-severity"
          label="Gravité"
          className="toolbar__select"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as AlertSeverity | '')}
          options={SEVERITY_OPTIONS}
          placeholder="Toutes les gravités"
        />
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block center-block--sm">
          <Spinner label="Chargement des alertes" />
        </div>
      ) : list.error && list.items.length === 0 ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les alertes"
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
            <Icon name={filtered ? 'search' : 'check'} size={26} />
          </span>
          <h3>{filtered ? 'Aucune alerte pour ce filtre' : 'Aucune alerte à traiter'}</h3>
          <p>{filtered ? 'Changez de filtre pour voir les autres alertes.' : 'Les nouvelles alertes apparaîtront ici dès qu’elles sont créées.'}</p>
        </Card>
      ) : (
        <>
          <p className="sv-count" aria-live="polite">
            <strong>
              {list.total} alerte{list.total > 1 ? 's' : ''}
            </strong>
          </p>
          <ul className="sv-alert-grid">
            {list.items.map((a) => (
              <li key={a.id} className={`sv-alert sv-alert--${SEVERITY_TONE[a.severity]}`}>
                <div className="sv-alert__top">
                  <Pill tone={SEVERITY_TONE[a.severity]} icon={a.severity === 'LOW' ? undefined : 'alert'}>
                    {SEVERITY_LABEL[a.severity]}
                  </Pill>
                  <span className="muted">{ALERT_TYPE_LABEL[a.type] ?? a.type}</span>
                  <time className="sv-alert__time" dateTime={a.createdAt} title={fullDate(a.createdAt)}>
                    {when(a.createdAt)}
                  </time>
                </div>
                <strong className="sv-alert__title">{a.title}</strong>
                <p className="sv-alert__message">{a.message}</p>
                <div className="sv-alert__foot">
                  <span className="muted">{a.client ? a.client.name : 'Plateforme'}</span>
                  {a.isResolved ? (
                    <Pill tone="ok" icon="check">
                      Traitée{a.resolvedAt ? ` · ${when(a.resolvedAt)}` : ''}
                    </Pill>
                  ) : (
                    <Button variant="secondary" onClick={() => setTarget(a)}>
                      Marquer comme traitée
                    </Button>
                  )}
                </div>
              </li>
            ))}
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
                Afficher plus d’alertes ({Math.max(0, list.total - list.items.length)} restantes)
              </Button>
            </div>
          ) : null}
        </>
      )}

      {target ? (
        <ConfirmDialog
          open
          title="Marquer cette alerte comme traitée ?"
          confirmLabel="Marquer comme traitée"
          busy={busy}
          onConfirm={() => void resolve()}
          onCancel={close}
        >
          <p>
            <strong>{target.title}</strong>
          </p>
          <p>L’alerte quitte la liste « À traiter » et reste consultable dans « Traitées ». Cette action est enregistrée à votre nom.</p>
          {failure ? (
            <Notice tone="error" title="L’opération a échoué">
              {failure}
            </Notice>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
