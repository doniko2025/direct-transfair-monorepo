// src/pages/pilotage/AgentsBoardPage.tsx
// Objectifs et classement des agents (administrateur de société) : activité du mois (envois et dépôts), avancement par rapport
// à l'objectif fixé, classement par nombre d'opérations.

import { useState } from 'react';
import type { AgentBoardRow } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { MEDALS, monthKey, monthLabel, parseAmountInput, pctLabel, shiftMonth, volumeLabel } from '../../lib/pilotageRules';
import { useResource } from '../../lib/useResource';
import { KpiCard, KpiGrid } from '../dashboard/parts';

const CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'];

function TargetDialog({ row, month, onClose, onDone }: { row: AgentBoardRow; month: string; onClose: () => void; onDone: () => void }) {
  const firstCurrency = Object.keys(row.volume)[0];
  const [currency, setCurrency] = useState(row.target?.currency ?? firstCurrency ?? 'XOF');
  const [amount, setAmount] = useState(row.target?.targetAmount ? String(row.target.targetAmount) : '');
  const [ops, setOps] = useState(row.target?.targetOperations ? String(row.target.targetOperations) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const a = amount.trim() ? parseAmountInput(amount) : 0;
    const o = ops.trim() ? Number(ops) : 0;
    if (a === null || !Number.isInteger(o) || o < 0) return setError('Vérifiez les valeurs saisies.');
    if (a === 0 && o === 0) return setError('Indiquez un objectif de volume ou un nombre d’opérations.');
    setBusy(true);
    setError(null);
    api.pilotage
      .saveTarget(row.agentId, { month, currency, targetAmount: a, targetOperations: o })
      .then(onDone)
      .catch((err: unknown) => { setError(describeError(err).message); setBusy(false); });
  };

  return (
    <ConfirmDialog open title={`Objectif · ${row.name}`} confirmLabel="Enregistrer" busy={busy} onCancel={onClose} onConfirm={save}>
      <div className="dialog-form">
        <p>{monthLabel(month)}</p>
        <SelectField id="tg-cur" label="Devise du volume" value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <Field id="tg-amount" label={`Volume à atteindre (${currency})`} inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); }} hint="Envois et dépôts de l’agent dans cette devise." />
        <Field id="tg-ops" label="Nombre d’opérations à atteindre" inputMode="numeric" value={ops} onChange={(e) => { setOps(e.target.value.replace(/\D/g, '')); setError(null); }} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function AgentsBoardPage() {
  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const [editing, setEditing] = useState<AgentBoardRow | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const res = useResource(() => api.pilotage.agents(month), [month]);
  const data = res.data;
  const active = data?.rows.filter((r) => r.operations > 0).length ?? 0;
  const reached = data?.rows.filter((r) => r.progress.reached).length ?? 0;
  const total = data?.rows.reduce((n, r) => n + r.operations, 0) ?? 0;

  const clear = async (row: AgentBoardRow) => {
    setProblem(null);
    try {
      await api.pilotage.deleteTarget(row.agentId, month);
      res.reload();
    } catch (err) {
      setProblem(describeError(err).message);
    }
  };

  return (
    <div className="pil-page">
      <PageHeader title="Objectifs des agents" description="Activité du mois, avancement et classement." />
      <div className="pil-month">
        <button type="button" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" aria-label="Mois suivant" disabled={month >= current} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      {problem ? <Notice tone="error">{problem}</Notice> : null}

      {res.loading && !data ? (
        <div className="center-block"><Spinner label="Chargement du classement" /></div>
      ) : res.error || !data ? (
        <Notice tone="error" title="Classement indisponible" action={<Button variant="secondary" onClick={res.reload}>Réessayer</Button>}>{describeError(res.error).message}</Notice>
      ) : data.rows.length === 0 ? (
        <p className="pil-empty">Aucun agent dans votre société pour le moment.</p>
      ) : (
        <>
          <KpiGrid label="Bilan du mois" className="dash-kpis--stats dash-kpis--grid">
            <KpiCard icon="send" label="Opérations" value={String(total)} note={`${active} agent(s) actif(s)`} />
            <KpiCard icon="check" label="Objectifs atteints" value={String(reached)} tone={reached ? 'ok' : 'default'} note={reached ? 'bravo à eux' : 'pas encore'} />
          </KpiGrid>

          <div className="pil-list">
            {data.rows.map((r, i) => (
              <Card as="article" key={r.agentId} className="pil-card" data-tone={r.progress.reached ? 'ok' : undefined} style={{ ['--i' as string]: i }}>
                <div className="pil-head">
                  <div className="pil-who">
                    <span className="pil-rank" aria-label={`Rang ${r.rank}`}>{r.operations > 0 ? MEDALS[r.rank] ?? r.rank : '–'}</span>
                    <div>
                      <h2 className="pil-title">{r.name}</h2>
                      <p className="pil-sub">{r.agencyName ?? 'Sans agence'}{r.isActive ? '' : ' · compte inactif'}</p>
                    </div>
                  </div>
                  {r.progress.reached ? <Pill tone="ok">Objectif atteint</Pill> : null}
                </div>

                <div className="pil-figs">
                  <div className="pil-fig"><span>Opérations</span><strong>{r.operations}</strong></div>
                  <div className="pil-fig"><span>Volume</span><strong>{volumeLabel(r.volume)}</strong></div>
                </div>

                {r.target ? (
                  <>
                    <div className="pil-bar" role="img" aria-label={`Avancement ${pctLabel(r.progress.pct)}`}>
                      <div className="pil-bar__fill" data-done={r.progress.reached} style={{ width: `${Math.min(100, r.progress.pct ?? 0)}%` }} />
                    </div>
                    <p className="pil-sub">
                      Objectif :{' '}
                      {[r.target.targetAmount > 0 ? `${formatAmount(r.target.targetAmount, r.target.currency)} (${pctLabel(r.progress.amountPct)})` : null, r.target.targetOperations > 0 ? `${r.target.targetOperations} opérations (${pctLabel(r.progress.operationsPct)})` : null].filter(Boolean).join(' · ')}
                    </p>
                  </>
                ) : (
                  <p className="pil-sub">Aucun objectif fixé pour ce mois.</p>
                )}

                <div className="pil-actions">
                  <Button variant="secondary" icon="edit" onClick={() => setEditing(r)}>{r.target ? 'Modifier l’objectif' : 'Fixer un objectif'}</Button>
                  {r.target ? <Button variant="ghost" icon="trash" onClick={() => void clear(r)}>Retirer</Button> : null}
                </div>
              </Card>
            ))}
          </div>
          <p className="pil-foot">Classement par nombre d’opérations (envois et dépôts validés). Les ex æquo partagent le même rang.</p>
        </>
      )}

      {editing ? <TargetDialog row={editing} month={month} onClose={() => setEditing(null)} onDone={() => { setEditing(null); res.reload(); }} /> : null}
    </div>
  );
}
