// src/pages/fees/FeeSimulator.tsx
// « Combien coûte un envoi ? » : appelle le calcul exact du serveur (GET /fees-admin/quote), celui qui est
// appliqué à un vrai envoi. Aucun calcul n'est refait ici.

import { useEffect, useState } from 'react';
import type { CurrencyCode, FeeQuote } from '@direct-transfair/shared';
import { SelectField } from '../../components/form';
import { Field, Notice, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { COUNTRIES, countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { formatNumber, parseExample } from '../../lib/feeRules';
import { CURRENCIES, METHOD_NAME, SIMULATOR_METHODS, SOURCE_LABEL, money } from '../../lib/feeScheduleRules';

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

export default function FeeSimulator({ clientId, version }: { clientId?: number; version: number }) {
  const [amount, setAmount] = useState('100');
  const [currency, setCurrency] = useState<CurrencyCode>('EUR');
  const [method, setMethod] = useState('CASH_PICKUP');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = parseExample(amount);

  useEffect(() => {
    if (parsed.value === null) {
      setQuote(null);
      setError(null);
      return;
    }
    const value = parsed.value;
    let cancelled = false;
    setBusy(true);
    // Petit délai : on ne lance pas un calcul à chaque frappe.
    const timer = window.setTimeout(() => {
      api.feeSchedule
        .quote({ amount: value, currency, payoutMethod: method, sendCountry: from || null, receiveCountry: to || null, clientId })
        .then((q) => {
          if (cancelled) return;
          setQuote(q);
          setError(null);
          setBusy(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setQuote(null);
          setError(describeError(err).message);
          setBusy(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `version` : relance le calcul quand le barème change.
  }, [parsed.value, currency, method, from, to, clientId, version]);

  return (
    <section aria-labelledby="sim-title" className="tr-section">
      <div className="tr-section__head">
        <h2 id="sim-title">Simuler un envoi</h2>
        <p>Voyez ce que paierait un client, avec la règle qui s’appliquerait.</p>
      </div>
      <div className="sim-card">
        <div className="sim-form">
          <Field
            id="sim-amount"
            label="Montant envoyé"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amount.trim() === '' ? 'Saisissez un montant.' : parsed.error}
          />
          <SelectField id="sim-currency" label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} options={CURRENCY_OPTIONS} />
          <SelectField id="sim-method" label="Mode de retrait" value={method} onChange={(e) => setMethod(e.target.value)} options={SIMULATOR_METHODS} />
          <SelectField id="sim-from" label="Pays d’envoi" value={from} onChange={(e) => setFrom(e.target.value)} options={COUNTRY_OPTIONS} placeholder="Non précisé" />
          <SelectField id="sim-to" label="Pays de réception" value={to} onChange={(e) => setTo(e.target.value)} options={COUNTRY_OPTIONS} placeholder="Non précisé" />
        </div>

        <div className="sim-result" aria-live="polite">
          {busy && !quote ? (
            <Spinner label="Calcul en cours" />
          ) : error ? (
            <Notice tone="error">{error}</Notice>
          ) : quote ? (
            <>
              <p className="sim-result__line">
                <span className="muted">Frais</span>
                <strong data-testid="sim-fees">{quote.fees === 0 ? 'Aucun frais' : money(quote.fees, quote.currency)}</strong>
              </p>
              <p className="sim-result__line">
                <span className="muted">Le client paie</span>
                <strong data-testid="sim-total">{money(quote.total, quote.currency)}</strong>
              </p>
              <p className="sim-result__why" data-testid="sim-why">
                <strong>{SOURCE_LABEL[quote.source]}</strong>
                {quote.rule ? ` : « ${quote.rule.label ?? 'sans nom'} »` : ''}
                {quote.source !== 'FREE' && quote.source !== 'RULE' ? ` (${formatNumber(quote.feeRatePct)} %${quote.fixedFee > 0 ? ` + ${money(quote.fixedFee, quote.currency)}` : ''})` : ''}
              </p>
              {quote.fixedFeeOriginal && quote.fixedFeeOriginal.currency !== quote.currency ? (
                <p className="sim-result__note">
                  Frais fixe de {money(quote.fixedFeeOriginal.amount, quote.fixedFeeOriginal.currency)} converti en {money(quote.fixedFee, quote.currency)}.
                </p>
              ) : null}
              {method !== 'WALLET' && method !== 'MOBILE_MONEY' && (from || to) ? (
                <p className="sim-result__note">
                  {countryName(from) ?? 'Pays d’envoi non précisé'} → {countryName(to) ?? 'pays de réception non précisé'}
                  {METHOD_NAME[method] ? ` · ${METHOD_NAME[method]}` : ''}
                </p>
              ) : null}
            </>
          ) : (
            <p className="muted">Saisissez un montant pour voir le calcul.</p>
          )}
        </div>
      </div>
    </section>
  );
}
