// src/pages/compliance/RulesPage.tsx
// Règles de conformité d'une société : filtrage des listes (seuils, blocage automatique) et règles anti-blanchiment réglables.

import { useEffect, useState } from 'react';
import type { ComplianceSettings } from '@direct-transfair/shared';
import { Button, Card, Field, Notice, PageHeader, Spinner } from '../../components/ui';
import { TextAreaField } from '../../components/form';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { parseCountries } from '../../lib/complianceRules';
import { parseAmountInput } from '../../lib/pilotageRules';
import { useResource } from '../../lib/useResource';
import { ComplianceTabs } from './ComplianceTabs';

interface Draft {
  sanctionsEnabled: boolean; holdOnStrongMatch: boolean; matchThreshold: string; strongMatchThreshold: string;
  amlThresholdXof: string; amlFlagScore: string; highRiskCountries: string; structuringCount: string; fanInSenders: string;
}

const toDraft = (s: ComplianceSettings): Draft => ({
  sanctionsEnabled: s.sanctionsEnabled, holdOnStrongMatch: s.holdOnStrongMatch,
  matchThreshold: String(s.matchThreshold), strongMatchThreshold: String(s.strongMatchThreshold),
  amlThresholdXof: s.amlThresholdXof === null ? '' : String(s.amlThresholdXof), amlFlagScore: s.amlFlagScore === null ? '' : String(s.amlFlagScore),
  highRiskCountries: s.highRiskCountries.join(', '), structuringCount: String(s.structuringCount), fanInSenders: String(s.fanInSenders),
});

const intIn = (raw: string, min: number, max: number, label: string): number | string => {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : `${label} : un nombre entier entre ${min} et ${max}.`;
};

function parseDraft(d: Draft): Parameters<typeof api.compliance.saveSettings>[0] | string {
  const match = intIn(d.matchThreshold, 70, 100, 'Seuil de signalement');
  if (typeof match === 'string') return match;
  const strong = intIn(d.strongMatchThreshold, 70, 100, 'Seuil de blocage');
  if (typeof strong === 'string') return strong;
  if (strong < match) return 'Le seuil de blocage ne peut pas être inférieur au seuil de signalement.';
  const structuring = intIn(d.structuringCount, 0, 20, 'Fractionnement');
  if (typeof structuring === 'string') return structuring;
  const fanIn = intIn(d.fanInSenders, 0, 20, 'Regroupement de fonds');
  if (typeof fanIn === 'string') return fanIn;
  let amlThresholdXof: number | null = null;
  if (d.amlThresholdXof.trim()) {
    const v = parseAmountInput(d.amlThresholdXof);
    if (v === null || v < 1000) return 'Seuil de contrôle : un montant d’au moins 1 000 XOF (ou laissez vide).';
    amlThresholdXof = v;
  }
  let amlFlagScore: number | null = null;
  if (d.amlFlagScore.trim()) {
    const v = intIn(d.amlFlagScore, 1, 100, 'Score de signalement');
    if (typeof v === 'string') return v;
    amlFlagScore = v;
  }
  const countries = parseCountries(d.highRiskCountries);
  if (countries.some((c) => !/^[A-Za-zÀ-ÿ' -]{2,40}$/.test(c))) return 'Pays à risque : lettres uniquement (code ou nom), séparés par des virgules.';
  return {
    sanctionsEnabled: d.sanctionsEnabled, holdOnStrongMatch: d.holdOnStrongMatch, matchThreshold: match, strongMatchThreshold: strong,
    amlThresholdXof, amlFlagScore, highRiskCountries: countries, structuringCount: structuring, fanInSenders: fanIn,
  };
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="grw-switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="grw-switch__track" aria-hidden="true" />
    </label>
  );
}

export default function RulesPage() {
  const res = useResource(() => api.compliance.settings(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const data = res.data;

  useEffect(() => { if (data && !draft) setDraft(toDraft(data)); }, [data, draft]);
  const set = (patch: Partial<Draft>) => { setDraft((d) => (d ? { ...d, ...patch } : d)); setSaved(false); setError(null); };

  const save = async () => {
    if (!draft) return;
    const parsed = parseDraft(draft);
    if (typeof parsed === 'string') return setError(parsed);
    setBusy(true); setError(null);
    try {
      const next = await api.compliance.saveSettings(parsed);
      setDraft(toDraft(next)); setSaved(true); res.reload();
    } catch (err) { setError(describeError(err).message); } finally { setBusy(false); }
  };

  return (
    <div className="cmp-page">
      <PageHeader title="Règles de conformité" description="Réglez la sensibilité du filtrage et les critères anti-blanchiment de votre société." />
      <ComplianceTabs />

      {res.loading && !data ? (
        <div className="center-block"><Spinner label="Chargement des règles" /></div>
      ) : res.error || !data || !draft ? (
        <Notice tone="error" title="Règles indisponibles" action={<Button variant="secondary" onClick={res.reload}>Réessayer</Button>}>{describeError(res.error).message}</Notice>
      ) : (
        <>
          <Card className="grw-card" style={{ ['--i' as string]: 0 }}>
            <div className="grw-head">
              <div>
                <h2 className="grw-title">Listes de surveillance</h2>
                <p className="grw-sub">{draft.sanctionsEnabled ? 'Actif : chaque nouvel envoi est comparé à vos listes.' : 'Désactivé : aucun nom n’est comparé.'}</p>
              </div>
              <Switch checked={draft.sanctionsEnabled} onChange={(v) => set({ sanctionsEnabled: v })} label="Activer le filtrage des listes" />
            </div>
            <div className="grw-grid">
              <Field id="rl-match" label="Seuil de signalement (%)" inputMode="numeric" value={draft.matchThreshold} onChange={(e) => set({ matchThreshold: e.target.value })} hint="Dès cette ressemblance, un dossier est ouvert. Plus bas = plus d’alertes." />
              <Field id="rl-strong" label="Seuil de correspondance forte (%)" inputMode="numeric" value={draft.strongMatchThreshold} onChange={(e) => set({ strongMatchThreshold: e.target.value })} hint="Dossier critique, et blocage si l’option ci-dessous est active." />
            </div>
            <div className="cmp-switchrow">
              <div>
                <strong>Bloquer automatiquement une correspondance forte</strong>
                <p className="grw-sub">L’envoi encore en attente est suspendu jusqu’à votre décision. Désactivé par défaut : un blocage décidé trop vite pénalise des clients innocents (noms très répandus).</p>
              </div>
              <Switch checked={draft.holdOnStrongMatch} onChange={(v) => set({ holdOnStrongMatch: v })} label="Bloquer automatiquement" />
            </div>
          </Card>

          <Card className="grw-card" style={{ ['--i' as string]: 1 }}>
            <div>
              <h2 className="grw-title">Anti-blanchiment</h2>
              <p className="grw-sub">Le score de risque additionne des critères ; au-dessus du score de signalement, un dossier est ouvert (jamais de blocage automatique).</p>
            </div>
            <div className="grw-grid">
              <Field id="rl-thr" label="Seuil de contrôle (XOF)" inputMode="decimal" value={draft.amlThresholdXof} onChange={(e) => set({ amlThresholdXof: e.target.value })} placeholder={String(data.platform.amlThresholdXof)} hint={`Vide = valeur de la plateforme (${data.platform.amlThresholdXof.toLocaleString('fr-FR')} XOF).`} />
              <Field id="rl-score" label="Score de signalement (1 à 100)" inputMode="numeric" value={draft.amlFlagScore} onChange={(e) => set({ amlFlagScore: e.target.value })} placeholder={String(data.platform.amlFlagScore)} hint={`Vide = valeur de la plateforme (${data.platform.amlFlagScore}).`} />
              <Field id="rl-struct" label="Fractionnement : envois juste sous le seuil" inputMode="numeric" value={draft.structuringCount} onChange={(e) => set({ structuringCount: e.target.value })} hint="Nombre d’envois entre 80 % et 100 % du seuil en 24 h (+25 points). 0 = règle coupée." />
              <Field id="rl-fanin" label="Regroupement : expéditeurs vers un même bénéficiaire" inputMode="numeric" value={draft.fanInSenders} onChange={(e) => set({ fanInSenders: e.target.value })} hint="Expéditeurs différents en 24 h (+25 points). 0 = règle coupée." />
            </div>
            <TextAreaField id="rl-countries" label="Pays à risque" value={draft.highRiskCountries} onChange={(e) => set({ highRiskCountries: e.target.value })} hint="Pays de destination qui ajoutent 25 points, séparés par des virgules (comme saisis dans les bénéficiaires, ex. IR, KP)." />
            {error ? <Notice tone="error">{error}</Notice> : null}
            {saved ? <Notice tone="ok">Règles enregistrées. Elles s’appliquent aux prochains envois.</Notice> : null}
            <div className="grw-actions"><Button busy={busy} onClick={save}>Enregistrer</Button></div>
          </Card>
        </>
      )}
    </div>
  );
}
