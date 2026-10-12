// src/pages/fees/FeeRuleDialog.tsx
// Ajouter ou modifier une règle du barème (admin de société).

import { useState, type FormEvent } from 'react';
import type { CurrencyCode, FeeRule, FeeRuleInput } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { COUNTRIES } from '../../lib/countries';
import { MAX_FEE_RATE, MAX_FIXED_FEE, parseFeeRate, parseFixedFee } from '../../lib/feeRules';
import { CHARGED_METHODS, CURRENCIES, findOverlap, money, parseBound, ruleFee, ruleTitle, toInput } from '../../lib/feeScheduleRules';
import { useDialogAction } from '../treasury/useDialogAction';

interface Props {
  /** null = nouvelle règle. */
  rule: FeeRule | null;
  rules: readonly FeeRule[];
  onClose: () => void;
  onDone: (message: string) => void;
}

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

export default function FeeRuleDialog({ rule, rules, onClose, onDone }: Props) {
  const [label, setLabel] = useState(rule?.label ?? '');
  const [method, setMethod] = useState(rule?.payoutMethod ?? '');
  const [from, setFrom] = useState(rule?.sendCountry ?? '');
  const [to, setTo] = useState(rule?.receiveCountry ?? '');
  const [currency, setCurrency] = useState<CurrencyCode>(rule?.currency ?? 'EUR');
  const [min, setMin] = useState(rule ? toInput(rule.minAmount) : '0');
  const [max, setMax] = useState(rule ? toInput(rule.maxAmount) : '');
  const [rate, setRate] = useState(rule ? toInput(rule.feeRate) : '');
  const [fixed, setFixed] = useState(rule ? toInput(rule.fixedFee) : '0');
  const [active, setActive] = useState(rule?.isActive ?? true);
  const { busy, error, run, clearError } = useDialogAction(onDone);

  const minP = parseBound(min);
  const maxP = parseBound(max);
  const rateP = parseFeeRate(rate);
  const fixedP = parseFixedFee(fixed);

  const minValue = minP.value;
  const maxValue = maxP.value;
  const rangeError =
    minValue !== null && maxValue !== null && maxValue <= minValue ? 'Le plafond doit être supérieur au minimum.' : null;

  const draft: FeeRuleInput | null =
    minValue !== null && rateP.value !== null && fixedP.value !== null && !minP.error && !maxP.error && !rangeError
      ? {
          label: label.trim() === '' ? null : label.trim(),
          payoutMethod: method === '' ? null : method,
          sendCountry: from === '' ? null : from,
          receiveCountry: to === '' ? null : to,
          currency,
          minAmount: minValue,
          maxAmount: maxValue,
          feeRate: rateP.value,
          fixedFee: fixedP.value,
          isActive: active,
        }
      : null;

  const clash = draft ? findOverlap(draft, rules, rule?.id) : null;
  const unchanged =
    rule !== null &&
    draft !== null &&
    (Object.keys(draft) as (keyof FeeRuleInput)[]).every((k) => draft[k] === (rule as unknown as FeeRuleInput)[k]);
  const valid = draft !== null && !clash && !unchanged && label.length <= 60;

  function submit() {
    if (!valid || !draft) return;
    const input = draft;
    void run(async () => {
      if (rule) {
        await api.feeSchedule.update(rule.id, input);
        return `Règle « ${ruleTitle(input)} » modifiée.`;
      }
      await api.feeSchedule.create(input);
      return `Règle « ${ruleTitle(input)} » ajoutée au barème.`;
    });
  }

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    clearError();
  };

  return (
    <ConfirmDialog
      open
      title={rule ? 'Modifier la règle' : 'Ajouter une règle'}
      confirmLabel={rule ? 'Enregistrer la règle' : 'Ajouter la règle'}
      busy={busy}
      confirmDisabled={!valid}
      onConfirm={submit}
      onCancel={onClose}
    >
      <form
        className="dialog-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="submit" hidden />
        <Field
          id="rule-label"
          label="Nom de la règle (facultatif)"
          value={label}
          maxLength={60}
          onChange={(e) => touch(setLabel)(e.target.value)}
          hint="Par exemple « France → Guinée, petits envois »."
          autoFocus
        />

        <fieldset className="rule-fieldset">
          <legend>À quels envois elle s’applique</legend>
          <SelectField
            id="rule-from"
            label="Pays d’envoi"
            value={from}
            onChange={(e) => touch(setFrom)(e.target.value)}
            options={COUNTRY_OPTIONS}
            placeholder="Tous les pays"
          />
          <SelectField
            id="rule-to"
            label="Pays de réception"
            value={to}
            onChange={(e) => touch(setTo)(e.target.value)}
            options={COUNTRY_OPTIONS}
            placeholder="Tous les pays"
          />
          <SelectField
            id="rule-method"
            label="Mode de retrait"
            value={method}
            onChange={(e) => touch(setMethod)(e.target.value)}
            options={CHARGED_METHODS}
            placeholder="Tous les modes"
            hint="Mobile Money et wallet vers wallet sont toujours gratuits."
          />
        </fieldset>

        <fieldset className="rule-fieldset">
          <legend>Tranche de montant</legend>
          <SelectField
            id="rule-currency"
            label="Devise de la règle"
            value={currency}
            onChange={(e) => touch(setCurrency)(e.target.value as CurrencyCode)}
            options={CURRENCY_OPTIONS}
            hint="La tranche et le frais fixe sont exprimés dans cette devise. Un envoi dans une autre devise y est converti pour être comparé."
          />
          <div className="rule-row">
            <Field
              id="rule-min"
              label="À partir de"
              inputMode="decimal"
              autoComplete="off"
              value={min}
              onChange={(e) => touch(setMin)(e.target.value)}
              error={min.trim() === '' ? 'Saisissez un minimum (0 pour commencer à zéro).' : minP.error}
            />
            <Field
              id="rule-max"
              label="Jusqu’à (exclu)"
              inputMode="decimal"
              autoComplete="off"
              value={max}
              onChange={(e) => touch(setMax)(e.target.value)}
              error={maxP.error ?? rangeError}
              hint="Laissez vide : sans plafond."
            />
          </div>
        </fieldset>

        <fieldset className="rule-fieldset">
          <legend>Frais prélevés</legend>
          <div className="rule-row">
            <Field
              id="rule-rate"
              label="Taux en pourcentage"
              inputMode="decimal"
              autoComplete="off"
              value={rate}
              onChange={(e) => touch(setRate)(e.target.value)}
              error={rate.trim() === '' ? 'Saisissez un taux (0 pour aucun).' : rateP.error}
              hint={`Jusqu’à ${MAX_FEE_RATE} %.`}
            />
            <Field
              id="rule-fixed"
              label={`Frais fixe (${currency})`}
              inputMode="decimal"
              autoComplete="off"
              value={fixed}
              onChange={(e) => touch(setFixed)(e.target.value)}
              error={fixed.trim() === '' ? 'Saisissez un montant (0 pour aucun).' : fixedP.error}
              hint={`Converti dans la devise de l’envoi. Jusqu’à ${money(MAX_FIXED_FEE, currency)}.`}
            />
          </div>
        </fieldset>

        <label className="check-row">
          <input type="checkbox" checked={active} onChange={(e) => touch(setActive)(e.target.checked)} />
          <span>
            Règle active
            <small>Une règle désactivée reste dans le barème mais n’est jamais appliquée.</small>
          </span>
        </label>

        {draft ? (
          <div className="fee-preview" aria-live="polite">
            <p>
              <span className="muted">Frais de cette règle</span>
              <strong>{ruleFee(draft)}</strong>
            </p>
          </div>
        ) : null}
        {clash ? (
          <Notice tone="error">
            Cette tranche chevauche « {ruleTitle(clash)} » pour les mêmes critères. Ajustez les montants ou désactivez l’autre règle.
          </Notice>
        ) : null}
        {unchanged ? <Notice tone="info">Aucune modification à enregistrer.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}
