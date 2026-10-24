// apps/web-admin/src/pages/contracts/ContractCard.tsx
// Carte d'un contrat (liste des contrats et fiche société) : société, référence, type, statut, conditions, dates.

import { Link } from 'react-router-dom';
import { CONTRACT_KIND_LABEL, type ContractSummary } from '@direct-transfair/shared';
import { CompanyMark } from '../../components/CompanyMark';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { CONTRACT_TONE, contractStatusLabel, formatDay, termsHeadline } from '../../lib/contractRules';
import { safeColor } from '../../lib/companyRules';

export function ContractCard({ contract, showCompany = true }: { contract: ContractSummary; showCompany?: boolean }) {
  const c = contract;
  const when =
    c.status === 'SIGNED'
      ? `Signé le ${formatDay(c.signedAt)}${c.signerName ? ` par ${c.signerName}` : ''}`
      : c.status === 'CANCELLED'
        ? `Annulé le ${formatDay(c.cancelledAt)}`
        : c.status === 'EXPIRED'
          ? `Lien expiré le ${formatDay(c.tokenExpiresAt)}`
          : c.sentAt
            ? `Envoyé le ${formatDay(c.sentAt)} à ${c.recipientEmail}`
            : `Créé le ${formatDay(c.createdAt)}`;

  return (
    <li>
      <Link to={`/contracts/${c.id}`} className="contract-card">
        <span
          className="contract-card__bar"
          style={{ background: safeColor(c.client.primaryColor, '#059669') }}
          aria-hidden="true"
        />
        <div className="contract-card__top">
          {showCompany ? (
            <CompanyMark name={c.client.name} logoUrl={c.client.logoUrl} color={c.client.primaryColor} size={44} />
          ) : (
            <span className="contract-card__doc" aria-hidden="true">
              <Icon name="file" size={22} />
            </span>
          )}
          <div className="contract-card__id">
            <h2>{showCompany ? c.client.name : `Contrat ${CONTRACT_KIND_LABEL[c.type].toLowerCase()}`}</h2>
            <span className="contract-card__ref">{c.reference}</span>
          </div>
          <Icon name="chevronRight" size={18} className="contract-card__chevron" />
        </div>

        <div className="contract-card__pills">
          <Pill tone={CONTRACT_TONE[c.status]} icon={c.status === 'SIGNED' ? 'check' : undefined}>
            {contractStatusLabel(c.status)}
          </Pill>
          <Pill tone="brand">{CONTRACT_KIND_LABEL[c.type]}</Pill>
        </div>

        <p className="contract-card__amount">{termsHeadline(c.type, c.terms)}</p>
        <p className="contract-card__when">{when}</p>
      </Link>
    </li>
  );
}
