// src/pages/treasury/TreasuryPage.tsx
// Trésorerie.
//   - Admin de société : soldes de la société, alimentation / retrait, caisses des agences, déclaration d'un virement.
//   - Super admin : ses propres soldes, conversion entre devises, virements des sociétés à valider.

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TreasuryCurrency, TreasuryOverviewItem, TreasuryWallet } from '@direct-transfair/shared';
import { Icon, type IconName } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { CURRENCY_NAME } from '../../lib/treasuryRules';
import { useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';
import AgencyCards from './AgencyCards';
import AgencyDialog, { type AgencyMode } from './AgencyDialog';
import ConvertDialog from './ConvertDialog';
import DeclareDialog from './DeclareDialog';
import MovementDialog, { type MovementMode } from './MovementDialog';
import PendingPayments from './PendingPayments';

type Dialog =
  | { kind: 'movement'; mode: MovementMode; currency?: TreasuryCurrency }
  | { kind: 'agency'; mode: AgencyMode; agencyId?: string }
  | { kind: 'declare' }
  | { kind: 'convert' };

function BalanceCard({ wallet, today }: { wallet: TreasuryWallet; today?: TreasuryOverviewItem }) {
  const cur = wallet.currency;
  const active = today && today.transactionCountToday > 0;
  return (
    <li className="balance-card">
      <div className="balance-card__head">
        <span className="balance-card__cur">{cur}</span>
        <span className="muted">{CURRENCY_NAME[cur]?.replace(/ \(.+\)$/, '') ?? cur}</span>
      </div>
      <strong className="balance-card__amount">{formatAmount(wallet.balance, cur)}</strong>
      <p className="balance-card__sub">
        {wallet.reservedBalance > 0
          ? `Disponible : ${formatAmount(wallet.availableBalance, cur)} · ${formatAmount(wallet.reservedBalance, cur)} réservés`
          : 'Tout le solde est disponible'}
      </p>
      <p className="balance-card__today">
        {active
          ? `Aujourd’hui : ${today.transactionCountToday} opération${today.transactionCountToday > 1 ? 's' : ''} · ${formatAmount(today.totalSentToday, cur)} envoyés · ${formatAmount(today.totalFeesToday, cur)} de frais`
          : 'Aucune opération aujourd’hui'}
      </p>
      <Link className="link balance-card__link" to={`/treasury/wallets/${encodeURIComponent(wallet.id)}`}>
        Voir les mouvements
      </Link>
    </li>
  );
}

function OpTile({
  icon,
  title,
  text,
  onClick,
  disabledReason,
}: {
  icon: IconName;
  title: string;
  text: string;
  onClick: () => void;
  disabledReason?: string | null;
}) {
  return (
    <li>
      <button type="button" className="op-tile" onClick={onClick} disabled={Boolean(disabledReason)}>
        <span className="op-tile__icon" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        <span className="op-tile__text">
          <strong>{title}</strong>
          <span>{disabledReason ?? text}</span>
        </span>
      </button>
    </li>
  );
}

export default function TreasuryPage() {
  const me = useCurrentUser();
  const isSuper = me.role === 'SUPER_ADMIN';

  const wallets = useResource(() => api.treasury.wallets(), []);
  // L'activité du jour est un plus : son absence ne doit jamais empêcher d'afficher les soldes.
  const overview = useResource(() => api.treasury.overview().catch(() => [] as TreasuryOverviewItem[]), []);
  const agencies = useResource(() => (isSuper ? Promise.resolve(null) : api.treasury.agencies()), [isSuper]);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const reloadAll = useCallback(() => {
    wallets.reload();
    overview.reload();
    agencies.reload();
  }, [wallets, overview, agencies]);

  const done = useCallback(
    (message: string) => {
      setDialog(null);
      setFlash(message);
      reloadAll();
    },
    [reloadAll],
  );

  const list = wallets.data ?? [];
  const todayOf = (cur: string) => overview.data?.find((o) => o.currency === cur);
  const agencyList = agencies.data;
  const hasAgencies = (agencyList ?? []).some((a) => a.isActive);

  return (
    <>
      <PageHeader
        title="Trésorerie"
        description={
          isSuper
            ? 'Vos soldes par devise et les virements que les sociétés vous déclarent.'
            : 'Les soldes de votre société, les caisses de vos agences et vos virements à la plateforme.'
        }
        actions={
          <Button variant="secondary" onClick={reloadAll} busy={wallets.loading && wallets.data !== null}>
            Actualiser
          </Button>
        }
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

      <div className="tr-stack">
        <section aria-labelledby="balances-title" className="tr-section">
          <div className="tr-section__head">
            <h2 id="balances-title">{isSuper ? 'Mes soldes' : 'Soldes de la société'}</h2>
            <p>Un portefeuille par devise.</p>
          </div>
          {wallets.loading && !wallets.data ? (
            <div className="center-block">
              <Spinner label="Chargement des soldes" />
            </div>
          ) : wallets.error && !wallets.data ? (
            <Card>
              <Notice
                tone="error"
                title="Impossible de charger les soldes"
                action={
                  <button type="button" className="link-btn" onClick={wallets.reload}>
                    Réessayer
                  </button>
                }
              >
                {describeError(wallets.error).message}
              </Notice>
            </Card>
          ) : list.length === 0 ? (
            <Card className="empty empty--compact">
              <span className="empty__icon">
                <Icon name="wallet" size={26} />
              </span>
              <h3>Aucun portefeuille ouvert</h3>
              <p>{isSuper ? 'Les portefeuilles s’ouvrent à la première opération.' : 'Alimentez une première devise pour ouvrir un portefeuille.'}</p>
            </Card>
          ) : (
            <ul className="balance-grid">
              {list.map((w) => (
                <BalanceCard key={w.id} wallet={w} today={todayOf(w.currency)} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ops-title" className="tr-section">
          <div className="tr-section__head">
            <h2 id="ops-title">Opérations</h2>
            <p>Chaque opération demande une confirmation et laisse une trace dans l’historique.</p>
          </div>
          <ul className="op-grid">
            {isSuper ? (
              <OpTile
                icon="swap"
                title="Convertir entre mes portefeuilles"
                text="Change des fonds d’une devise à l’autre au taux du jour."
                onClick={() => setDialog({ kind: 'convert' })}
                disabledReason={list.length < 2 ? 'Il faut au moins deux portefeuilles.' : null}
              />
            ) : (
              <>
                <OpTile
                  icon="deposit"
                  title="Alimenter"
                  text="Ajoute des fonds au portefeuille de la société."
                  onClick={() => setDialog({ kind: 'movement', mode: 'inject' })}
                />
                <OpTile
                  icon="withdraw"
                  title="Retirer"
                  text="Retire des fonds du portefeuille de la société."
                  onClick={() => setDialog({ kind: 'movement', mode: 'withdraw' })}
                  disabledReason={list.every((w) => w.availableBalance <= 0) ? 'Aucun solde disponible.' : null}
                />
                <OpTile
                  icon="send"
                  title="Recharger une agence"
                  text="Envoie des fonds du portefeuille vers la caisse d’une agence."
                  onClick={() => setDialog({ kind: 'agency', mode: 'refill' })}
                  disabledReason={!hasAgencies ? 'Aucune agence active.' : null}
                />
                <OpTile
                  icon="vault"
                  title="Récupérer des fonds"
                  text="Ramène des fonds d’une caisse d’agence vers la société."
                  onClick={() => setDialog({ kind: 'agency', mode: 'collect' })}
                  disabledReason={!hasAgencies ? 'Aucune agence active.' : null}
                />
                <OpTile
                  icon="building"
                  title="Déclarer un virement"
                  text="Prévient la plateforme d’un virement bancaire que vous lui avez fait."
                  onClick={() => setDialog({ kind: 'declare' })}
                  disabledReason={list.every((w) => w.availableBalance <= 0) ? 'Aucun solde disponible.' : null}
                />
              </>
            )}
          </ul>
        </section>

        {isSuper ? (
          <PendingPayments onDecided={done} />
        ) : (
          <AgencyCards
            agencies={agencyList}
            error={agencies.error}
            loading={agencies.loading}
            onRetry={agencies.reload}
            onRefill={(agencyId) => setDialog({ kind: 'agency', mode: 'refill', agencyId })}
            onCollect={(agencyId) => setDialog({ kind: 'agency', mode: 'collect', agencyId })}
          />
        )}
      </div>

      {dialog?.kind === 'movement' ? (
        <MovementDialog mode={dialog.mode} wallets={list} currency={dialog.currency} onClose={() => setDialog(null)} onDone={done} />
      ) : null}
      {dialog?.kind === 'agency' ? (
        <AgencyDialog
          mode={dialog.mode}
          agencies={agencyList ?? []}
          wallets={list}
          agencyId={dialog.agencyId}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
      {dialog?.kind === 'declare' ? <DeclareDialog wallets={list} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog?.kind === 'convert' ? <ConvertDialog wallets={list} onClose={() => setDialog(null)} onDone={done} /> : null}
    </>
  );
}
