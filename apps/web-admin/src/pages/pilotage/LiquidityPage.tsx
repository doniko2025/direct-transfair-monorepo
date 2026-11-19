// src/pages/pilotage/LiquidityPage.tsx
// Liquidité (administrateur de société) : niveau de chaque caisse d'agence par rapport à son seuil minimal.
// Sous le seuil, une alerte est créée automatiquement (vérification toutes les 15 minutes) et l'administrateur est notifié.

import { useMemo, useState } from 'react';
import type { LiquidityItem, LiquidityOverview, LiquidityRule } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { gaugePct, LEVEL_LABEL, LEVEL_TONE, parseAmountInput } from '../../lib/pilotageRules';
import { useResource } from '../../lib/useResource';
import { KpiCard, KpiGrid } from '../dashboard/parts';

const CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'];

function RuleDialog({ overview, rule, preset, onClose, onDone }: { overview: LiquidityOverview; rule: LiquidityRule | null; preset?: LiquidityItem | null; onClose: () => void; onDone: () => void }) {
  const agencies = useMemo(() => {
    const seen = new Map<string, string>();
    overview.items.forEach((i) => seen.set(i.agencyId, i.agencyName));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [overview.items]);
  const [agencyId, setAgencyId] = useState(rule?.agencyId ?? preset?.agencyId ?? '');
  const [currency, setCurrency] = useState(rule?.currency ?? preset?.currency ?? 'XOF');
  const [min, setMin] = useState(rule ? String(rule.minBalance) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open
      title={rule ? 'Modifier le seuil' : 'Nouveau seuil de liquidité'}
      confirmLabel="Enregistrer"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        const value = parseAmountInput(min);
        if (value === null || value <= 0) return setError('Saisissez un seuil supérieur à zéro.');
        setBusy(true);
        setError(null);
        api.pilotage
          .saveLiquidityRule({ agencyId: agencyId || null, currency, minBalance: value })
          .then(onDone)
          .catch((err: unknown) => { setError(describeError(err).message); setBusy(false); });
      }}
    >
      <div className="dialog-form">
        <SelectField id="lr-agency" label="Agence" value={agencyId} onChange={(e) => setAgencyId(e.target.value)} options={agencies} placeholder="Toutes les agences" disabled={!!rule} />
        <SelectField id="lr-cur" label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} disabled={!!rule} />
        <Field id="lr-min" label={`Seuil minimal (${currency})`} inputMode="decimal" value={min} onChange={(e) => { setMin(e.target.value); setError(null); }} hint="Vous êtes alerté quand la caisse passe en dessous. « Critique » sous la moitié du seuil." />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function LiquidityPage() {
  const res = useResource(() => api.pilotage.liquidity(), []);
  const [dialog, setDialog] = useState<{ rule: LiquidityRule | null; preset?: LiquidityItem | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const data = res.data;

  const remove = async (r: LiquidityRule) => {
    setProblem(null);
    try {
      await api.pilotage.deleteLiquidityRule(r.id);
      res.reload();
    } catch (err) {
      setProblem(describeError(err).message);
    }
  };

  return (
    <div className="pil-page">
      <PageHeader title="Liquidité" description="Niveau des caisses de vos agences face à leur seuil minimal." actions={<Button icon="plus" onClick={() => setDialog({ rule: null })}>Nouveau seuil</Button>} />
      {problem ? <Notice tone="error">{problem}</Notice> : null}

      {res.loading && !data ? (
        <div className="center-block"><Spinner label="Chargement de la liquidité" /></div>
      ) : res.error || !data ? (
        <Notice tone="error" title="Liquidité indisponible" action={<Button variant="secondary" onClick={res.reload}>Réessayer</Button>}>{describeError(res.error).message}</Notice>
      ) : (
        <>
          <KpiGrid label="Niveaux de caisse" className="dash-kpis--stats dash-kpis--grid">
            <KpiCard icon="alert" label="Critiques" value={String(data.summary.critical)} tone={data.summary.critical ? 'warn' : 'ok'} note={data.summary.critical ? 'à réapprovisionner' : 'Aucune'} />
            <KpiCard icon="vault" label="Sous le seuil" value={String(data.summary.low)} tone={data.summary.low ? 'warn' : 'ok'} note={data.summary.low ? 'alerte envoyée' : 'Aucune'} />
            <KpiCard icon="eye" label="À surveiller" value={String(data.summary.warn)} note="proches du seuil" />
            <KpiCard icon="check" label="Confortables" value={String(data.summary.ok)} tone="ok" note="au-dessus du seuil" />
          </KpiGrid>

          {data.rules.length === 0 ? (
            <Notice title="Aucun seuil défini">Ajoutez un seuil par devise (pour toutes les agences ou pour une agence précise) : vous serez alerté avant la rupture de caisse.</Notice>
          ) : null}

          {data.items.length > 0 ? (
            <div className="pil-list pil-list--3">
              {data.items.map((it, i) => (
                <Card as="article" key={`${it.agencyId}:${it.currency}`} className="pil-card" data-tone={LEVEL_TONE[it.level] === 'ok' ? 'ok' : LEVEL_TONE[it.level] === 'warn' ? 'warn' : 'danger'} style={{ ['--i' as string]: i }}>
                  <div className="pil-head">
                    <div>
                      <h2 className="pil-title">{it.agencyName}</h2>
                      <p className="pil-sub">{it.city} · caisse {it.currency}</p>
                    </div>
                    <Pill tone={LEVEL_TONE[it.level]}>{it.minBalance === null ? 'Sans seuil' : LEVEL_LABEL[it.level]}</Pill>
                  </div>
                  <div className="pil-fig pil-fig--big"><span>Solde</span><strong>{formatAmount(it.balance, it.currency)}</strong></div>
                  {it.minBalance !== null ? (
                    <>
                      <div className="pil-gauge" role="img" aria-label={`Solde ${it.balance} pour un seuil de ${it.minBalance}`}>
                        <div className="pil-gauge__fill" style={{ width: `${gaugePct(it.balance, it.minBalance)}%` }} />
                        <span className="pil-gauge__mark" aria-hidden="true" />
                      </div>
                      <p className="pil-sub">Seuil minimal : {formatAmount(it.minBalance, it.currency)}</p>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setDialog({ rule: null, preset: it })}>Définir un seuil</Button>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <p className="pil-empty">Aucune caisse d’agence à suivre pour le moment.</p>
          )}

          {data.rules.length > 0 ? (
            <>
              <h2 className="pil-section">Seuils définis</h2>
              <div className="pil-list pil-list--3">
                {data.rules.map((r, i) => (
                  <Card as="article" key={r.id} tone="flat" className="pil-card" style={{ ['--i' as string]: i }}>
                    <div className="pil-head">
                      <div>
                        <h3 className="pil-title">{r.agencyName ?? 'Toutes les agences'}</h3>
                        <p className="pil-sub">{r.currency} · minimum {formatAmount(r.minBalance, r.currency)}</p>
                      </div>
                      {r.isActive ? null : <Pill tone="neutral">Inactif</Pill>}
                    </div>
                    <div className="pil-actions">
                      <Button variant="secondary" icon="edit" onClick={() => setDialog({ rule: r })}>Modifier</Button>
                      <Button variant="ghost" icon="trash" onClick={() => void remove(r)}>Supprimer</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {dialog && data ? <RuleDialog overview={data} rule={dialog.rule} preset={dialog.preset} onClose={() => setDialog(null)} onDone={() => { setDialog(null); res.reload(); }} /> : null}
    </div>
  );
}
