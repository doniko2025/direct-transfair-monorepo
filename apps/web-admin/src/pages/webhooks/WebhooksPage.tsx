// src/pages/webhooks/WebhooksPage.tsx
// Webhooks sortants : vos systèmes sont prévenus à chaque changement d'état d'un envoi.
// Signature HMAC horodatée, reprises automatiques à délai croissant, journal des envois, rejeu, désactivation automatique si le point de réception ne répond plus.

import { useMemo, useState } from 'react';
import type { WebhookAttemptResult, WebhookEndpoint, WebhookDeliveryStatus } from '@direct-transfair/shared';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { ConfirmDialog, CopyButton, TextAreaField } from '../../components/form';
import { api } from '../../lib/api';
import { when } from '../../lib/dashboardRules';
import { describeError } from '../../lib/errors';
import { DELIVERY_LABEL, DELIVERY_TONE, HEALTH_LABEL, HEALTH_TONE, VERIFY_SNIPPET, endpointHealth, hostOf, nextAttemptLabel } from '../../lib/complianceRules';
import { useResource } from '../../lib/useResource';

interface Draft { id: string | null; url: string; description: string; events: string[]; maxRetries: string }
const EMPTY: Draft = { id: null, url: '', description: '', events: [], maxRetries: '3' };

const STATUS_FILTERS: { id: '' | WebhookDeliveryStatus; label: string }[] = [
  { id: '', label: 'Tous' }, { id: 'FAILED', label: 'Échecs' }, { id: 'RETRYING', label: 'À reprendre' }, { id: 'SUCCESS', label: 'Reçus' },
];

export default function WebhooksPage() {
  const list = useResource(() => api.webhooks.list(), []);
  const [filterEndpoint, setFilterEndpoint] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | WebhookDeliveryStatus>('');
  const log = useResource(() => api.webhooks.deliveries({ endpointId: filterEndpoint || undefined, status: filterStatus || undefined, take: 40 }), [filterEndpoint, filterStatus]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [secretShown, setSecretShown] = useState<{ url: string; secret: string; rotated: boolean } | null>(null);
  const [deleting, setDeleting] = useState<WebhookEndpoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; r: WebhookAttemptResult } | null>(null);
  const [showCode, setShowCode] = useState(false);

  const endpoints = list.data?.items ?? [];
  const events = list.data?.events ?? [];
  const deliveries = useMemo(() => log.data?.items ?? [], [log.data]);
  const byId = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);
  const reloadAll = () => { list.reload(); log.reload(); };
  const fail = (err: unknown) => setError(describeError(err).message);

  const toggleEvent = (name: string) => setDraft((d) => (d ? { ...d, events: d.events.includes(name) ? d.events.filter((e) => e !== name) : [...d.events, name] } : d));

  const save = async () => {
    if (!draft) return;
    const retries = Number(draft.maxRetries);
    if (!Number.isInteger(retries) || retries < 0 || retries > 8) return setError('Nombre de reprises : un entier entre 0 et 8.');
    if (!draft.url.trim().startsWith('https://')) return setError('L’adresse doit commencer par https://');
    setBusy(true); setError(null);
    try {
      if (draft.id) {
        await api.webhooks.update(draft.id, { url: draft.url.trim(), description: draft.description.trim(), events: draft.events, maxRetries: retries });
        setInfo('Point de réception modifié.');
      } else {
        const created = await api.webhooks.create({ url: draft.url.trim(), description: draft.description.trim() || undefined, events: draft.events, maxRetries: retries });
        setSecretShown({ url: created.url, secret: created.secret, rotated: false });
      }
      setDraft(null); reloadAll();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const act = async (id: string, job: () => Promise<unknown>, ok: string) => {
    setBusyId(id); setError(null); setInfo(null);
    try { await job(); setInfo(ok); reloadAll(); } catch (err) { fail(err); } finally { setBusyId(null); }
  };

  const test = async (e: WebhookEndpoint) => {
    setBusyId(e.id); setError(null); setInfo(null); setTestResult(null);
    try { setTestResult({ id: e.id, r: await api.webhooks.test(e.id) }); log.reload(); } catch (err) { fail(err); } finally { setBusyId(null); }
  };

  const rotate = async (e: WebhookEndpoint) => {
    setBusyId(e.id); setError(null);
    try { const r = await api.webhooks.rotateSecret(e.id); setSecretShown({ url: r.url, secret: r.secret, rotated: true }); reloadAll(); } catch (err) { fail(err); } finally { setBusyId(null); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    try { await api.webhooks.remove(deleting.id); setDeleting(null); setInfo('Point de réception supprimé.'); if (filterEndpoint === deleting.id) setFilterEndpoint(''); reloadAll(); } catch (err) { fail(err); setDeleting(null); } finally { setBusy(false); }
  };

  const replay = async (id: string) => {
    setBusyId(id); setError(null); setInfo(null);
    try { const r = await api.webhooks.replay(id); setInfo(r.ok ? `Rejoué : accepté (${r.statusCode}).` : `Rejoué : refusé${r.statusCode ? ` (${r.statusCode})` : ''} — ${r.response || 'sans réponse'}`); log.reload(); list.reload(); } catch (err) { fail(err); } finally { setBusyId(null); }
  };

  return (
    <div className="cmp-page">
      <PageHeader
        title="Webhooks"
        description="Prévenez vos systèmes à chaque changement d’état d’un envoi, avec reprises automatiques et rejeu."
        actions={<Button icon="plus" onClick={() => { setError(null); setDraft({ ...EMPTY }); }} disabled={endpoints.length >= (list.data?.maxEndpoints ?? 10)}>Ajouter</Button>}
      />

      {info ? <Notice tone="ok">{info}</Notice> : null}
      {error && !draft ? <Notice tone="error">{error}</Notice> : null}

      {list.loading && !list.data ? (
        <div className="center-block"><Spinner label="Chargement des webhooks" /></div>
      ) : list.error && !list.data ? (
        <Notice tone="error" title="Webhooks indisponibles" action={<Button variant="secondary" onClick={list.reload}>Réessayer</Button>}>{describeError(list.error).message}</Notice>
      ) : endpoints.length === 0 ? (
        <Card className="cmp-empty"><div className="cmp-empty__icon" aria-hidden="true">🔔</div><h3>Aucun point de réception</h3><p>Ajoutez l’adresse https de votre système : il recevra un message signé à chaque changement d’état d’un envoi.</p></Card>
      ) : (
        <div className="cmp-list cmp-list--grid">
          {endpoints.map((e, i) => {
            const health = endpointHealth(e);
            const rowBusy = busyId === e.id;
            return (
              <Card key={e.id} className={`wh-card wh-card--${health.toLowerCase()}`} style={{ ['--i' as string]: Math.min(i, 8) }}>
                <div className="cmp-entry__top">
                  <Pill tone={HEALTH_TONE[health]}>{HEALTH_LABEL[health]}</Pill>
                  <span className="wh-card__hint">secret {e.secretHint}</span>
                </div>
                <h3 className="wh-card__host">{hostOf(e.url)}</h3>
                <p className="wh-card__url">{e.url}</p>
                {e.description ? <p className="cmp-entry__notes">{e.description}</p> : null}
                <div className="wh-card__events">
                  {e.events.length === 0 ? <Pill tone="brand">Tous les événements</Pill> : e.events.map((ev) => <Pill key={ev} tone="neutral">{ev.replace('transaction.', '')}</Pill>)}
                </div>
                <div className="wh-stats" aria-label="Dernières 24 heures">
                  <div><strong>{e.stats.success}</strong><span>reçus</span></div>
                  <div><strong>{e.stats.pending}</strong><span>en cours</span></div>
                  <div className={e.stats.failed ? 'is-bad' : ''}><strong>{e.stats.failed}</strong><span>échecs</span></div>
                </div>
                {e.disabledReason ? <Notice tone="error" title="Désactivé automatiquement">{e.disabledReason}. Vérifiez votre serveur, puis réactivez : les envois en attente seront repris.</Notice> : null}
                {testResult?.id === e.id ? (
                  <Notice tone={testResult.r.ok ? 'ok' : 'error'} title={testResult.r.ok ? `Test réussi (${testResult.r.statusCode}, ${testResult.r.durationMs} ms)` : 'Test échoué'}>
                    {testResult.r.ok ? 'Votre système a bien reçu le message.' : `${testResult.r.statusCode ? `Réponse ${testResult.r.statusCode} — ` : ''}${testResult.r.response || 'aucune réponse'}`}
                  </Notice>
                ) : null}
                <div className="wh-card__actions">
                  <Button variant="secondary" busy={rowBusy} onClick={() => void test(e)}>Tester</Button>
                  <Button variant="secondary" onClick={() => { setError(null); setDraft({ id: e.id, url: e.url, description: e.description ?? '', events: e.events, maxRetries: String(e.maxRetries) }); }}>Modifier</Button>
                  <Button variant={e.isActive ? 'ghost' : 'primary'} disabled={rowBusy} onClick={() => void act(e.id, () => api.webhooks.update(e.id, { isActive: !e.isActive }), e.isActive ? 'Mis en pause.' : 'Réactivé.')}>{e.isActive ? 'Pause' : 'Réactiver'}</Button>
                  {e.stats.failed > 0 ? <Button variant="secondary" disabled={rowBusy} onClick={() => void act(e.id, async () => { const r = await api.webhooks.replayFailed(e.id); setInfo(r.queued ? `${r.queued} envoi(s) remis en file.` : 'Aucun échec à reprendre.'); }, 'Échecs remis en file.')}>Rejouer les échecs</Button> : null}
                  <Button variant="ghost" disabled={rowBusy} onClick={() => void rotate(e)}>Nouveau secret</Button>
                  <Button variant="ghost" icon="trash" onClick={() => setDeleting(e)} aria-label={`Supprimer ${hostOf(e.url)}`}>Supprimer</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section aria-labelledby="wh-log-title" className="wh-log">
        <h2 id="wh-log-title" className="cmp-section-title">Journal des envois</h2>
        <div className="cmp-toolbar">
          <div className="pil-chips" role="group" aria-label="Filtrer par état">
            {STATUS_FILTERS.map((f) => <button key={f.id} type="button" className="pil-chip" aria-pressed={filterStatus === f.id} onClick={() => setFilterStatus(f.id)}>{f.label}</button>)}
          </div>
          {endpoints.length > 1 ? (
            <div className="field cmp-search">
              <label htmlFor="wh-ep" className="sr-only">Point de réception</label>
              <div className="field__control"><select id="wh-ep" value={filterEndpoint} onChange={(e) => setFilterEndpoint(e.target.value)}><option value="">Tous les points de réception</option>{endpoints.map((e) => <option key={e.id} value={e.id}>{hostOf(e.url)}</option>)}</select></div>
            </div>
          ) : null}
        </div>
        {log.loading && deliveries.length === 0 ? (
          <div className="center-block center-block--sm"><Spinner label="Chargement du journal" /></div>
        ) : deliveries.length === 0 ? (
          <Card className="cmp-empty"><p>Aucun envoi pour l’instant.</p></Card>
        ) : (
          <div className="cmp-list">
            {deliveries.map((d, i) => (
              <Card key={d.id} className="wh-row" style={{ ['--i' as string]: Math.min(i, 8) }}>
                <div className="wh-row__top">
                  <Pill tone={DELIVERY_TONE[d.status]}>{DELIVERY_LABEL[d.status]}</Pill>
                  <strong className="wh-row__event">{d.event}</strong>
                  <span className="cmp-case__when">{when(d.createdAt)}</span>
                </div>
                <p className="wh-row__meta">
                  {hostOf(byId.get(d.endpointId)?.url ?? '')}
                  {' · '}{d.attempts} tentative{d.attempts > 1 ? 's' : ''}
                  {d.statusCode ? ` · HTTP ${d.statusCode}` : ''}
                  {d.durationMs !== null ? ` · ${d.durationMs} ms` : ''}
                  {d.replayOf ? ' · rejeu' : ''}
                  {d.status === 'RETRYING' && d.nextRetryAt ? ` · nouvelle tentative ${nextAttemptLabel(d.nextRetryAt)}` : ''}
                </p>
                {d.response && d.status !== 'SUCCESS' ? <p className="wh-row__resp">{d.response}</p> : null}
                {d.status === 'FAILED' || d.status === 'SUCCESS' ? <div className="wh-row__actions"><Button variant="ghost" icon="refresh" busy={busyId === d.id} onClick={() => void replay(d.id)}>Rejouer</Button></div> : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="wh-doc">
        <button type="button" className="cmp-case__more" aria-expanded={showCode} onClick={() => setShowCode((v) => !v)}>{showCode ? 'Masquer' : 'Comment vérifier la signature côté serveur ?'}</button>
        {showCode ? (
          <>
            <p className="grw-sub">Chaque appel est un POST JSON signé. Vérifiez la signature sur le corps brut, avant tout traitement. Répondez 2xx rapidement (8 s maximum) ; sinon l’envoi est repris automatiquement avec un délai croissant.</p>
            <pre className="wh-code"><code>{VERIFY_SNIPPET}</code></pre>
            <CopyButton value={VERIFY_SNIPPET} label="Copier l’exemple" />
          </>
        ) : null}
      </Card>

      <ConfirmDialog open={!!draft} title={draft?.id ? 'Modifier le point de réception' : 'Nouveau point de réception'} confirmLabel="Enregistrer" busy={busy} onConfirm={save} onCancel={() => { if (!busy) setDraft(null); }}>
        {draft ? (
          <div className="cmp-form">
            <Field id="wh-url" label="Adresse (https)" inputMode="url" autoComplete="off" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://votre-systeme.com/webhooks/direct-transfair" maxLength={500} />
            <Field id="wh-desc" label="Description" hint="Facultatif : à quoi sert ce point de réception." value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={120} />
            <fieldset className="wh-events">
              <legend>Événements reçus</legend>
              <p className="field__hint">Aucun coché = tous les événements.</p>
              <div className="wh-events__grid">
                {events.map((ev) => (
                  <label key={ev.name} className="wh-event"><input type="checkbox" checked={draft.events.includes(ev.name)} onChange={() => toggleEvent(ev.name)} /><span>{ev.label}<small>{ev.name}</small></span></label>
                ))}
              </div>
            </fieldset>
            <Field id="wh-retries" label="Reprises en cas d’échec" inputMode="numeric" hint="0 à 8 reprises, avec un délai qui double à chaque fois." value={draft.maxRetries} onChange={(e) => setDraft({ ...draft, maxRetries: e.target.value })} />
            {error ? <Notice tone="error">{error}</Notice> : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog open={!!secretShown} title={secretShown?.rotated ? 'Nouveau secret' : 'Point de réception créé'} confirmLabel="J’ai copié le secret" hideCancel onConfirm={() => setSecretShown(null)} onCancel={() => setSecretShown(null)}>
        <p>Voici le secret de signature pour <strong>{secretShown ? hostOf(secretShown.url) : ''}</strong>. <strong>Il ne sera plus jamais affiché</strong> : copiez-le maintenant dans la configuration de votre serveur.{secretShown?.rotated ? ' L’ancien secret ne fonctionne plus.' : ''}</p>
        <TextAreaField id="wh-secret" label="Secret" rows={2} readOnly value={secretShown?.secret ?? ''} onFocus={(e) => e.currentTarget.select()} />
        {secretShown ? <CopyButton value={secretShown.secret} label="Copier le secret" /> : null}
      </ConfirmDialog>

      <ConfirmDialog open={!!deleting} title="Supprimer ce point de réception ?" confirmLabel="Supprimer" tone="danger" busy={busy} onConfirm={remove} onCancel={() => { if (!busy) setDeleting(null); }}>
        <p>Plus aucun message ne sera envoyé à <strong>{deleting ? hostOf(deleting.url) : ''}</strong> et son journal sera effacé. Pour interrompre sans tout perdre, utilisez plutôt « Pause ».</p>
      </ConfirmDialog>
    </div>
  );
}
