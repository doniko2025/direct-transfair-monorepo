// apps/web-admin/src/components/ContractTermsFields.tsx
// Conditions commerciales d'un contrat : montant, devise, périodicité et engagement (location) ou maintenance annuelle (achat),
// délai de paiement et date d'effet. Utilisé à la création d'une société et pour émettre un contrat sur une société existante.

import type { ContractKind, CurrencyCode } from '@direct-transfair/shared';
import { SelectField } from './form';
import { Field } from './ui';
import type { ContractTermsForm } from '../lib/contractRules';

const CURRENCIES: readonly { value: CurrencyCode; label: string }[] = [
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'GBP', label: 'Livre sterling (GBP)' },
  { value: 'XOF', label: 'Franc CFA (XOF)' },
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
];

const PERIODS = [
  { value: 'MONTHLY', label: 'Chaque mois' },
  { value: 'QUARTERLY', label: 'Chaque trimestre' },
  { value: 'YEARLY', label: 'Chaque année' },
];

interface Props {
  idPrefix: string;
  kind: ContractKind;
  value: ContractTermsForm;
  errors: Record<string, string | undefined>;
  onChange: (patch: Partial<ContractTermsForm>) => void;
}

export function ContractTermsFields({ idPrefix, kind, value, errors, onChange }: Props) {
  const rental = kind === 'RENTAL';
  return (
    <div className="form-grid">
      <Field
        id={`${idPrefix}-amount`}
        label={rental ? 'Redevance (hors taxes)' : "Prix d'achat (hors taxes)"}
        inputMode="decimal"
        value={value.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        error={errors.amount}
        placeholder={rental ? 'ex. 149' : 'ex. 4900'}
        autoComplete="off"
      />
      <SelectField
        id={`${idPrefix}-currency`}
        label="Devise"
        value={value.currency}
        onChange={(e) => onChange({ currency: e.target.value as CurrencyCode })}
        options={CURRENCIES}
      />

      {rental ? (
        <>
          <SelectField
            id={`${idPrefix}-period`}
            label="Facturation"
            value={value.billingPeriod}
            onChange={(e) => onChange({ billingPeriod: e.target.value as ContractTermsForm['billingPeriod'] })}
            options={PERIODS}
          />
          <Field
            id={`${idPrefix}-commitment`}
            label="Engagement initial (mois)"
            inputMode="numeric"
            value={value.commitmentMonths}
            onChange={(e) => onChange({ commitmentMonths: e.target.value.replace(/[^\d]/g, '') })}
            error={errors.commitmentMonths}
            hint="Renouvelé tacitement ensuite, préavis d'un mois."
            autoComplete="off"
          />
        </>
      ) : (
        <div className="form-grid__wide">
          <Field
            id={`${idPrefix}-maintenance`}
            label="Maintenance et hébergement par an (facultatif)"
            inputMode="decimal"
            value={value.maintenanceFeeYearly}
            onChange={(e) => onChange({ maintenanceFeeYearly: e.target.value })}
            error={errors.maintenanceFeeYearly}
            hint="Laissez vide si non inclus : le contrat indiquera « sur devis »."
            autoComplete="off"
          />
        </div>
      )}

      <Field
        id={`${idPrefix}-days`}
        label="Délai de paiement (jours)"
        inputMode="numeric"
        value={value.paymentDays}
        onChange={(e) => onChange({ paymentDays: e.target.value.replace(/[^\d]/g, '') })}
        error={errors.paymentDays}
        autoComplete="off"
      />
      <Field
        id={`${idPrefix}-date`}
        type="date"
        label="Date d'effet"
        value={value.effectiveDate}
        onChange={(e) => onChange({ effectiveDate: e.target.value })}
        error={errors.effectiveDate}
      />
    </div>
  );
}
