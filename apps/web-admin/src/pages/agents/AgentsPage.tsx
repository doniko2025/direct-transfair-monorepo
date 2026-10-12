// src/pages/agents/AgentsPage.tsx
// Les agents de la société : une carte par agent avec son agence, ses fonds et ses actions
// (changer d'agence, nommer responsable, nouveau mot de passe). La suspension et la suppression
// restent sur la fiche du compte.

import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Agent } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { agentMatches } from '../../lib/agencyRules';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import { ACCOUNT_LABEL, ACCOUNT_TONE, accountState, formatDateTime, fullName, initialsOf } from '../../lib/userRules';
import { AssignAgencyDialog, ResetPasswordDialog, SetManagerDialog } from './AgentDialogs';

type Tab = 'all' | 'managers' | 'blocked';
type Op = { kind: 'assign' | 'manager' | 'password'; agent: Agent };

function AgentCard({ agent, onOp }: { agent: Agent; onOp: (op: Op) => void }) {
  const state = accountState(agent);
  const usable = state === 'active';
  const login = formatDateTime(agent.lastLoginAt);

  return (
    <li className="ag-person">
      <div className="ag-person__head">
        <span className="avatar ag-person__avatar" aria-hidden="true">
          {initialsOf(agent)}
        </span>
        <div className="ag-person__text">
          <Link to={`/users/${encodeURIComponent(agent.id)}`}>
            <strong>{fullName(agent)}</strong>
          </Link>
          <span>{agent.email}</span>
        </div>
      </div>

      <div className="ag-person__pills">
        {agent.isManager ? <Pill tone="brand">Responsable</Pill> : null}
        {state !== 'active' ? <Pill tone={ACCOUNT_TONE[state]}>{ACCOUNT_LABEL[state]}</Pill> : null}
      </div>

      <dl className="ag-person__facts">
        <div>
          <dt>Agence</dt>
          <dd>
            {agent.agency ? (
              <Link to={`/agencies/${encodeURIComponent(agent.agency.id)}`} className="link">
                {agent.agency.name}
              </Link>
            ) : (
              <Pill tone="warn">Aucune agence</Pill>
            )}
          </dd>
        </div>
        <div>
          <dt>Portefeuille</dt>
          <dd>
            {agent.wallets.length === 0
              ? '—'
              : agent.wallets.map((w) => <span key={w.currency}>{formatAmount(w.balance, w.currency)}</span>)}
          </dd>
        </div>
        <div>
          <dt>Dernière connexion</dt>
          <dd>{login ?? <span className="muted">Jamais connecté</span>}</dd>
        </div>
      </dl>

      <div className="ag-person__actions">
        <Button variant="secondary" onClick={() => onOp({ kind: 'assign', agent })}>
          Changer d'agence
        </Button>
        {usable && !agent.isManager && agent.agency?.isActive ? (
          <Button variant="secondary" onClick={() => onOp({ kind: 'manager', agent })}>
            Nommer responsable
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => onOp({ kind: 'password', agent })}>
          Nouveau mot de passe
        </Button>
      </div>
    </li>
  );
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const agencyFilter = params.get('agency') ?? '';

  const agents = useResource(() => api.agents.list(), []);
  const agencies = useResource(() => api.agencies.list(), []);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [op, setOp] = useState<Op | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const list = agents.data ?? [];

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((a) => agentMatches(a, q)).filter((a) => !agencyFilter || a.agency?.id === agencyFilter);
  }, [list, query, agencyFilter]);

  const visible = useMemo(() => {
    if (tab === 'managers') return scoped.filter((a) => a.isManager);
    if (tab === 'blocked') return scoped.filter((a) => accountState(a) !== 'active');
    return scoped;
  }, [scoped, tab]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: scoped.length },
    { id: 'managers', label: 'Responsables', count: scoped.filter((a) => a.isManager).length },
    { id: 'blocked', label: 'Suspendus ou désactivés', count: scoped.filter((a) => accountState(a) !== 'active').length },
  ];

  const agencyOptions = (agencies.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const selectedAgency = agencies.data?.find((a) => a.id === agencyFilter);

  function setAgencyFilter(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set('agency', value);
    else next.delete('agency');
    setParams(next, { replace: true });
  }

  function done(text: string) {
    setOp(null);
    setMessage(text);
    agents.reload();
    agencies.reload();
  }

  const filtered = query.trim() !== '' || agencyFilter !== '' || tab !== 'all';

  return (
    <>
      <PageHeader
        title="Agents"
        description="Les agents de votre société, l'agence où ils travaillent et leur responsable."
        actions={
          <Button icon="plus" onClick={() => navigate(`/agents/new${agencyFilter ? `?agency=${encodeURIComponent(agencyFilter)}` : ''}`)}>
            Nouvel agent
          </Button>
        }
      />

      {message ? (
        <div className="stack stack--tight">
          <Notice
            tone="ok"
            title={message}
            action={
              <button type="button" className="link-btn" onClick={() => setMessage(null)}>
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, email, téléphone ou agence"
            aria-label="Rechercher un agent"
          />
        </div>
        {agencyOptions.length > 1 ? (
          <SelectField
            id="agents-agency"
            label="Agence"
            className="toolbar__select"
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
            options={agencyOptions}
            placeholder="Toutes les agences"
          />
        ) : null}
      </div>

      <div className="tabs tabs--row" role="group" aria-label="Filtrer les agents">
        {tabs.map((t) => (
          <button key={t.id} type="button" className="tab" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>

      {agents.loading && !agents.data ? (
        <div className="center-block">
          <Spinner label="Chargement des agents" />
        </div>
      ) : agents.error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les agents"
            action={
              <button type="button" className="link-btn" onClick={agents.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(agents.error).message}
          </Notice>
        </Card>
      ) : list.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="users" size={26} />
          </span>
          <h2>Aucun agent pour l'instant</h2>
          <p>Ajoutez un agent à l'une de vos agences : il pourra déposer, retirer et envoyer de l'argent pour vos clients.</p>
          <Link to="/agents/new" className="btn btn--primary">
            <Icon name="plus" size={18} />
            <span>Ajouter un agent</span>
          </Link>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>
            {selectedAgency && !query && tab === 'all'
              ? `${selectedAgency.name} n'a pas encore d'agent.`
              : 'Aucun agent ne correspond à ces filtres.'}
          </p>
          {filtered ? (
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setTab('all');
                setAgencyFilter('');
              }}
            >
              Effacer les filtres
            </Button>
          ) : null}
        </Card>
      ) : (
        <ul className="ag-people">
          {visible.map((a) => (
            <AgentCard key={a.id} agent={a} onOp={setOp} />
          ))}
        </ul>
      )}

      {op?.kind === 'assign' ? (
        <AssignAgencyDialog agent={op.agent} agencies={agencies.data ?? []} onClose={() => setOp(null)} onDone={done} />
      ) : null}
      {op?.kind === 'manager' ? (
        <SetManagerDialog agent={op.agent} agencies={agencies.data ?? []} onClose={() => setOp(null)} onDone={done} />
      ) : null}
      {op?.kind === 'password' ? <ResetPasswordDialog agent={op.agent} onClose={() => setOp(null)} onDone={done} /> : null}
    </>
  );
}
