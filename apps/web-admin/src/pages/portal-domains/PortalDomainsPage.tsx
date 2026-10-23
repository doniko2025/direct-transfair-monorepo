// src/pages/portal-domains/PortalDomainsPage.tsx
// Domaines des portails de sociétés (SUPER_ADMIN) : une carte par société avec l'état d'avancement du domaine
// (nameservers à pointer, enregistrements DNS à ajouter, validation, actif), recherche et filtres.
// Le serveur fait avancer chaque domaine tout seul ; l'écran se rafraîchit pendant qu'un domaine est en attente.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PortalDomainEntry, PortalDomainResult, PortalDomainDnsMode, PortalDomainKind } from '@direct-transfair/shared';
import { CompanyMark } from '../../components/CompanyMark';
import { ConfirmDialog, CopyButton } from '../../components/form';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { safeColor } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import {
  STATUS_LABEL,
  STATUS_TONE,
  ago,
  cleanHost,
  nextStep,
  previewUrl,
  validateDomain,
  validateSubdomain,
} from '../../lib/portalDomainRules';
import { useResource } from '../../lib/useResource';

type Filter = 'all' | 'active' | 'pending' | 'failed' | 'none';

const REFRESH_MS = 30_000;

function filterOf(e: PortalDomainEntry): Exclude<Filter, 'all'> {
  if (!e.domain) return 'none';
  if (e.domain.status === 'ACTIVE') return 'active';
  if (e.domain.status === 'FAILED') return 'failed';
  return 'pending';
}

function matches(e: PortalDomainEntry, q: string): boolean {
  if (!q) return true;
  return [e.client.name, e.client.code, e.domain?.host].filter(Boolean).join(' ').toLowerCase().includes(q);
}

// ─── Carte ───────────────────────────────────────────────
function DomainCard({
  entry,
  busy,
  onEdit,
  onCheck,
  onRemove,
}: {
  entry: PortalDomainEntry;
  busy: boolean;
  onEdit: () => void;
  onCheck: () => void;
  onRemove: () => void;
}) {
  const { client, domain } = entry;
  const color = safeColor(client.primaryColor, '#059669');

  return (
    <li className="pd-card" id={`company-${client.id}`}>
      <span
        className="pd-card__bar"
        style={{ background: `linear-gradient(90deg, ${color} 70%, ${safeColor(client.secondaryColor, '#10B981')})` }}
        aria-hidden="true"
      />
      <div className="pd-card__top">
        <CompanyMark name={client.name} logoUrl={client.logoUrl} color={client.primaryColor} size={44} />
        <div className="pd-card__id">
          <h2>{client.name}</h2>
          <span className="company-card__code">{client.code}</span>
        </div>
        {domain ? <Pill tone={STATUS_TONE[domain.status]}>{STATUS_LABEL[domain.status]}</Pill> : <Pill>Aucun domaine</Pill>}
      </div>

      {domain ? (
        <>
          <div className="pd-card__host">
            <Icon name="globe" size={16} />
            {domain.status === 'ACTIVE' ? (
              <a href={domain.url} target="_blank" rel="noopener noreferrer" title={domain.url}>
                {domain.host}
              </a>
            ) : (
              <span title={domain.host}>{domain.host}</span>
            )}
            <span className="pd-card__kind">{domain.kind === 'SUBDOMAIN' ? 'Sous-domaine' : 'Domaine propre'}</span>
          </div>

          <p className="pd-card__step">{nextStep(domain)}</p>

          {domain.status === 'PENDING_NAMESERVERS' && domain.nameServers.length > 0 ? (
            <ul className="pd-records" aria-label="Nameservers à renseigner chez le registrar">
              {domain.nameServers.map((ns) => (
                <li key={ns}>
                  <div className="pd-records__value">
                    <span className="pd-records__type">NS</span>
                    <code>{ns}</code>
                    <CopyButton value={ns} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {domain.status !== 'ACTIVE' && domain.dnsInstructions.length > 0 ? (
            <ul className="pd-records" aria-label="Enregistrements DNS à ajouter">
              {domain.dnsInstructions.map((r) => (
                <li key={`${r.type}-${r.name}`}>
                  <div className="pd-records__head">
                    <span className="pd-records__type">{r.type}</span>
                    <span className="pd-records__name">{r.name}</span>
                  </div>
                  <div className="pd-records__value">
                    <code>{r.value}</code>
                    <CopyButton value={r.value} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {domain.lastError ? (
            <p className={`pd-card__msg pd-card__msg--${domain.status === 'FAILED' ? 'error' : 'info'}`} role="status">
              {domain.lastError}
            </p>
          ) : null}

          <p className="pd-card__meta">
            Vérifié {ago(domain.lastCheckedAt)}
            {domain.status === 'FAILED' && domain.attempts > 0 ? ` · ${domain.attempts} échec${domain.attempts > 1 ? 's' : ''}` : ''}
          </p>
        </>
      ) : (
        <p className="pd-card__step">
          Cette société n’a pas encore d’adresse dédiée pour son portail : ses administrateurs et agents n’ont pas de lien à ouvrir.
        </p>
      )}

      <div className="pd-card__actions">
        {domain ? (
          <>
            <Button variant="secondary" icon="search" busy={busy} onClick={onCheck}>
              Vérifier
            </Button>
            <Button variant="ghost" icon="edit" disabled={busy} onClick={onEdit}>
              Modifier
            </Button>
            <Button variant="ghost" icon="trash" disabled={busy} onClick={onRemove} className="pd-danger">
              Retirer
            </Button>
          </>
        ) : (
          <Button icon="globe" disabled={busy} onClick={onEdit}>
            Définir le domaine
          </Button>
        )}
      </div>
    </li>
  );
}

// ─── Page ────────────────────────────────────────────────
export default function PortalDomainsPage() {
  const [params, setParams] = useSearchParams();
  const list = useResource(() => api.portalDomains.list(), []);
  const config = useResource(() => api.portalDomains.config(), []);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'error'; title: string; text?: string } | null>(null);

  // Éditeur
  const [editing, setEditing] = useState<PortalDomainEntry | null>(null);
  const [kind, setKind] = useState<PortalDomainKind>('CUSTOM');
  const [subdomain, setSubdomain] = useState('');
  const [domain, setDomain] = useState('');
  const [dnsMode, setDnsMode] = useState<PortalDomainDnsMode>('CLOUDFLARE');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Suppression
  const [removing, setRemoving] = useState<PortalDomainEntry | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const entries = list.data ?? [];
  const cfg = config.data;
  const baseDomain = cfg?.baseDomain ?? null;
  const subdomainsOk = Boolean(cfg?.subdomains);

  // Rafraîchissement automatique tant qu'un domaine n'est pas actif.
  const hasPending = entries.some((e) => e.domain && e.domain.status !== 'ACTIVE');
  const reloadList = list.reload;
  useEffect(() => {
    if (!hasPending) return;
    const id = window.setInterval(reloadList, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [hasPending, reloadList]);

  // Lien direct depuis la fiche d'une société : ?company=<id> ouvre l'éditeur.
  const wantedId = Number(params.get('company'));
  useEffect(() => {
    if (!wantedId || !list.data || editing) return;
    const target = list.data.find((e) => e.client.id === wantedId);
    if (target) openEditor(target);
    const next = new URLSearchParams(params);
    next.delete('company');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedId, list.data]);

  const counts = useMemo(() => {
    const c = { all: entries.length, active: 0, pending: 0, failed: 0, none: 0 };
    for (const e of entries) c[filterOf(e)] += 1;
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => matches(e, q)).filter((e) => filter === 'all' || filterOf(e) === filter);
  }, [entries, query, filter]);

  function openEditor(entry: PortalDomainEntry) {
    const d = entry.domain;
    setEditing(entry);
    setFormError(null);
    setKind(d ? d.kind : subdomainsOk ? 'SUBDOMAIN' : 'CUSTOM');
    setSubdomain(d?.kind === 'SUBDOMAIN' && baseDomain ? d.host.slice(0, d.host.length - baseDomain.length - 1) : '');
    setDomain(d?.kind === 'CUSTOM' ? d.host : '');
    setDnsMode(d?.dnsMode ?? 'CLOUDFLARE');
  }

  const fieldError = kind === 'SUBDOMAIN' ? validateSubdomain(subdomain) : validateDomain(domain);
  const preview = previewUrl(kind, subdomain, domain, baseDomain);

  function announce(res: PortalDomainResult, title: string) {
    if (res.warnings.length > 0) setFlash({ tone: 'error', title, text: res.warnings.join(' ') });
    else setFlash({ tone: 'ok', title });
  }

  async function save() {
    if (!editing || fieldError) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.portalDomains.set(
        editing.client.id,
        kind === 'SUBDOMAIN'
          ? { kind, subdomain }
          : { kind, domain: cleanHost(domain), dnsMode },
      );
      announce(res, `Domaine de « ${editing.client.name} » enregistré.`);
      setEditing(null);
      list.reload();
    } catch (err) {
      setFormError(describeError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function check(entry: PortalDomainEntry) {
    setBusyId(entry.client.id);
    setFlash(null);
    try {
      const res = await api.portalDomains.check(entry.client.id);
      announce(res, `Domaine de « ${entry.client.name} » vérifié.`);
      list.reload();
    } catch (err) {
      setFlash({ tone: 'error', title: 'Vérification impossible', text: describeError(err).message });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const res = await api.portalDomains.remove(removing.client.id);
      announce(res, `Domaine de « ${removing.client.name} » retiré.`);
      setRemoving(null);
      list.reload();
    } catch (err) {
      setFlash({ tone: 'error', title: 'Retrait impossible', text: describeError(err).message });
      setRemoving(null);
    } finally {
      setRemoveBusy(false);
    }
  }

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Toutes', count: counts.all },
    { id: 'active', label: 'Actives', count: counts.active },
    { id: 'pending', label: 'En attente', count: counts.pending },
    { id: 'failed', label: 'En erreur', count: counts.failed },
    { id: 'none', label: 'Sans domaine', count: counts.none },
  ];

  return (
    <>
      <PageHeader
        title="Domaines des portails"
        description="L’adresse web de chaque société de transfert. La plateforme configure le DNS et l’hébergeur, puis suit l’avancement jusqu’à la mise en ligne."
      />

      <div className="stack stack--tight">
        {cfg && !cfg.vercel ? (
          <Notice tone="error" title="Hébergeur non configuré">
            Les domaines ne peuvent pas être attribués tant que VERCEL_API_TOKEN et PORTAL_VERCEL_PROJECT_ID ne sont pas définis sur le serveur.
          </Notice>
        ) : cfg && !cfg.cloudflare ? (
          <Notice tone="info" title="DNS automatique indisponible">
            Cloudflare n’est pas configuré : seuls les domaines dont la société gère elle-même le DNS peuvent être attribués.
          </Notice>
        ) : null}

        {flash ? (
          <Notice
            tone={flash.tone}
            title={flash.title}
            action={
              <button type="button" className="link-btn" onClick={() => setFlash(null)}>
                Fermer
              </button>
            }
          >
            {flash.text}
          </Notice>
        ) : null}
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par société, code ou domaine"
            aria-label="Rechercher une société ou un domaine"
          />
        </div>
        <div className="toolbar__filters">
          <FilterTabs
            id="domains-state"
            label="Filtrer par état"
            value={filter}
            onChange={setFilter}
            options={tabs}
          />
        </div>
      </div>

      {list.loading && !list.data ? (
        <div className="center-block">
          <Spinner label="Chargement des domaines" />
        </div>
      ) : list.error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les domaines"
            action={
              <button type="button" className="link-btn" onClick={list.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h2>Aucune société pour l’instant</h2>
          <p>Créez d’abord une société de transfert, puis attribuez-lui son adresse ici.</p>
          <Link className="btn btn--primary" to="/companies/new">
            <span>Créer une société</span>
          </Link>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>Aucune société ne correspond à cette recherche.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Effacer les filtres
          </Button>
        </Card>
      ) : (
        <ul className="pd-grid">
          {visible.map((e) => (
            <DomainCard
              key={e.client.id}
              entry={e}
              busy={busyId === e.client.id}
              onEdit={() => openEditor(e)}
              onCheck={() => void check(e)}
              onRemove={() => setRemoving(e)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={editing !== null}
        title={editing ? `Domaine du portail — ${editing.client.name}` : 'Domaine du portail'}
        confirmLabel={editing?.domain ? 'Enregistrer' : 'Attribuer le domaine'}
        busy={saving}
        confirmDisabled={Boolean(fieldError)}
        onConfirm={() => void save()}
        onCancel={() => setEditing(null)}
      >
        <div className="pd-form">
          <div className="pd-choice" role="radiogroup" aria-label="Type d’adresse">
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'SUBDOMAIN'}
              className="pd-choice__opt"
              disabled={!subdomainsOk}
              onClick={() => setKind('SUBDOMAIN')}
            >
              <strong>Sous-domaine de la plateforme</strong>
              <span>{subdomainsOk && baseDomain ? `ex. flash.${baseDomain} — en ligne en quelques minutes` : 'Non configuré sur le serveur'}</span>
            </button>
            <button type="button" role="radio" aria-checked={kind === 'CUSTOM'} className="pd-choice__opt" onClick={() => setKind('CUSTOM')}>
              <strong>Domaine propre à la société</strong>
              <span>ex. flash-transfer.com — nécessite une action de la société chez son registrar</span>
            </button>
          </div>

          {kind === 'SUBDOMAIN' ? (
            <Field
              id="pd-sub"
              label="Sous-domaine"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())}
              error={subdomain ? fieldError : null}
              hint={baseDomain ? `L’adresse sera <sous-domaine>.${baseDomain}` : undefined}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          ) : (
            <>
              <Field
                id="pd-domain"
                label="Domaine"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                error={domain ? fieldError : null}
                hint="Domaine nu (ma-societe.com, www inclus) ou sous-domaine (portail.ma-societe.com)."
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <div className="pd-choice" role="radiogroup" aria-label="Gestion du DNS">
                <button
                  type="button"
                  role="radio"
                  aria-checked={dnsMode === 'CLOUDFLARE'}
                  className="pd-choice__opt"
                  disabled={!cfg?.cloudflare}
                  onClick={() => setDnsMode('CLOUDFLARE')}
                >
                  <strong>DNS géré par la plateforme</strong>
                  <span>{cfg?.cloudflare ? 'Pour un domaine neuf : la société pointe ses nameservers, le reste est automatique. Ses enregistrements existants (email, site) ne sont pas repris.' : 'Cloudflare non configuré'}</span>
                </button>
                <button type="button" role="radio" aria-checked={dnsMode === 'EXTERNAL'} className="pd-choice__opt" onClick={() => setDnsMode('EXTERNAL')}>
                  <strong>DNS géré par la société</strong>
                  <span>Elle ajoute elle-même les enregistrements qui lui seront indiqués.</span>
                </button>
              </div>
            </>
          )}

          {preview ? (
            <p className="pd-preview">
              <Icon name="globe" size={16} />
              Le portail sera servi sur <strong>{preview}</strong>
            </p>
          ) : null}
          {editing?.domain && editing.domain.host !== cleanHost(preview ?? '').replace(/^https?:\/\//, '') ? (
            <Notice tone="info">L’ancien domaine sera détaché de l’hébergeur : il cessera de fonctionner.</Notice>
          ) : null}
          {formError ? <Notice tone="error">{formError}</Notice> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Retirer le domaine de ${removing.client.name} ?` : 'Retirer le domaine ?'}
        confirmLabel="Retirer le domaine"
        tone="danger"
        busy={removeBusy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      >
        <p>
          Le portail de la société ne sera plus joignable à l’adresse <strong>{removing?.domain?.host}</strong>. Ses comptes et ses données ne sont pas touchés.
          {removing?.domain?.kind === 'CUSTOM' ? ' Les enregistrements DNS du domaine de la société restent en place.' : ''}
        </p>
      </ConfirmDialog>
    </>
  );
}
