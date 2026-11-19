// src/pages/compliance/CompliancePage.tsx
// Conformité (administrateur de société) : dossiers ouverts par le filtrage des listes de surveillance et par les règles anti-blanchiment.
// Un envoi bloqué attend ici sa décision : débloquer, ou rejeter (annulation + remboursement). Chaque décision est justifiée et tracée.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CaseAction, ComplianceCase } from '@direct-transfair/shared';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { api } from '../../lib/api';
import { when } from '../../lib/dashboardRules';
import { describeError } from '../../lib/errors';
import {
  CASE_FILTERS, KIND_LABEL, RULE_LABEL, ROLE_LABEL, SEVERITY_LABEL, SEVERITY_TONE, STATUS_LABEL, STATUS_TONE,
  actionsFor, isHeld, scoreTone, type ActionSpec,
  SOURCE_LABEL,
} from '../../lib/complianceRules';
import { useResource } from '../../lib/useResource';
import { KpiCard, KpiGrid } from '../dashboard/parts';
import { ComplianceTabs } from './ComplianceTabs';

const money = (n: number, cur: string) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${cur}`;

function CaseCard({ c, index, onAct }: { c: ComplianceCase; index: number; onAct: (c: ComplianceCase, spec: ActionSpec) => void }) {
  const [open, setOpen] = useState(false);
  const d = c.details;
  const held = isHeld(c);
  const actions = actionsFor(c);
  return (
    <Card className={`cmp-case cmp-case--${c.severity.toLowerCase()}${held ? ' cmp-case--held' : ''}`} style={{ ['--i' as string]: Math.min(index, 8) }}>
      <div className="cmp-case__head">
        <div className="cmp-case__pills">
          <Pill tone={SEVERITY_TONE[c.severity]} icon="alert">{SEVERITY_LABEL[c.severity]}</Pill>
          <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
          {held ? <Pill tone="danger" icon="shield">Envoi bloqué</Pill> : null}
        </div>
        <span className="cmp-case__when">{when(c.createdAt)}</span>
      </div>

      <h3 className="cmp-case__title">{KIND_LABEL[c.kind] ?? c.kind}</h3>
      <p className="cmp-case__reason">{c.reason}</p>

      {c.transaction ? (
        <p className="cmp-case__tx">
          <Link to={`/transactions/${c.transaction.id}`}>{c.transaction.reference}</Link>
          <span>{money(c.transaction.amount, c.transaction.currency)}</span>
          <span className="cmp-case__txstatus">{c.transaction.status}</span>
        </p>
      ) : c.details?.customer ? <p className="cmp-case__tx"><span>Contrôle de la clientèle</span></p> : null}

      {c.resolution ? <p className="cmp-case__resolution"><strong>Décision :</strong> {c.resolution}</p> : null}

      {(d?.matches?.length || d?.reasons?.length) ? (
        <>
          <button type="button" className="cmp-case__more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Masquer le détail' : 'Voir le détail'}
          </button>
          {open ? (
            <div className="cmp-detail">
              {d?.matches?.map((m, i) => (
                <div key={`${m.entryId}-${m.subjectRole}-${i}`} className="cmp-match">
                  <div className="cmp-match__top">
                    <strong>{m.subjectName}</strong>
                    <Pill tone={scoreTone(m.score)}>{m.score} %</Pill>
                  </div>
                  <div className="cmp-bar" role="img" aria-label={`Ressemblance ${m.score} %`}><span style={{ width: `${m.score}%` }} data-tone={scoreTone(m.score)} /></div>
                  <p className="cmp-match__line">{ROLE_LABEL[m.subjectRole] ?? m.subjectRole} ≈ <strong>{m.entryName}</strong>{m.matchedOn !== m.entryName ? ` (alias « ${m.matchedOn} »)` : ''}{m.reference ? ` · fiche ${m.reference}` : ''}{SOURCE_LABEL(m.source) ? ` · liste officielle ${SOURCE_LABEL(m.source)}` : ''}</p>
                </div>
              ))}
              {d?.reasons?.length ? (
                <ul className="cmp-reasons">
                  {d.reasons.map((r) => <li key={r}>{r}</li>)}
                  {d.score !== undefined ? <li className="cmp-reasons__score">Score de risque : <strong>{d.score} / 100</strong></li> : null}
                </ul>
              ) : null}
              {d?.rules?.length ? <div className="cmp-rules">{d.rules.map((r) => <Pill key={r} tone="warn">{RULE_LABEL[r] ?? r}</Pill>)}</div> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {actions.length ? (
        <div className="cmp-case__actions">
          {actions.map((a) => (
            <Button key={a.action} variant={a.tone === 'danger' ? 'danger' : a.action === 'RELEASE' || a.action === 'TAKE' ? 'primary' : 'secondary'} onClick={() => onAct(c, a)}>{a.label}</Button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export default function CompliancePage() {
  const [filterId, setFilterId] = useState('open');
  const [search, setSearch] = useState('');
  const filter = CASE_FILTERS.find((f) => f.id === filterId) ?? CASE_FILTERS[0]!;
  const overview = useResource(() => api.compliance.overview(), []);
  const cases = useResource(() => api.compliance.cases({ status: filter.status, kind: filter.kind, search: search.trim() || undefined }), [filter.status, filter.kind, search]);
  const [pending, setPending] = useState<{ c: ComplianceCase; spec: ActionSpec } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reloadAll = () => { overview.reload(); cases.reload(); };
  const items = useMemo(() => cases.data?.items ?? [], [cases.data]);
  const o = overview.data;

  const run = async (c: ComplianceCase, action: CaseAction, text: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.compliance.actOnCase(c.id, action, text.trim() || undefined);
      setPending(null);
      setNote('');
      setDone(action === 'REJECT' ? 'Envoi rejeté et remboursé.' : action === 'RELEASE' ? 'Envoi débloqué.' : 'Dossier mis à jour.');
      reloadAll();
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const onAct = (c: ComplianceCase, spec: ActionSpec) => {
    setDone(null);
    setError(null);
    if (spec.needsNote) { setNote(''); setPending({ c, spec }); } else void run(c, spec.action, '');
  };

  return (
    <div className="cmp-page">
      <PageHeader title="Conformité" description="Alertes de surveillance et d’anti-blanchiment à examiner. Chaque décision est justifiée et conservée." />
      <ComplianceTabs />

      <KpiGrid label="Indicateurs de conformité" className="dash-kpis--stats dash-kpis--grid">
        <KpiCard icon="alert" label="À traiter" value={o ? String(o.open) : '…'} note={o ? `${o.openBySeverity.CRITICAL ?? 0} critique(s) · ${o.openBySeverity.HIGH ?? 0} élevée(s)` : undefined} tone={o && o.open > 0 ? 'warn' : 'ok'} loading={!o} />
        <KpiCard icon="shield" label="Envois bloqués" value={o ? String(o.heldTransactions) : '…'} note="attendent votre décision" tone={o && o.heldTransactions > 0 ? 'warn' : 'ok'} loading={!o} />
        <KpiCard icon="eye" label="Surveillance (30 j)" value={o ? String(o.sanctionCases30d) : '…'} note="correspondances" loading={!o} />
        <KpiCard icon="percent" label="Anti-blanchiment (30 j)" value={o ? String(o.amlCases30d) : '…'} note="envois signalés" loading={!o} />
      </KpiGrid>

      {o && !o.settings.sanctionsEnabled ? <Notice tone="info" title="Filtrage des listes désactivé">Aucun nom n’est comparé aux listes. Réactivez-le dans l’onglet Règles.</Notice> : null}
      {o && o.settings.sanctionsEnabled && !Object.values(o.watchlist).some((n) => n > 0) ? (
        <Notice tone="info" title="Aucune liste de surveillance" action={<Link className="btn btn--secondary" to="/conformite/listes">Ajouter une liste</Link>}>Sans fiche, aucun envoi n’est comparé. Importez votre liste de sanctions ou saisissez-la à la main.</Notice>
      ) : null}

      <div className="cmp-toolbar">
        <div className="pil-chips" role="group" aria-label="Filtrer les dossiers">
          {CASE_FILTERS.map((f) => (
            <button key={f.id} type="button" className="pil-chip" aria-pressed={filterId === f.id} onClick={() => setFilterId(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="field cmp-search">
          <label htmlFor="cmp-search" className="sr-only">Rechercher un dossier</label>
          <div className="field__control"><input id="cmp-search" type="search" placeholder="Rechercher un nom, une référence…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
      </div>

      {done ? <Notice tone="ok">{done}</Notice> : null}
      {error && !pending ? <Notice tone="error">{error}</Notice> : null}

      {cases.loading && items.length === 0 ? (
        <div className="center-block"><Spinner label="Chargement des dossiers" /></div>
      ) : cases.error && items.length === 0 ? (
        <Notice tone="error" title="Dossiers indisponibles" action={<Button variant="secondary" onClick={cases.reload}>Réessayer</Button>}>{describeError(cases.error).message}</Notice>
      ) : items.length === 0 ? (
        <Card className="cmp-empty"><div className="cmp-empty__icon" aria-hidden="true">✓</div><h3>Rien à traiter</h3><p>Aucun dossier ne correspond à ce filtre.</p></Card>
      ) : (
        <div className="cmp-list">
          {items.map((c, i) => <CaseCard key={c.id} c={c} index={i} onAct={onAct} />)}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={pending?.spec.label ?? ''}
        confirmLabel={pending?.spec.label ?? 'Confirmer'}
        tone={pending?.spec.tone === 'danger' ? 'danger' : 'default'}
        busy={busy}
        confirmDisabled={note.trim().length < 5}
        onConfirm={() => pending && void run(pending.c, pending.spec.action, note)}
        onCancel={() => { if (!busy) { setPending(null); setError(null); } }}
      >
        <p>{pending?.spec.help}</p>
        <TextAreaField id="cmp-note" label="Justification" hint="5 caractères au moins. Conservée au journal d’audit." value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ConfirmDialog>
    </div>
  );
}
