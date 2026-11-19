// src/pages/pilotage/ClosingsPage.tsx
// Caisses (administrateur de société) : clôtures d'un jour, écarts à examiner, caisses non clôturées, export CSV.

import { useState } from 'react';
import type { CashClosingAdmin } from '@direct-transfair/shared';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Icon } from '../../components/Icon';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { saveBlob } from '../../lib/contractRules';
import { describeError } from '../../lib/errors';
import { dayKey, dayLabel, varianceLabel, varianceTone } from '../../lib/pilotageRules';
import { formatDateTime } from '../../lib/userRules';
import { useResource } from '../../lib/useResource';
import { KpiCard, KpiGrid } from '../dashboard/parts';

function ReviewDialog({ row, onClose, onDone }: { row: CashClosingAdmin; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      title="Écart examiné"
      confirmLabel="Marquer comme examiné"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        setBusy(true);
        setError(null);
        api.pilotage
          .reviewClosing(row.id, note.trim() || undefined)
          .then(onDone)
          .catch((err: unknown) => { setError(describeError(err).message); setBusy(false); });
      }}
    >
      <div className="dialog-form">
        <p>{row.agencyName} · {row.agentName} — {varianceLabel(row.variance, row.currency)}.</p>
        <p>L’agent ne pourra plus rectifier sa clôture et l’alerte associée sera fermée.</p>
        <TextAreaField id="rv-note" label="Note (facultatif, visible par l’agent)" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function ClosingsPage() {
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [onlyVariance, setOnlyVariance] = useState(false);
  const [reviewing, setReviewing] = useState<CashClosingAdmin | null>(null);
  const [exporting, setExporting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const res = useResource(() => api.pilotage.closings({ day, onlyVariance }), [day, onlyVariance]);
  const data = res.data;

  const exportCsv = async () => {
    setExporting(true);
    setProblem(null);
    try {
      saveBlob(await api.pilotage.exportCsv('closings', { from: day, to: day }), `clotures_caisse_${day}.csv`);
    } catch (err) {
      setProblem(describeError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pil-page">
      <PageHeader title="Caisses" description="Clôtures de caisse de vos agences et écarts à examiner." actions={<Button variant="secondary" icon="download" busy={exporting} onClick={() => void exportCsv()}>Exporter</Button>} />

      <div className="pil-toolbar">
        <div className="pil-date">
          <Field id="pc-day" label="Jour" type="date" max={dayKey(new Date())} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </div>
        <div className="pil-chips" role="group" aria-label="Filtre">
          <button type="button" className="pil-chip" aria-pressed={!onlyVariance} onClick={() => setOnlyVariance(false)}>Toutes</button>
          <button type="button" className="pil-chip" aria-pressed={onlyVariance} onClick={() => setOnlyVariance(true)}>Écarts seulement</button>
        </div>
      </div>
      <p className="pil-sub">{dayLabel(day)}</p>
      {problem ? <Notice tone="error">{problem}</Notice> : null}

      {res.loading && !data ? (
        <div className="center-block"><Spinner label="Chargement des caisses" /></div>
      ) : res.error || !data ? (
        <Notice tone="error" title="Caisses indisponibles" action={<Button variant="secondary" onClick={res.reload}>Réessayer</Button>}>{describeError(res.error).message}</Notice>
      ) : (
        <>
          <KpiGrid label="Bilan des caisses" className="dash-kpis--stats dash-kpis--grid">
            <KpiCard icon="vault" label="Clôturées" value={String(data.summary.count)} note={data.summary.count ? 'ce jour' : 'Aucune'} />
            <KpiCard icon="alert" label="Avec écart" value={String(data.summary.withVariance)} tone={data.summary.withVariance ? 'warn' : 'ok'} note={data.summary.toReview ? `${data.summary.toReview} à examiner` : 'Tout examiné'} />
            <KpiCard icon="list" label="Non clôturées" value={String(data.summary.missing)} tone={data.summary.missing ? 'warn' : 'ok'} note={data.summary.missing ? 'à relancer' : 'Rien en attente'} />
          </KpiGrid>

          {data.closings.length > 0 ? (
            <div className="pil-list">
              {data.closings.map((c, i) => (
                <Card as="article" key={c.id} className="pil-card" data-tone={varianceTone(c.severity)} style={{ ['--i' as string]: i }}>
                  <div className="pil-head">
                    <div>
                      <h2 className="pil-title">{c.agencyName}</h2>
                      <p className="pil-sub">{c.agentName} · {c.currency} · {c.opsCount} opération(s)</p>
                    </div>
                    <Pill tone={varianceTone(c.severity)}>{c.variance === 0 ? 'Juste' : varianceLabel(c.variance, c.currency)}</Pill>
                  </div>
                  <div className="pil-figs">
                    <div className="pil-fig"><span>Solde théorique</span><strong>{formatAmount(c.expectedAmount, c.currency)}</strong></div>
                    <div className="pil-fig"><span>Espèces comptées</span><strong>{formatAmount(c.countedAmount, c.currency)}</strong></div>
                  </div>
                  {c.note ? <p className="pil-note">Agent : {c.note}</p> : null}
                  {c.reviewedAt ? (
                    <p className="pil-note">Examiné le {formatDateTime(c.reviewedAt)}{c.reviewNote ? ` — ${c.reviewNote}` : ''}</p>
                  ) : c.variance !== 0 ? (
                    <Button variant="secondary" onClick={() => setReviewing(c)}>Marquer comme examiné</Button>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <p className="pil-empty">{onlyVariance ? 'Aucun écart ce jour-là.' : 'Aucune clôture enregistrée ce jour-là.'}</p>
          )}

          {data.missing.length > 0 && !onlyVariance ? (
            <>
              <h2 className="pil-section"><Icon name="alert" size={16} /> Caisses non clôturées</h2>
              <div className="pil-list">
                {data.missing.map((m, i) => (
                  <Card as="article" key={`${m.agencyId}:${m.currency}`} tone="flat" className="pil-card" data-tone="warn" style={{ ['--i' as string]: i }}>
                    <div className="pil-head">
                      <div>
                        <h3 className="pil-title">{m.agencyName}</h3>
                        <p className="pil-sub">Caisse en {m.currency} · solde actuel {formatAmount(m.expectedAmount, m.currency)}</p>
                      </div>
                      <Pill tone="warn">En attente</Pill>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {reviewing ? <ReviewDialog row={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); res.reload(); }} /> : null}
    </div>
  );
}
