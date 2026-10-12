// src/pages/users/UsersPage.tsx
// Annuaire des comptes : une carte par utilisateur, filtres par profil et statut,
// recherche, et (super admin) filtre par société.
// Le serveur renvoie toute la liste d'un coup (pas de pagination) : le web filtre en mémoire
// et n'affiche les cartes que par tranches.

import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { UserSummary } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import {
  ACCOUNT_LABEL,
  ACCOUNT_TONE,
  accountState,
  fullName,
  initialsOf,
  roleName,
  roleTone,
} from '../../lib/userRules';
import { useCurrentUser } from '../../providers/AuthProvider';

type Profile = 'all' | 'admins' | 'agents' | 'clients';

const PAGE_SIZE = 48;

const PROFILE_ROLES: Record<Exclude<Profile, 'all'>, readonly string[]> = {
  admins: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
  agents: ['AGENT'],
  clients: ['USER'],
};

function matches(u: UserSummary, q: string): boolean {
  if (!q) return true;
  const hay = [u.firstName, u.lastName, u.email, u.phone, u.client?.name, u.client?.code, u.agency?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function UserCard({ user, showCompany }: { user: UserSummary; showCompany: boolean }) {
  const state = accountState(user);
  const where = [showCompany ? user.client?.name : null, user.agency?.name].filter(Boolean).join(' · ');
  const since = formatDate(user.createdAt);

  return (
    <li>
      <Link to={`/users/${encodeURIComponent(user.id)}`} className="user-card">
        <span className="avatar user-card__avatar" aria-hidden="true">
          {initialsOf(user)}
        </span>
        <div className="user-card__text">
          <strong>{fullName(user)}</strong>
          <span className="user-card__email">{user.email}</span>
          {where ? <span className="user-card__where">{where}</span> : null}
        </div>
        <div className="user-card__pills">
          <Pill tone={roleTone(user.role)}>{roleName(user.role)}</Pill>
          <Pill tone={ACCOUNT_TONE[state]}>{ACCOUNT_LABEL[state]}</Pill>
        </div>
        {since ? <span className="user-card__since">Inscrit le {since}</span> : null}
      </Link>
    </li>
  );
}

export default function UsersPage() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const flash = (useLocation().state ?? null) as { deleted?: string } | null;
  const [flashVisible, setFlashVisible] = useState(Boolean(flash?.deleted));
  const isSuper = me.role === 'SUPER_ADMIN';

  const { data, error, loading, reload } = useResource(() => api.users.list(), []);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<Profile>('all');
  const [onlySuspended, setOnlySuspended] = useState(false);
  const [company, setCompany] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const users = data ?? [];

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of users) if (u.client?.code) seen.set(u.client.code, u.client.name);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr')).map(([value, label]) => ({ value, label }));
  }, [users]);

  // Comptage par profil sur les résultats de la recherche et de la société (pas du profil lui-même).
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => matches(u, q))
      .filter((u) => !company || u.client?.code === company)
      .filter((u) => !onlySuspended || accountState(u) !== 'active');
  }, [users, query, company, onlySuspended]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      admins: scoped.filter((u) => PROFILE_ROLES.admins.includes(u.role)).length,
      agents: scoped.filter((u) => u.role === 'AGENT').length,
      clients: scoped.filter((u) => u.role === 'USER').length,
    }),
    [scoped],
  );

  const visible = useMemo(
    () => (profile === 'all' ? scoped : scoped.filter((u) => PROFILE_ROLES[profile].includes(u.role))),
    [scoped, profile],
  );

  const tabs: { id: Profile; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: counts.all },
    { id: 'admins', label: 'Administrateurs', count: counts.admins },
    { id: 'agents', label: 'Agents', count: counts.agents },
    { id: 'clients', label: 'Clients', count: counts.clients },
  ];

  const filtered = query.trim() !== '' || company !== '' || onlySuspended || profile !== 'all';

  function clearFilters() {
    setQuery('');
    setCompany('');
    setOnlySuspended(false);
    setProfile('all');
    setLimit(PAGE_SIZE);
  }

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description={
          isSuper
            ? 'Tous les comptes de la plateforme : administrateurs, agents et clients wallet.'
            : 'Les comptes de votre société : administrateurs, agents et clients wallet.'
        }
        actions={
          isSuper ? (
            <Button icon="plus" onClick={() => navigate('/users/new')}>
              Nouvel administrateur
            </Button>
          ) : undefined
        }
      />

      {flashVisible && flash?.deleted ? (
        <div className="stack stack--tight">
          <Notice
            tone="ok"
            title={`Le compte de ${flash.deleted} a été supprimé.`}
            action={
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setFlashVisible(false);
                  navigate('.', { replace: true, state: null });
                }}
              >
                Fermer
              </button>
            }
          />
        </div>
      ) : null}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Nom, email, téléphone ou société"
            aria-label="Rechercher un utilisateur"
          />
        </div>
        {isSuper && companies.length > 1 ? (
          <SelectField
            id="users-company"
            label="Société"
            className="toolbar__select"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            options={companies}
            placeholder="Toutes les sociétés"
          />
        ) : null}
        <button
          type="button"
          className="tab tab--toggle"
          aria-pressed={onlySuspended}
          onClick={() => {
            setOnlySuspended((v) => !v);
            setLimit(PAGE_SIZE);
          }}
        >
          Suspendus ou désactivés
        </button>
      </div>

      <div className="tabs tabs--row" role="group" aria-label="Filtrer par profil">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-pressed={profile === t.id}
            onClick={() => {
              setProfile(t.id);
              setLimit(PAGE_SIZE);
            }}
          >
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des utilisateurs" />
        </div>
      ) : error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les utilisateurs"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : users.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="users" size={26} />
          </span>
          <h2>Aucun utilisateur pour l'instant</h2>
          <p>Les comptes apparaissent ici dès qu'ils sont créés ou qu'un client s'inscrit.</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>Aucun compte ne correspond à ces filtres.</p>
          {filtered ? (
            <Button variant="secondary" onClick={clearFilters}>
              Effacer les filtres
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          <ul className="user-grid">
            {visible.slice(0, limit).map((u) => (
              <UserCard key={u.id} user={u} showCompany={isSuper} />
            ))}
          </ul>
          {visible.length > limit ? (
            <div className="more">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Afficher {Math.min(PAGE_SIZE, visible.length - limit)} de plus ({visible.length - limit} restants)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
