// src/pages/compliance/WatchlistPage.tsx
// Listes de surveillance : sanctions, personnes politiquement exposées, liste interne. Saisie, import en masse (un nom par ligne),
// test d'un nom (voir si, et à quel pourcentage, il serait signalé) et contrôle de toute la clientèle.

import { useMemo, useState } from 'react';
import type { WatchlistEntry, WatchlistKind, NameMatch } from '@direct-transfair/shared';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { ConfirmDialog, SelectField, TextAreaField } from '../../components/form';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { ROLE_LABEL, SOURCE_LABEL, WATCHLIST_LABEL, WATCHLIST_OPTIONS, WATCHLIST_TONE, scoreTone } from '../../lib/complianceRules';
import { useResource } from '../../lib/useResource';
import { ComplianceTabs } from './ComplianceTabs';
import { OfficialListsSection } from './OfficialListsSection';

interface Draft { id: string | null; kind: WatchlistKind; fullName: string; aliases: string; country: string; birthYear: string; reference: string; notes: string }
const EMPTY: Draft = { id: null, kind: 'SANCTION', fullName: '', aliases: '', country: '', birthYear: '', reference: '', notes: '' };

const toDraft = (e: WatchlistEntry): Draft => ({
  id: e.id, kind: e.kind, fullName: e.fullName, aliases: e.aliases.join(' | '), country: e.country ?? '', birthYear: e.birthYear ? String(e.birthYear) : '', reference: e.reference ?? '', notes: e.notes ?? '',
});

const IMPORT_HELP = 'Une personne par ligne : Nom complet ; alias1 | alias2 ; pays ; année de naissance ; référence\nSeul le nom est obligatoire. Les lignes qui commencent par # sont ignorées.';

export default function WatchlistPage() {
  const [kind, setKind] = useState<'' | WatchlistKind>('');
  const [search, setSearch] = useState('');
  const list = useResource(() => api.compliance.watchlist({ kind: kind || undefined, search: search.trim() || undefined }), [kind, search]);
  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const [importKind, setImportKind] = useState<WatchlistKind>('SANCTION');
  const [importText, setImportText] = useState('');
  const [deleting, setDeleting] = useState<WatchlistEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ line: number; message: string }[]>([]);

  const [testName, setTestName] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ matches: NameMatch[]; threshold: number; strongThreshold: number } | null>(null);
  const [screening, setScreening] = useState(false);

  const fail = (err: unknown) => setError(describeError(err).message);

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.fullName.trim();
    if (name.length < 3) return setError('Le nom doit comporter 3 caractères au moins.');
    const year = draft.birthYear.trim();
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900)) return setError('Année de naissance invalide (4 chiffres).');
    const body = {
      kind: draft.kind, fullName: name,
      aliases: draft.aliases.split('|').map((a) => a.trim()).filter(Boolean),
      country: draft.country.trim() || undefined, birthYear: year ? Number(year) : undefined,
      reference: draft.reference.trim() || undefined, notes: draft.notes.trim() || undefined,
    };
    setBusy(true); setError(null);
    try {
      if (draft.id) await api.compliance.updateEntry(draft.id, { ...body, country: draft.country.trim(), reference: draft.reference.trim(), notes: draft.notes.trim() });
      else await api.compliance.createEntry(body);
      setDraft(null); setInfo(draft.id ? 'Fiche modifiée.' : 'Fiche ajoutée.'); list.reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const toggle = async (e: WatchlistEntry) => {
    setError(null); setInfo(null);
    try { await api.compliance.updateEntry(e.id, { isActive: !e.isActive }); list.reload(); } catch (err) { fail(err); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    try { await api.compliance.removeEntry(deleting.id); setDeleting(null); setInfo('Fiche supprimée.'); list.reload(); } catch (err) { fail(err); setDeleting(null); } finally { setBusy(false); }
  };

  const runImport = async () => {
    setBusy(true); setError(null); setImportErrors([]);
    try {
      const r = await api.compliance.importEntries(importKind, importText);
      setImportErrors(r.errors);
      setInfo(`${r.created} fiche(s) ajoutée(s)${r.skipped ? `, ${r.skipped} déjà présente(s)` : ''}${r.errors.length ? `, ${r.errors.length} ligne(s) ignorée(s)` : ''}.`);
      if (!r.errors.length) { setImporting(false); setImportText(''); }
      list.reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const runTest = async () => {
    if (testName.trim().length < 2) return;
    setTesting(true); setError(null);
    try { setTestResult(await api.compliance.testName(testName.trim())); } catch (err) { fail(err); } finally { setTesting(false); }
  };

  const screenAll = async () => {
    setScreening(true); setError(null); setInfo(null);
    try {
      const r = await api.compliance.screenCustomers();
      setInfo(`${r.checked} client(s) contrôlé(s) : ${r.cases} nouveau(x) dossier(s) ouvert(s).`);
    } catch (err) { fail(err); } finally { setScreening(false); }
  };

  return (
    <div className="cmp-page">
      <PageHeader
        title="Listes de surveillance"
        description="Chaque envoi est comparé à ces noms et aux listes officielles activées (expéditeur, destinataire, bénéficiaire). Une ressemblance forte ouvre un dossier."
        actions={<><Button variant="secondary" icon="download" onClick={() => { setImportErrors([]); setImporting(true); }}>Importer</Button><Button icon="plus" onClick={() => { setError(null); setDraft({ ...EMPTY }); }}>Ajouter</Button></>}
      />
      <ComplianceTabs />

      <OfficialListsSection />

      <Card className="cmp-tool" style={{ ['--i' as string]: 0 }}>
        <h2 className="cmp-tool__title">Tester un nom</h2>
        <p className="cmp-tool__sub">Voyez si un nom serait signalé (vos listes et les listes officielles activées), et à quel pourcentage. Rien n’est enregistré.</p>
        <div className="cmp-tool__row">
          <Field id="cmp-test" label="Nom à tester" value={testName} onChange={(e) => setTestName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }} maxLength={160} />
          <Button busy={testing} onClick={runTest} disabled={testName.trim().length < 2}>Tester</Button>
        </div>
        {testResult ? (
          testResult.matches.length === 0 ? <Notice tone="ok">Aucune ressemblance notable avec vos listes.</Notice> : (
            <div className="cmp-testres">
              {testResult.matches.map((m, i) => (
                <div key={`${m.entryId}-${i}`} className="cmp-match">
                  <div className="cmp-match__top"><strong>{m.entryName}</strong>{SOURCE_LABEL(m.source) ? <Pill tone="brand">{SOURCE_LABEL(m.source)}</Pill> : null}<Pill tone={scoreTone(m.score)}>{m.score} %</Pill></div>
                  <div className="cmp-bar"><span style={{ width: `${m.score}%` }} data-tone={scoreTone(m.score)} /></div>
                  <p className="cmp-match__line">{ROLE_LABEL[m.subjectRole] ?? ''}{m.matchedOn !== m.entryName ? ` · alias « ${m.matchedOn} »` : ''} · {m.score >= testResult.strongThreshold ? 'correspondance forte' : m.score >= testResult.threshold ? 'serait signalé' : 'sous le seuil de signalement'}</p>
                </div>
              ))}
            </div>
          )
        ) : null}
        <div className="cmp-tool__foot">
          <Button variant="secondary" busy={screening} onClick={screenAll} icon="search">Contrôler toute la clientèle</Button>
          <span>Compare tous vos clients aux listes et ouvre un dossier par correspondance.</span>
        </div>
      </Card>

      <div className="cmp-toolbar">
        <div className="pil-chips" role="group" aria-label="Type de liste">
          <button type="button" className="pil-chip" aria-pressed={kind === ''} onClick={() => setKind('')}>Toutes</button>
          {WATCHLIST_OPTIONS.map((o) => (
            <button key={o.value} type="button" className="pil-chip" aria-pressed={kind === o.value} onClick={() => setKind(o.value as WatchlistKind)}>{o.label}</button>
          ))}
        </div>
        <div className="field cmp-search">
          <label htmlFor="cmp-wl-search" className="sr-only">Rechercher une fiche</label>
          <div className="field__control"><input id="cmp-wl-search" type="search" placeholder="Rechercher un nom, une référence…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
      </div>

      {info ? <Notice tone="ok">{info}</Notice> : null}
      {error && !draft && !importing ? <Notice tone="error">{error}</Notice> : null}

      {list.loading && items.length === 0 ? (
        <div className="center-block"><Spinner label="Chargement des listes" /></div>
      ) : list.error && items.length === 0 ? (
        <Notice tone="error" title="Listes indisponibles" action={<Button variant="secondary" onClick={list.reload}>Réessayer</Button>}>{describeError(list.error).message}</Notice>
      ) : items.length === 0 ? (
        <Card className="cmp-empty"><div className="cmp-empty__icon" aria-hidden="true">👁</div><h3>Aucune fiche</h3><p>Ajoutez une personne ou importez votre liste (un nom par ligne).</p></Card>
      ) : (
        <div className="cmp-list cmp-list--grid">
          {items.map((e, i) => (
            <Card key={e.id} className={`cmp-entry${e.isActive ? '' : ' is-off'}`} style={{ ['--i' as string]: Math.min(i, 10) }}>
              <div className="cmp-entry__top">
                <Pill tone={WATCHLIST_TONE[e.kind]}>{WATCHLIST_LABEL[e.kind]}</Pill>
                <label className="grw-switch" aria-label={`${e.isActive ? 'Désactiver' : 'Activer'} ${e.fullName}`}>
                  <input type="checkbox" checked={e.isActive} onChange={() => void toggle(e)} />
                  <span className="grw-switch__track" aria-hidden="true" />
                </label>
              </div>
              <h3 className="cmp-entry__name">{e.fullName}</h3>
              {e.aliases.length ? <p className="cmp-entry__aliases">Alias : {e.aliases.join(' · ')}</p> : null}
              <p className="cmp-entry__meta">{[e.country, e.birthYear ? `né(e) en ${e.birthYear}` : null, e.reference ? `fiche ${e.reference}` : null].filter(Boolean).join(' · ') || ' '}</p>
              {e.notes ? <p className="cmp-entry__notes">{e.notes}</p> : null}
              <div className="cmp-entry__actions">
                <Button variant="secondary" icon="edit" onClick={() => { setError(null); setDraft(toDraft(e)); }}>Modifier</Button>
                <Button variant="ghost" icon="trash" onClick={() => setDeleting(e)} aria-label={`Supprimer ${e.fullName}`}>Supprimer</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!draft} title={draft?.id ? 'Modifier la fiche' : 'Ajouter une fiche'} confirmLabel="Enregistrer" busy={busy} onConfirm={saveDraft} onCancel={() => { if (!busy) setDraft(null); }}>
        {draft ? (
          <div className="cmp-form">
            <SelectField id="wl-kind" label="Liste" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as WatchlistKind })} options={WATCHLIST_OPTIONS} />
            <Field id="wl-name" label="Nom complet" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} maxLength={160} autoComplete="off" />
            <Field id="wl-aliases" label="Alias" hint="Séparés par « | »." value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} />
            <div className="cmp-form__row">
              <Field id="wl-country" label="Pays" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} maxLength={60} />
              <Field id="wl-year" label="Année de naissance" inputMode="numeric" value={draft.birthYear} onChange={(e) => setDraft({ ...draft, birthYear: e.target.value })} maxLength={4} />
            </div>
            <Field id="wl-ref" label="Référence" hint="Identifiant dans la liste d’origine." value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} maxLength={80} />
            <TextAreaField id="wl-notes" label="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={500} />
            {error ? <Notice tone="error">{error}</Notice> : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog open={importing} title="Importer une liste" confirmLabel="Importer" busy={busy} confirmDisabled={importText.trim().length < 3} onConfirm={runImport} onCancel={() => { if (!busy) setImporting(false); }}>
        <div className="cmp-form">
          <SelectField id="imp-kind" label="Ajouter à la liste" value={importKind} onChange={(e) => setImportKind(e.target.value as WatchlistKind)} options={WATCHLIST_OPTIONS} />
          <TextAreaField id="imp-text" label="Noms" rows={8} hint={IMPORT_HELP} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'Ibrahima Sory Conde ; Sory Conde | I. S. Conde ; GN ; 1970 ; LST-12'} />
          {importErrors.length ? (
            <Notice tone="error" title="Lignes ignorées">{importErrors.slice(0, 6).map((e) => `ligne ${e.line} : ${e.message}`).join(' — ')}{importErrors.length > 6 ? ` — et ${importErrors.length - 6} autre(s)` : ''}</Notice>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog open={!!deleting} title="Supprimer cette fiche ?" confirmLabel="Supprimer" tone="danger" busy={busy} onConfirm={remove} onCancel={() => { if (!busy) setDeleting(null); }}>
        <p>« {deleting?.fullName} » ne sera plus comparée aux envois. Les dossiers déjà ouverts sont conservés. Pour garder la fiche sans qu’elle soit utilisée, désactivez-la plutôt.</p>
      </ConfirmDialog>
    </div>
  );
}
