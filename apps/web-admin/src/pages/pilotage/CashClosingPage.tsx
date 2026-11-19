// src/pages/pilotage/CashClosingPage.tsx
// Clôture de caisse de l'agent : pour chaque devise de la caisse de son agence, il compte les espèces, le portail
// compare au solde théorique et signale l'écart à l'administrateur. Rectifiable tant que l'administrateur n'a pas examiné l'écart.

import { useState } from 'react';
import type { ClosingToday } from '@direct-transfair/shared';
import { Field, Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { TextAreaField } from '../../components/form';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { dayLabel, parseAmountInput, varianceLabel, varianceTone } from '../../lib/pilotageRules';
import { useResource } from '../../lib/useResource';

type Item = ClosingToday['items'][number];

function CurrencyCard({ item, index, onSaved }: { item: Item; index: number; onSaved: () => void }) {
  const done = item.closing;
  const locked = !!done?.reviewedAt;
  const [editing, setEditing] = useState(!done);
  const [counted, setCounted] = useState(done ? String(done.countedAmount) : '');
  const [note, setNote] = useState(done?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseAmountInput(counted);
  const preview = amount === null ? null : Math.round((amount - item.expectedAmount) * 100) / 100;

  const submit = async () => {
    if (amount === null) return setError('Saisissez le montant des espèces comptées (nombre positif ou nul).');
    setBusy(true);
    setError(null);
    try {
      await api.pilotage.closeCash({ currency: item.currency, countedAmount: amount, note: note.trim() || undefined });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="article" className="pil-card" data-tone={done ? varianceTone(done.severity) : undefined} style={{ ['--i' as string]: index }}>
      <div className="pil-head">
        <div>
          <h2 className="pil-title">Caisse en {item.currency}</h2>
          <p className="pil-sub">{item.opsCount} opération(s) aujourd’hui</p>
        </div>
        {done ? <Pill tone={varianceTone(done.severity)}>{done.variance === 0 ? 'Juste' : 'Écart'}</Pill> : <Pill tone="neutral">À clôturer</Pill>}
      </div>

      <div className="pil-figs">
        <div className="pil-fig pil-fig--big pil-fig--wide">
          <span>Solde théorique de la caisse</span>
          <strong>{formatAmount(item.expectedAmount, item.currency)}</strong>
        </div>
        {done && !editing ? (
          <>
            <div className="pil-fig"><span>Espèces comptées</span><strong>{formatAmount(done.countedAmount, item.currency)}</strong></div>
            <div className="pil-fig"><span>Résultat</span><strong>{varianceLabel(done.variance, item.currency)}</strong></div>
          </>
        ) : null}
      </div>

      {done && !editing ? (
        <>
          {done.note ? <p className="pil-note">Votre note : {done.note}</p> : null}
          {locked ? (
            <Notice tone="ok" title="Écart examiné">{done.reviewNote ? `Votre administrateur : ${done.reviewNote}` : 'Votre administrateur a examiné cette clôture.'}</Notice>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>Rectifier le comptage</Button>
          )}
        </>
      ) : (
        <div className="pil-form">
          <Field id={`cc-${item.currency}`} label={`Espèces comptées (${item.currency})`} inputMode="decimal" placeholder="0" value={counted} onChange={(e) => { setCounted(e.target.value); setError(null); }} />
          {preview !== null ? (
            <p className="pil-note">{preview === 0 ? 'Votre comptage correspond au solde théorique.' : `${varianceLabel(preview, item.currency)} par rapport au solde théorique.`}</p>
          ) : null}
          <TextAreaField id={`cn-${item.currency}`} label="Note (facultatif)" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button busy={busy} onClick={() => void submit()}>{done ? 'Enregistrer la rectification' : 'Clôturer la caisse'}</Button>
        </div>
      )}
    </Card>
  );
}

export default function CashClosingPage() {
  const res = useResource(() => api.pilotage.closingToday(), []);
  return (
    <div className="pil-page">
      <PageHeader title="Clôture de caisse" description={res.data ? `${res.data.agency.name} · ${dayLabel(res.data.day)}` : 'Comptez vos espèces en fin de journée.'} />
      {res.loading && !res.data ? (
        <div className="center-block"><Spinner label="Chargement de la caisse" /></div>
      ) : res.error || !res.data ? (
        <Notice tone="error" title="Caisse indisponible" action={<Button variant="secondary" onClick={res.reload}>Réessayer</Button>}>{describeError(res.error).message}</Notice>
      ) : res.data.items.length === 0 ? (
        <p className="pil-empty">Aucune caisse n’est ouverte pour votre agence.</p>
      ) : (
        <div className="pil-list">
          {res.data.items.map((it, i) => (
            <CurrencyCard key={`${it.currency}:${it.closing?.id ?? 'new'}:${it.closing?.closedAt ?? ''}`} item={it} index={i} onSaved={res.reload} />
          ))}
        </div>
      )}
      <p className="pil-foot">Le solde théorique est celui de la caisse de votre agence au moment de la clôture. Tout écart est signalé à votre administrateur.</p>
    </div>
  );
}

