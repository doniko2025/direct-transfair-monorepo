// src/pages/pilotage/ProfitabilityPage.tsx
// Rentabilité par couloir (devise d'envoi → devise reçue) : volume, frais perçus, commissions des agents, part de la plateforme
// et marge nette ESTIMÉE (frais − commissions des agents − part de la plateforme). Exports CSV comptables.

import { useState } from 'react';
import type { PilotageExport } from '@direct-transfair/shared';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { saveBlob } from '../../lib/contractRules';
import { describeError } from '../../lib/errors';
import { PERIOD_OPTIONS, pctLabel, periodRange, type PeriodId } from '../../lib/pilotageRules';
import { useResource } from '../../lib/useResource';
import { KpiCard, KpiGrid } from '../dashboard/parts';

export default function ProfitabilityPage() {
  const [period, setPeriod] = useState<PeriodId>('30');
  const [exporting, setExporting] = useState<PilotageExport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const range = periodRange(period);
  const res = useResource(() => api.pilotage.profitability(range), [range.from, range.to]);
  const data = res.data;
  const best = data ? Math.max(1, ...data.corridors.map((c) => Math.abs(c.net))) : 1;

  const download = async (kind: PilotageExport) => {
    setExporting(kind);
    setProblem(null);
    try {
      const name = kind === 'transactions' ? 'operations' : kind === 'profitability' ? 'rentabilite' : 'clotures_caisse';
      saveBlob(await api.pilotage.exportCsv(kind, range), `${name}_${range.from}_${range.to}.csv`);
    } catch (err) {
      setProblem(describeError(err).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="pil-page">
      <PageHeader title="Rentabilité" description="Ce que rapporte chaque couloir d’envoi, après commissions." />
      <div className="pil-chips" role="group" aria-label="Période">
        {PERIOD_OPTIONS.map((o) => (
          <button key={o.id} type="button" className="pil-chip" aria-pressed={period === o.id} onClick={() => setPeriod(o.id)}>{o.label}</button>
        ))}
      </div>
      {problem ? <Notice tone="error">{problem}</Notice> : null}

      {res.loading && !data ? (
        <div className="center-block"><Spinner label="Calcul de la rentabilité" /></div>
      ) : res.error || !data ? (
        <Notice tone="error" title="Rentabilité indisponible" action={<Button variant="secondary" onClick={res.reload}>Réessayer</Button>}>{describeError(res.error).message}</Notice>
      ) : (
        <>
          {data.totals.length > 0 ? (
            <KpiGrid label="Totaux par devise" className="dash-kpis--stats dash-kpis--grid">
              {data.totals.map((t) => (
                <KpiCard key={t.currency} icon="chart" tone="ok" label={`Marge nette · ${t.currency}`} value={formatAmount(t.net, t.currency)} note={`${t.count} envoi(s) · frais ${formatAmount(t.fees, t.currency)}`} />
              ))}
            </KpiGrid>
          ) : null}

          {data.corridors.length === 0 ? (
            <p className="pil-empty">Aucun envoi sur cette période.</p>
          ) : (
            <div className="pil-list">
              {data.corridors.map((c, i) => (
                <Card as="article" key={c.corridor} className="pil-card" data-tone={c.net > 0 ? 'ok' : 'warn'} style={{ ['--i' as string]: i }}>
                  <div className="pil-head">
                    <div>
                      <h2 className="pil-title">{c.corridor}</h2>
                      <p className="pil-sub">{c.count} envoi(s) · {formatAmount(c.sent, c.currency)} envoyés</p>
                    </div>
                    <Pill tone={c.net > 0 ? 'ok' : 'warn'}>{pctLabel(c.marginPct)}</Pill>
                  </div>
                  <div className="pil-fig pil-fig--big"><span>Marge nette estimée</span><strong>{formatAmount(c.net, c.currency)}</strong></div>
                  <div className="pil-bar" role="img" aria-label={`Marge ${pctLabel(c.marginPct)} des frais`}>
                    <div className="pil-bar__fill" style={{ width: `${Math.max(3, Math.round((Math.abs(c.net) / best) * 100))}%` }} />
                  </div>
                  <div className="pil-figs pil-figs--3">
                    <div className="pil-fig"><span>Frais perçus</span><strong>{formatAmount(c.fees, c.currency)}</strong></div>
                    <div className="pil-fig"><span>Commissions agents</span><strong>{formatAmount(c.agentCommissions, c.currency)}</strong></div>
                    <div className="pil-fig"><span>Part plateforme</span><strong>{formatAmount(c.platformShare, c.currency)}</strong></div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <h2 className="pil-section">Exports comptables (CSV)</h2>
          <div className="pil-actions">
            <Button variant="secondary" icon="download" busy={exporting === 'profitability'} onClick={() => void download('profitability')}>Rentabilité</Button>
            <Button variant="secondary" icon="download" busy={exporting === 'transactions'} onClick={() => void download('transactions')}>Toutes les opérations</Button>
            <Button variant="secondary" icon="download" busy={exporting === 'closings'} onClick={() => void download('closings')}>Clôtures de caisse</Button>
          </div>
          <p className="pil-foot">Période du {range.from} au {range.to}. La marge est une estimation : elle ne tient pas compte des coûts de structure ni de l’écart entre votre taux et le taux du marché.</p>
        </>
      )}
    </div>
  );
}
