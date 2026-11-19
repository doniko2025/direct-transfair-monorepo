// src/pages/supervision/ReconciliationSection.tsx
// Réconciliation quotidienne des portefeuilles (audit argent I3) : pour chaque devise, la somme des soldes est comparée à la somme du
// journal, avec les soldes négatifs et les montants réservés incohérents. Un écart n'est jamais corrigé automatiquement : on l'explique.
// Cartes animées, une colonne sur mobile ; réutilisé par la Supervision (super admin) et la page « Réconciliation » (admin de société).

import { useState } from 'react';
import { ApiError, type ReconciliationRow } from '@direct-transfair/shared';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';

const OWNER_LABEL: Record<string, string> = { USER: 'Client', AGENCY: 'Agence', COMPANY: 'Société', MERCHANT: 'Commerce', OTHER: 'Autre' };
const ISSUE_LABEL: Record<string, string> = { DRIFT: 'solde ≠ journal', NEGATIVE: 'solde négatif', RESERVED: 'réservé incohérent' };

const dayText = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—');

function ReconCard({ row, index, showCompany }: { row: ReconciliationRow; index: number; showCompany: boolean }) {
  const [open, setOpen] = useState(false);
  const bad = row.status === 'ALERT';
  return (
    <article className="pil-card rc-card" data-tone={bad ? 'danger' : 'ok'} style={{ ['--i' as string]: index }}>
      <header className="rc-card__head">
        <div>
          <h3>{row.currency}</h3>
          <p className="muted">
            {showCompany ? (row.clientId ? `Société ${row.clientId} · ` : 'Plateforme · ') : ''}
            {row.walletsCount} portefeuille{row.walletsCount > 1 ? 's' : ''}
          </p>
        </div>
        <Pill tone={bad ? 'danger' : 'ok'} icon={bad ? 'alert' : 'check'}>{bad ? 'Écart à expliquer' : 'Concordant'}</Pill>
      </header>

      <dl className="rc-figures">
        <div><dt>Soldes</dt><dd>{formatAmount(row.walletsBalance, row.currency)}</dd></div>
        <div><dt>Journal</dt><dd>{formatAmount(row.ledgerNet, row.currency)}</dd></div>
        <div data-bad={row.drift !== 0 || undefined}><dt>Écart cumulé</dt><dd>{formatAmount(row.drift, row.currency)}</dd></div>
        <div><dt>En route (retraits en attente)</dt><dd>{row.inTransitCount ? `${row.inTransitCount} · ${formatAmount(row.inTransitAmount, row.currency)}` : '—'}</dd></div>
      </dl>

      {bad ? (
        <ul className="rc-flags">
          {row.driftWallets > 0 ? <li>{row.driftWallets} portefeuille{row.driftWallets > 1 ? 's' : ''} dont le solde ne correspond pas au journal</li> : null}
          {row.negativeWallets > 0 ? <li>{row.negativeWallets} solde{row.negativeWallets > 1 ? 's' : ''} négatif{row.negativeWallets > 1 ? 's' : ''}</li> : null}
          {row.reservedIssues > 0 ? <li>{row.reservedIssues} montant{row.reservedIssues > 1 ? 's' : ''} réservé{row.reservedIssues > 1 ? 's' : ''} incohérent{row.reservedIssues > 1 ? 's' : ''}</li> : null}
        </ul>
      ) : null}

      {row.problems.length > 0 ? (
        <>
          <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Masquer le détail' : `Voir les ${row.problems.length} portefeuille${row.problems.length > 1 ? 's' : ''} en cause`}
          </button>
          {open ? (
            <ul className="rc-wallets">
              {row.problems.map((p) => (
                <li key={p.walletId}>
                  <div className="rc-wallets__top">
                    <strong>{OWNER_LABEL[p.owner] ?? p.owner}</strong>
                    <code>{p.walletId}</code>
                  </div>
                  <span>Solde {formatAmount(p.balance, row.currency)} · journal {formatAmount(p.journal, row.currency)} · écart {formatAmount(p.drift, row.currency)}</span>
                  <span className="muted">{p.issues.map((i) => ISSUE_LABEL[i] ?? i).join(' · ')}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

export default function ReconciliationSection({ canRun = false, showCompany = false }: { canRun?: boolean; showCompany?: boolean }) {
  const res = useResource(() => api.reconciliation.overview(14), []);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const data = res.data;
  const notDeployed = res.error instanceof ApiError && res.error.status === 404;

  const run = async () => {
    setRunning(true);
    setProblem(null);
    try {
      await api.reconciliation.run();
      res.reload();
    } catch (err) {
      setProblem(describeError(err).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section aria-labelledby="rc-title" className="sv-section rc-section">
      <div className="sv-section__head rc-head">
        <div>
          <h2 id="rc-title">Réconciliation des portefeuilles</h2>
          <p>Chaque nuit, les soldes sont comparés au journal des mouvements. Dernier contrôle : {dayText(data?.lastRunDate ?? null)}.</p>
        </div>
        {canRun ? <Button variant="secondary" busy={running} onClick={() => void run()}>Relancer maintenant</Button> : null}
      </div>

      {problem ? <Notice tone="error">{problem}</Notice> : null}

      {res.loading && !data ? (
        <div className="center-block"><Spinner label="Chargement de la réconciliation" /></div>
      ) : res.error && !data ? (
        <Card>
          <Notice tone="error" title="Impossible de charger la réconciliation" action={<button type="button" className="link-btn" onClick={res.reload}>Réessayer</button>}>
            {notDeployed ? 'Le serveur ne connaît pas encore cette fonction : déployez la dernière version du backend.' : describeError(res.error).message}
          </Notice>
        </Card>
      ) : data ? (
        <>
          {data.status === 'NEVER' ? (
            <Notice tone="info" title="Aucun contrôle enregistré">Le premier passage a lieu cette nuit{canRun ? ' ; vous pouvez le lancer maintenant.' : '.'}</Notice>
          ) : data.status === 'ALERT' ? (
            <Notice tone="error" title="Des écarts demandent une explication">
              Aucune correction n’est faite automatiquement : cherchez l’opération à l’origine de l’écart (journal d’audit, mouvements du portefeuille) avant tout ajustement.
            </Notice>
          ) : (
            <Notice tone="ok" title="Tout concorde">Les soldes correspondent au journal pour toutes les devises.</Notice>
          )}

          <div className="pil-list rc-grid">
            {data.rows.map((r, i) => <ReconCard key={r.id} row={r} index={i} showCompany={showCompany} />)}
          </div>

          {data.history.length > 1 ? (
            <div className="rc-history" role="img" aria-label="Historique des contrôles sur 14 jours">
              {data.history.map((h) => (
                <span key={h.runDate} className="rc-history__dot" data-bad={h.alerts > 0 || undefined} title={`${dayText(h.runDate)} : ${h.alerts > 0 ? `${h.alerts} écart(s)` : 'concordant'}`} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
