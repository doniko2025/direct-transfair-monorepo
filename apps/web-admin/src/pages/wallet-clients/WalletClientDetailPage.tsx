// apps/web-admin/src/pages/wallet-clients/WalletClientDetailPage.tsx
// Fiche d'un client wallet : portefeuilles, vérification d'identité et dernières opérations
// (envois et réceptions). Le profil, la suspension et la suppression restent sur la fiche du compte.
// v2 (phase 6) : l'admin de société change le niveau KYC du client (qui décide de ses plafonds d'envoi).

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import {
  ACCOUNT_LABEL,
  ACCOUNT_TONE,
  COMPLIANCE_LABEL,
  COMPLIANCE_TONE,
  KYC_LABEL,
  accountState,
  formatDateTime,
  fullName,
  initialsOf,
} from '../../lib/userRules';
import { clientOperations } from '../../lib/walletClientRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { TxCard } from '../transactions/TxCard';
import KycLevelDialog from './KycLevelDialog';

const PAGE = 10;

export default function WalletClientDetailPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const client = useResource(() => api.users.get(id), [id]);
  const ops = useResource(async () => clientOperations(await api.transactions.listAdmin(), id), [id]);
  const [limit, setLimit] = useState(PAGE);
  const [editingKyc, setEditingKyc] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const backLink = (
    <Link to="/wallet-clients" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Tous les clients</span>
    </Link>
  );

  const data = client.data;
  const notFound =
    !id ||
    (!client.loading && !client.error && !data) ||
    (data != null && data.role !== 'USER') ||
    (client.error instanceof ApiError && (client.error.status === 404 || client.error.status === 403));

  const sent = useMemo(() => (ops.data ?? []).filter((t) => String(t.senderId) === id).length, [ops.data, id]);

  if (notFound) {
    return (
      <>
        <PageHeader title="Client introuvable" actions={backLink} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Ce client n'est pas accessible</h2>
          <p>Il n'existe pas, ou ce n'est pas un client de votre société.</p>
        </Card>
      </>
    );
  }

  if (client.loading && !data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement du client" />
      </div>
    );
  }

  if (client.error || !data) {
    return (
      <>
        <PageHeader title="Client wallet" actions={backLink} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger le client"
            action={
              <button type="button" className="link-btn" onClick={client.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(client.error).message}
          </Notice>
        </Card>
      </>
    );
  }

  const user = data;
  const state = accountState(user);
  const wallets = user.wallets ?? [];
  const place = [user.city, countryName(user.country)].filter(Boolean).join(', ');
  const operations = ops.data ?? [];

  return (
    <>
      <PageHeader title={fullName(user)} actions={backLink} />

      <div className="stack">
        <Card className="company-hero">
          <span className="avatar user-hero__avatar" aria-hidden="true">
            {initialsOf(user)}
          </span>
          <div className="company-hero__main">
            <div className="company-hero__line">
              <Pill tone={ACCOUNT_TONE[state]}>{ACCOUNT_LABEL[state]}</Pill>
              {user.kycLevel ? (
                <Pill tone={user.kycLevel === 'LEVEL_0' ? 'warn' : 'neutral'} icon="shield">
                  {KYC_LABEL[user.kycLevel].split(' · ')[0]}
                </Pill>
              ) : null}
              {user.complianceStatus && user.complianceStatus !== 'CLEAR' ? (
                <Pill tone={COMPLIANCE_TONE[user.complianceStatus]}>{COMPLIANCE_LABEL[user.complianceStatus]}</Pill>
              ) : null}
            </div>
            <p className="company-hero__meta">
              {[user.phone, user.email, place || null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="company-hero__actions">
            <Link to={`/users/${encodeURIComponent(user.id)}`} className="btn btn--secondary">
              <Icon name="user" size={18} />
              <span>Ouvrir le compte</span>
            </Link>
          </div>
        </Card>

        {state !== 'active' ? (
          <Notice tone="info" title={state === 'suspended' ? 'Compte suspendu' : 'Compte désactivé'}>
            {[user.suspendedReason, user.suspendedAt ? `depuis le ${formatDateTime(user.suspendedAt)}` : null]
              .filter(Boolean)
              .join(' — ') || 'Ce client ne peut plus se connecter.'}{' '}
            La réactivation se fait depuis la fiche du compte.
          </Notice>
        ) : null}

        <Card as="section" aria-labelledby="wcd-wallets" className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="wallet" size={20} />
            </span>
            <div className="section-card__title">
              <h2 id="wcd-wallets">Portefeuilles</h2>
              <p>Solde par devise.</p>
            </div>
          </header>
          {wallets.length === 0 ? (
            <p className="muted">Ce client n'a pas de portefeuille actif.</p>
          ) : (
            <ul className="wallets">
              {wallets.map((w) => (
                <li key={String(w.id)} className="wallet">
                  <span className="wallet__cur">{w.currency}</span>
                  <strong>{formatAmount(w.balance, w.currency)}</strong>
                  {Number(w.reservedBalance ?? 0) > 0 ? (
                    <span className="muted wallet__sub">dont {formatAmount(w.reservedBalance ?? 0, w.currency)} réservés</span>
                  ) : null}
                  <span className="wallet__pills">
                    {w.isDefault ? <Pill tone="brand">Par défaut</Pill> : null}
                    {w.isFrozen ? <Pill tone="warn">Gelé</Pill> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="wcd-kyc" className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="shield" size={20} />
            </span>
            <div className="section-card__title">
              <h2 id="wcd-kyc">Vérification et activité</h2>
              <p>Où en est ce client et depuis quand il utilise l'application.</p>
            </div>
          </header>
          {flash ? (
            <Notice
              tone="ok"
              title={flash}
              action={
                <button type="button" className="link-btn" onClick={() => setFlash(null)}>
                  Fermer
                </button>
              }
            />
          ) : null}
          <dl className="kv kv--grid">
            <div className="kv__row">
              <dt>Vérification d'identité</dt>
              <dd>
                {user.kycLevel ? KYC_LABEL[user.kycLevel] : <span className="muted">Inconnue</span>}
                {me.role === 'COMPANY_ADMIN' ? (
                  <>
                    {' '}
                    <button type="button" className="link-btn" onClick={() => setEditingKyc(true)}>
                      Changer le niveau
                    </button>
                  </>
                ) : null}
              </dd>
            </div>
            <div className="kv__row">
              <dt>Statut de conformité</dt>
              <dd>
                {user.complianceStatus ? (
                  <Pill tone={COMPLIANCE_TONE[user.complianceStatus]}>{COMPLIANCE_LABEL[user.complianceStatus]}</Pill>
                ) : (
                  <span className="muted">Inconnu</span>
                )}
              </dd>
            </div>
            <div className="kv__row">
              <dt>Inscription</dt>
              <dd>{formatDateTime(user.createdAt) ?? <span className="muted">Inconnue</span>}</dd>
            </div>
            <div className="kv__row">
              <dt>Dernière connexion</dt>
              <dd>{formatDateTime(user.lastLoginAt) ?? <span className="muted">Jamais connecté</span>}</dd>
            </div>
          </dl>
        </Card>

        <section aria-labelledby="wcd-ops" className="tr-section">
          <div className="tr-section__head">
            <h2 id="wcd-ops">Opérations</h2>
            <p>
              {ops.data
                ? operations.length === 0
                  ? 'Aucune opération pour ce client.'
                  : `${operations.length} ${operations.length > 1 ? 'opérations' : 'opération'} dont ${sent} ${sent > 1 ? 'envoyées' : 'envoyée'} par ce client.`
                : 'Envois et réceptions de ce client.'}
            </p>
          </div>

          {ops.loading && !ops.data ? (
            <div className="center-block">
              <Spinner label="Chargement des opérations" />
            </div>
          ) : ops.error && !ops.data ? (
            <Card>
              <Notice
                tone="error"
                title="Impossible de charger les opérations"
                action={
                  <button type="button" className="link-btn" onClick={ops.reload}>
                    Réessayer
                  </button>
                }
              >
                {describeError(ops.error).message}
              </Notice>
            </Card>
          ) : operations.length === 0 ? (
            <Card className="empty empty--compact">
              <span className="empty__icon">
                <Icon name="list" size={26} />
              </span>
              <h3>Aucune opération</h3>
              <p>Ses envois et réceptions apparaîtront ici.</p>
            </Card>
          ) : (
            <>
              <ul className="user-grid">
                {operations.slice(0, limit).map((t) => (
                  <TxCard key={t.id} tx={t} viewer={me} showCompany={false} />
                ))}
              </ul>
              {operations.length > limit ? (
                <div className="more">
                  <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                    Afficher {Math.min(PAGE, operations.length - limit)} de plus ({operations.length - limit} restantes)
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {editingKyc ? (
        <KycLevelDialog
          userId={user.id}
          current={user.kycLevel}
          onClose={() => setEditingKyc(false)}
          onDone={(message) => {
            setEditingKyc(false);
            setFlash(message);
            client.reload();
          }}
        />
      ) : null}
    </>
  );
}
