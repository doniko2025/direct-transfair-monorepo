// src/pages/agency-withdrawals/AgencyWithdrawalsPage.tsx
// Retraits d'agence (admin de société) : récupérer l'argent liquide accumulé dans une caisse d'agence,
// puis retrouver l'historique des mouvements de caisse (retraits, remises des agents, recharges).

import { useCallback, useMemo, useState } from 'react';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { agencyWallet } from '../../lib/treasuryRules';
import { useResource } from '../../lib/useResource';
import { CASH_TABS, cashMovements, type CashTab } from '../../lib/walletClientRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import AgencyDialog from '../treasury/AgencyDialog';
import { TxCard } from '../transactions/TxCard';

const PAGE = 12;

export default function AgencyWithdrawalsPage() {
  const me = useCurrentUser();
  const agencies = useResource(() => api.treasury.agencies(), []);
  const history = useResource(() => api.transactions.listAdmin(), []);
  const [collecting, setCollecting] = useState<string | null | undefined>(undefined);
  const [flash, setFlash] = useState<string | null>(null);
  const [tab, setTab] = useState<CashTab>('all');
  const [limit, setLimit] = useState(PAGE);
  const [agencyFilter, setAgencyFilter] = useState('');

  const reloadAgencies = agencies.reload;
  const reloadHistory = history.reload;
  const done = useCallback(
    (message: string) => {
      setCollecting(undefined);
      setFlash(message);
      reloadAgencies();
      reloadHistory();
    },
    [reloadAgencies, reloadHistory],
  );

  const list = agencies.data ?? [];
  const allMovements = useMemo(() => cashMovements(history.data ?? []), [history.data]);
  const movements = useMemo(
    () => (agencyFilter ? allMovements.filter((m) => m.agencyId === agencyFilter) : allMovements),
    [allMovements, agencyFilter],
  );
  const agencyOptions = [{ value: '', label: 'Toutes les agences' }, ...list.map((a) => ({ value: a.id, label: a.name }))];
  const counts = useMemo(
    () => Object.fromEntries(CASH_TABS.map((t) => [t.id, t.id === 'all' ? movements.length : movements.filter((m) => m.type === t.id).length])) as Record<CashTab, number>,
    [movements],
  );
  const visible = tab === 'all' ? movements : movements.filter((m) => m.type === tab);

  return (
    <>
      <PageHeader
        title="Retraits d'agence"
        description="Récupérez l'argent liquide d'une caisse d'agence vers le portefeuille de la société, et suivez tous les mouvements de caisse."
      />

      {flash ? (
        <div className="stack stack--tight">
          <Notice
            tone="ok"
            title={flash}
            action={
              <button type="button" className="link-btn" onClick={() => setFlash(null)}>
                Fermer
              </button>
            }
          />
        </div>
      ) : null}

      <section aria-labelledby="wd-agencies" className="tr-section wd-section">
        <div className="tr-section__head">
          <h2 id="wd-agencies">Caisses des agences</h2>
          <p>Choisissez l'agence dont vous voulez récupérer des fonds. Le montant est retiré de sa caisse et ajouté à celui de la société.</p>
        </div>

        {agencies.loading && !agencies.data ? (
          <div className="center-block">
            <Spinner label="Chargement des agences" />
          </div>
        ) : agencies.error && !agencies.data ? (
          <Card>
            <Notice
              tone="error"
              title="Impossible de charger les agences"
              action={
                <button type="button" className="link-btn" onClick={agencies.reload}>
                  Réessayer
                </button>
              }
            >
              {describeError(agencies.error).message}
            </Notice>
          </Card>
        ) : list.length === 0 ? (
          <Card className="empty empty--compact">
            <span className="empty__icon">
              <Icon name="building" size={26} />
            </span>
            <h3>Aucune agence pour l'instant</h3>
            <p>Créez une agence pour voir sa caisse ici.</p>
          </Card>
        ) : (
          <ul className="agency-grid">
            {list.map((a) => {
              const main = agencyWallet(a);
              const cash = main?.availableBalance ?? 0;
              const canCollect = a.isActive && cash > 0;
              return (
                <li key={a.id} className="agency-card">
                  <div className="agency-card__head">
                    <div>
                      <strong>{a.name}</strong>
                      <span className="muted">{a.city}</span>
                    </div>
                    <Pill tone={a.isActive ? 'ok' : 'neutral'}>{a.isActive ? 'Active' : 'Désactivée'}</Pill>
                  </div>
                  <div className={cash > 0 ? 'wd-cash' : 'wd-cash wd-cash--empty'}>
                    <span>Disponible en caisse</span>
                    <strong>{main ? formatAmount(cash, main.currency) : 'Aucune caisse'}</strong>
                  </div>
                  <div className="agency-card__actions">
                    <Button variant="secondary" disabled={!canCollect} onClick={() => setCollecting(a.id)}>
                      Récupérer des fonds
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="wd-history" className="tr-section wd-section">
        <div className="tr-section__head">
          <h2 id="wd-history">Mouvements de caisse</h2>
          <p>Les retraits que vous avez faits, les remises de vos agents et les recharges de caisse, avec l’agence dont la caisse a bougé.</p>
        </div>

        <div className="toolbar">
          <div className="toolbar__filters">
            <SelectField
              id="wd-agency"
              label="Agence"
              className="toolbar__select"
              value={agencyFilter}
              onChange={(e) => {
                setAgencyFilter(e.target.value);
                setLimit(PAGE);
              }}
              options={agencyOptions}
            />
            <FilterTabs
              id="wd-type"
              label="Filtrer les mouvements"
              rowOnDesktop
              value={tab}
              onChange={(next) => {
                setTab(next);
                setLimit(PAGE);
              }}
              options={CASH_TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
            />
          </div>
        </div>

        {history.loading && !history.data ? (
          <div className="center-block">
            <Spinner label="Chargement des mouvements" />
          </div>
        ) : history.error && !history.data ? (
          <Card>
            <Notice
              tone="error"
              title="Impossible de charger les mouvements"
              action={
                <button type="button" className="link-btn" onClick={history.reload}>
                  Réessayer
                </button>
              }
            >
              {describeError(history.error).message}
            </Notice>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="empty empty--compact">
            <span className="empty__icon">
              <Icon name="vault" size={26} />
            </span>
            <h3>Aucun mouvement de caisse</h3>
            <p>
              {agencyFilter
                ? 'Cette agence n’a pas encore de mouvement de caisse.'
                : 'Les retraits, remises et recharges apparaîtront ici dès le premier mouvement.'}
            </p>
          </Card>
        ) : (
          <>
            <ul className="user-grid">
              {visible.slice(0, limit).map((t) => (
                <TxCard key={t.id} tx={t} viewer={me} showCompany={false} />
              ))}
            </ul>
            {visible.length > limit ? (
              <div className="more">
                <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                  Afficher {Math.min(PAGE, visible.length - limit)} de plus ({visible.length - limit} restants)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {collecting !== undefined ? (
        <AgencyDialog
          mode="collect"
          agencies={list}
          wallets={[]}
          agencyId={collecting ?? undefined}
          onClose={() => setCollecting(undefined)}
          onDone={done}
        />
      ) : null}
    </>
  );
}
