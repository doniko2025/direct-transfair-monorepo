// src/pages/growth/ReferralPage.tsx
// Parrainage (administrateur de société) : réglage du programme + résultats.
// Le filleul reçoit des envois sans frais à son inscription ; le parrain en gagne quand son filleul fait son premier envoi.

import { useEffect, useState } from 'react';
import type { ReferralSettings, ReferralStats } from '@direct-transfair/shared';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { parseAmountInput } from '../../lib/pilotageRules';
import { useResource } from '../../lib/useResource';
import { KpiCard, KpiGrid } from '../dashboard/parts';

interface Draft { isActive: boolean; refereeWaivers: string; referrerWaivers: string; minFirstTransfer: string; rewardValidityDays: string; maxRewardsPerMonth: string }

const toDraft = (c: ReferralSettings): Draft => ({
  isActive: c.isActive,
  refereeWaivers: String(c.refereeWaivers),
  referrerWaivers: String(c.referrerWaivers),
  minFirstTransfer: String(c.minFirstTransfer),
  rewardValidityDays: String(c.rewardValidityDays),
  maxRewardsPerMonth: String(c.maxRewardsPerMonth),
});

function intIn(raw: string, min: number, max: number, label: string): number | string {
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < min || n > max) return `${label} : un nombre entier entre ${min} et ${max}.`;
  return n;
}

function parseDraft(d: Draft): ReferralSettings | string {
  const referee = intIn(d.refereeWaivers, 0, 10, 'Envois offerts au filleul');
  if (typeof referee === 'string') return referee;
  const referrer = intIn(d.referrerWaivers, 0, 10, 'Envois offerts au parrain');
  if (typeof referrer === 'string') return referrer;
  const validity = intIn(d.rewardValidityDays, 1, 365, 'Validité');
  if (typeof validity === 'string') return validity;
  const cap = intIn(d.maxRewardsPerMonth, 1, 1000, 'Plafond mensuel');
  if (typeof cap === 'string') return cap;
  const min = d.minFirstTransfer.trim() === '' ? 0 : parseAmountInput(d.minFirstTransfer);
  if (min === null || min < 0) return 'Montant minimal du premier envoi invalide.';
  return { isActive: d.isActive, refereeWaivers: referee, referrerWaivers: referrer, minFirstTransfer: min, rewardValidityDays: validity, maxRewardsPerMonth: cap };
}

export default function ReferralPage() {
  const stats = useResource(() => api.growth.referralStats(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const data: ReferralStats | null = stats.data ?? null;

  useEffect(() => {
    if (data && !draft) setDraft(toDraft(data.config));
  }, [data, draft]);

  const set = (patch: Partial<Draft>) => { setDraft((d) => (d ? { ...d, ...patch } : d)); setSaved(false); setError(null); };

  const save = async () => {
    if (!draft) return;
    const parsed = parseDraft(draft);
    if (typeof parsed === 'string') return setError(parsed);
    setBusy(true);
    setError(null);
    try {
      const next = await api.growth.saveReferralConfig(parsed);
      setDraft(toDraft(next));
      setSaved(true);
      stats.reload();
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grw-page">
      <PageHeader title="Parrainage" description="Offrez des envois sans frais à vos nouveaux clients et à ceux qui les amènent." />

      {stats.loading && !data ? (
        <div className="center-block"><Spinner label="Chargement du parrainage" /></div>
      ) : stats.error || !data || !draft ? (
        <Notice tone="error" title="Parrainage indisponible" action={<Button variant="secondary" onClick={stats.reload}>Réessayer</Button>}>{describeError(stats.error).message}</Notice>
      ) : (
        <>
          <KpiGrid label="Résultats du parrainage" className="dash-kpis--stats dash-kpis--grid">
            <KpiCard icon="users" label="Filleuls" value={String(data.referredTotal)} note={`${data.referredMonth} ce mois-ci`} tone={data.referredMonth ? 'ok' : 'default'} />
            <KpiCard icon="percent" label="Envois offerts" value={String(data.rewardsGiven.referee + data.rewardsGiven.referrer)} note={`${data.rewardsGiven.referee} filleuls · ${data.rewardsGiven.referrer} parrains`} />
            <KpiCard icon="send" label="Déjà utilisés" value={String(data.rewardsUsedAtLeastOnce)} note="récompenses entamées" tone="ok" />
            <KpiCard icon="wallet" label="À utiliser" value={String(data.rewardsAvailable)} note="récompenses disponibles" />
          </KpiGrid>

          <Card className="grw-card" style={{ ['--i' as string]: 0 }}>
            <div className="grw-head">
              <div>
                <h2 className="grw-title">Programme</h2>
                <p className="grw-sub">{draft.isActive ? 'Actif : le code de parrainage est récompensé.' : 'Désactivé : les codes sont enregistrés mais rien n’est offert.'}</p>
              </div>
              <label className="grw-switch" aria-label="Activer le parrainage">
                <input type="checkbox" checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
                <span className="grw-switch__track" aria-hidden="true" />
              </label>
            </div>

            <div className="grw-grid">
              <Field id="rf-referee" label="Envois sans frais pour le filleul" inputMode="numeric" value={draft.refereeWaivers} onChange={(e) => set({ refereeWaivers: e.target.value })} hint="Offerts à l’inscription avec un code." />
              <Field id="rf-referrer" label="Envois sans frais pour le parrain" inputMode="numeric" value={draft.referrerWaivers} onChange={(e) => set({ referrerWaivers: e.target.value })} hint="Gagnés au premier envoi du filleul." />
              <Field id="rf-min" label="Premier envoi minimal" inputMode="decimal" value={draft.minFirstTransfer} onChange={(e) => set({ minFirstTransfer: e.target.value })} hint="Sous ce montant, le parrain ne gagne rien (0 = aucun minimum)." />
              <Field id="rf-days" label="Validité (jours)" inputMode="numeric" value={draft.rewardValidityDays} onChange={(e) => set({ rewardValidityDays: e.target.value })} hint="Après ce délai, l’envoi offert expire." />
              <Field id="rf-cap" label="Plafond par parrain et par mois" inputMode="numeric" value={draft.maxRewardsPerMonth} onChange={(e) => set({ maxRewardsPerMonth: e.target.value })} hint="Limite les abus : récompenses « parrain » par mois." />
            </div>

            {error ? <Notice tone="error">{error}</Notice> : null}
            {saved ? <Notice tone="ok">Réglages enregistrés.</Notice> : null}
            <div className="grw-actions"><Button busy={busy} onClick={save}>Enregistrer</Button></div>
            <p className="grw-note">Un envoi offert annule les frais de cet envoi (la commission n’est pas facturée au client). Pas d’envoi offert au comptoir ni pour les envois planifiés.</p>
          </Card>

          <Card className="grw-card" style={{ ['--i' as string]: 1 }}>
            <h2 className="grw-title">Meilleurs parrains</h2>
            {data.topReferrers.length === 0 ? (
              <p className="grw-sub">Aucun filleul pour l’instant. Vos clients trouvent leur code dans l’application, rubrique Parrainage.</p>
            ) : (
              <ol className="grw-top">
                {data.topReferrers.map((r, i) => (
                  <li key={r.userId} className="grw-top__row" style={{ ['--i' as string]: i }}>
                    <span className="grw-top__rank" aria-hidden="true">{i + 1}</span>
                    <span className="grw-top__name">{r.name}</span>
                    <Pill tone={i === 0 ? 'brand' : 'neutral'}>{r.referred} filleul{r.referred > 1 ? 's' : ''}</Pill>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
