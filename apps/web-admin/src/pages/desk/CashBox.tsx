// src/pages/desk/CashBox.tsx
// Bandeau de la caisse de l'agence, en tête de chaque écran du guichet : l'agent voit ce qu'il peut
// payer ou déposer avant de saisir, et ce qu'il restera après (prévision facultative).

import type { AgentDesk } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Notice, Pill, Spinner } from '../../components/ui';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { mainWallet } from '../../lib/deskRules';
import type { Resource } from '../../lib/useResource';
import { countryName } from '../../lib/countries';

export interface CashForecast {
  /** Variation de la caisse si l'opération saisie est validée : négative = sortie d'espèces de la caisse. */
  delta: number;
  currency: string;
}

export function CashBox({ desk, forecast }: { desk: Resource<AgentDesk>; forecast?: CashForecast | null }) {
  if (desk.loading && !desk.data) {
    return (
      <div className="cashbox cashbox--loading" aria-busy="true">
        <Spinner label="Chargement de la caisse" />
      </div>
    );
  }
  if (desk.error || !desk.data) {
    return (
      <Notice
        tone="error"
        title="Caisse indisponible"
        action={
          <button type="button" className="btn btn--secondary" onClick={desk.reload}>
            <span>Réessayer</span>
          </button>
        }
      >
        {desk.error ? describeError(desk.error).message : 'Réponse vide du serveur.'}
      </Notice>
    );
  }

  const { agency } = desk.data;
  const wallet = mainWallet(desk.data);
  if (!agency || !wallet) {
    return (
      <Notice tone="error" title="Aucune caisse">
        {agency
          ? "Votre agence n'a pas encore de caisse. Demandez à votre administrateur de l'activer."
          : "Votre compte n'est rattaché à aucune agence. Demandez à votre administrateur de vous en attribuer une."}
      </Notice>
    );
  }

  const after = forecast && forecast.currency === wallet.currency ? wallet.availableBalance + forecast.delta : null;
  const place = [agency.city, countryName(agency.country)].filter(Boolean).join(', ');

  return (
    <section className="cashbox" aria-label="Caisse de l'agence">
      <span className="cashbox__icon" aria-hidden="true">
        <Icon name="vault" size={22} />
      </span>
      <div className="cashbox__main">
        <span className="cashbox__agency">
          {agency.name}
          {place ? <small>{place}</small> : null}
        </span>
        <strong className="cashbox__amount">{formatAmount(wallet.availableBalance, wallet.currency)}</strong>
        <span className="cashbox__label">disponible en caisse</span>
      </div>
      <div className="cashbox__side">
        {after !== null ? (
          <span className={`cashbox__after${after < 0 ? ' cashbox__after--short' : ''}`}>
            Après l’opération
            <strong>{formatAmount(after, wallet.currency)}</strong>
          </span>
        ) : null}
        {wallet.isFrozen ? (
          <Pill tone="danger" icon="alert">
            Caisse gelée
          </Pill>
        ) : null}
        {!agency.isActive ? (
          <Pill tone="warn" icon="alert">
            Agence fermée
          </Pill>
        ) : null}
        {wallet.reservedBalance > 0 ? <span className="cashbox__reserved">{formatAmount(wallet.reservedBalance, wallet.currency)} réservés</span> : null}
      </div>
    </section>
  );
}
