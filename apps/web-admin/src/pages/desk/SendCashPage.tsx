// src/pages/desk/SendCashPage.tsx
// Envoi cash (agent) : un client remet des espèces au guichet pour un bénéficiaire à l'étranger.
// Les frais, le taux et le montant reçu viennent du serveur (aperçu) : l'écran montre ce qui sera appliqué.
// Le code de retrait à communiquer au bénéficiaire est la référence de l'opération.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SendPreview, Transaction } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Icon } from '../../components/Icon';
import { Button, Card, Field, Notice, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { COUNTRIES } from '../../lib/countries';
import { defaultDial, mainWallet, parsePhone } from '../../lib/deskRules';
import { dialOf } from '../../lib/dialCodes';
import { describeError } from '../../lib/errors';
import { statusLabel } from '../../lib/transactionRules';
import { parseAmount } from '../../lib/treasuryRules';
import { CashBox } from './CashBox';
import { PhoneField } from './PhoneField';
import { Receipt } from './Receipt';
import { useDesk } from './useDesk';

type PreviewState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; key: string; data: SendPreview }
  | { state: 'error'; message: string };

interface Done {
  tx: Transaction;
  beneficiary: string;
  city: string;
  country: string;
  preview: SendPreview;
  sender: string;
  agencyName: string | null;
}

const DEBOUNCE_MS = 450;
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export default function SendCashPage() {
  const desk = useDesk();
  const wallet = mainWallet(desk.data);
  const currency = wallet?.currency ?? '';

  // Bénéficiaire
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [city, setCity] = useState('');
  const [benDialPick, setBenDialPick] = useState<string | null>(null);
  const [benPhoneRaw, setBenPhoneRaw] = useState('');
  // Montant
  const [amountRaw, setAmountRaw] = useState('');
  // Expéditeur (le client au guichet)
  const [senderFirst, setSenderFirst] = useState('');
  const [senderLast, setSenderLast] = useState('');
  const [sendDialPick, setSendDialPick] = useState<string | null>(null);
  const [senderPhoneRaw, setSenderPhoneRaw] = useState('');
  const [note, setNote] = useState('');

  const [preview, setPreview] = useState<PreviewState>({ state: 'idle' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  // Si l'envoi échoue après la création du bénéficiaire, un nouvel essai réutilise ce bénéficiaire.
  const created = useRef<{ key: string; id: string } | null>(null);

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? null;
  const benDial = benDialPick ?? (countryCode ? dialOf(countryCode) : null) ?? defaultDial(desk.data?.agency?.country);
  const sendDial = sendDialPick ?? defaultDial(desk.data?.agency?.country);
  const benPhone = useMemo(() => parsePhone(benDial, benPhoneRaw), [benDial, benPhoneRaw]);
  const senderPhone = useMemo(() => parsePhone(sendDial, senderPhoneRaw), [sendDial, senderPhoneRaw]);
  const amount = useMemo(() => parseAmount(amountRaw, currency || 'XOF'), [amountRaw, currency]);

  // Aperçu serveur : seulement quand montant et pays sont valides, après une courte pause de frappe.
  const previewKey = amount.value !== null && countryCode && currency ? `${amount.value}|${countryCode}|${currency}` : null;
  useEffect(() => {
    if (!previewKey || amount.value === null) {
      setPreview({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setPreview({ state: 'loading' });
    const timer = window.setTimeout(() => {
      api.agentDesk
        .sendPreview(amount.value as number, countryCode)
        .then((data) => {
          if (!cancelled) setPreview({ state: 'ok', key: previewKey, data });
        })
        .catch((err: unknown) => {
          if (!cancelled) setPreview({ state: 'error', message: describeError(err).message });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const quote = preview.state === 'ok' && preview.key === previewKey ? preview.data : null;
  const blockedBox = !wallet || wallet.isFrozen || desk.data?.agency?.isActive === false;
  const nameOk = fullName.trim().length >= 2;
  const cityOk = city.trim().length >= 2;
  const senderOk = senderFirst.trim().length >= 1 && senderLast.trim().length >= 1;
  const canSubmit =
    nameOk && cityOk && senderOk && !!country && !benPhone.error && !senderPhone.error && !!quote && quote.enough && !blockedBox;

  async function send() {
    if (!quote || !country || amount.value === null) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        fullName: fullName.trim(),
        country: country.name,
        city: city.trim(),
        ...(benPhone.value ? { phone: benPhone.value } : {}),
      };
      const key = JSON.stringify(body);
      let beneficiaryId = created.current?.key === key ? created.current.id : null;
      if (!beneficiaryId) {
        const b = await api.agentDesk.createBeneficiary(body);
        beneficiaryId = b.id;
        created.current = { key, id: b.id };
      }
      const tx = await api.agentDesk.sendCash({
        amount: amount.value,
        currency: quote.currency,
        beneficiaryId,
        senderFirstName: senderFirst.trim(),
        senderLastName: senderLast.trim(),
        ...(senderPhone.value ? { senderPhone: senderPhone.value } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      created.current = null;
      setDone({
        tx,
        beneficiary: body.fullName,
        city: body.city,
        country: country.name,
        preview: quote,
        sender: `${senderFirst.trim()} ${senderLast.trim()}`,
        agencyName: desk.data?.agency?.name ?? null,
      });
      setConfirming(false);
      desk.reload();
    } catch (err) {
      setError(describeError(err).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setDone(null);
    setFullName('');
    setCountryCode('');
    setCity('');
    setBenDialPick(null);
    setBenPhoneRaw('');
    setAmountRaw('');
    setSenderFirst('');
    setSenderLast('');
    setSenderPhoneRaw('');
    setNote('');
    setError(null);
    created.current = null;
  }

  if (done) {
    const waiting = done.tx.status === 'PENDING';
    const p = done.preview;
    return (
      <div className="desk-page">
        <PageHeader title="Envoi cash" description="L’envoi est enregistré." />
        <CashBox desk={desk} />
        <Receipt
          title="Envoi enregistré"
          lead={
            waiting
              ? 'Cet envoi attend la validation d’un administrateur avant de pouvoir être retiré.'
              : `Donnez le code au client : ${done.beneficiary} pourra retirer l’argent à ${done.city}.`
          }
          at={done.tx.createdAt}
          reference={done.tx.reference}
          code={{ label: 'Code de retrait', value: done.tx.reference }}
          agencyName={done.agencyName}
          note={waiting ? `Statut : ${statusLabel(done.tx.status).toLowerCase()}. Le code ne sera payable qu’après validation.` : undefined}
          lines={[
            { label: 'Expéditeur', value: done.sender },
            { label: 'Bénéficiaire', value: `${done.beneficiary} — ${done.city}, ${done.country}` },
            { label: 'Montant remis', value: formatAmount(p.amount, p.currency) },
            { label: 'Frais', value: formatAmount(p.fees, p.currency) },
            { label: 'Total encaissé', value: formatAmount(p.total, p.currency), strong: true },
            { label: 'Le bénéficiaire reçoit', value: formatAmount(p.receivedAmount, p.targetCurrency), strong: true },
          ]}
        >
          <Button icon="send" onClick={again}>
            Nouvel envoi
          </Button>
        </Receipt>
      </div>
    );
  }

  return (
    <div className="desk-page">
      <PageHeader
        title="Envoi cash"
        description="Le client remet des espèces pour un proche à l’étranger. Il reçoit un code à lui transmettre."
      />
      <CashBox desk={desk} forecast={quote ? { delta: -quote.total, currency: quote.currency } : null} />

      {error ? (
        <Notice tone="error" title="Envoi non effectué">
          {error}
        </Notice>
      ) : null}

      <Card className="desk-step">
        <h2 className="card-title">1. Bénéficiaire</h2>
        <div className="desk-form">
          <Field
            id="send-ben-name"
            label="Nom complet"
            autoComplete="off"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            hint="Tel qu’il figure sur sa pièce d’identité : il lui sera demandé au retrait."
          />
          <div className="desk-form__pair">
            <SelectField
              id="send-ben-country"
              label="Pays de retrait"
              placeholder="Choisir un pays"
              options={COUNTRY_OPTIONS}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            />
            <Field id="send-ben-city" label="Ville" autoComplete="off" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <PhoneField
            id="send-ben-phone"
            label="Téléphone du bénéficiaire (facultatif)"
            dial={benDial}
            value={benPhoneRaw}
            onDial={setBenDialPick}
            onValue={setBenPhoneRaw}
            error={benPhone.error}
          />
        </div>
      </Card>

      <Card className="desk-step">
        <h2 className="card-title">2. Montant</h2>
        <div className="desk-form">
          <Field
            id="send-amount"
            label={`Montant remis par le client, en ${currency || 'devise de la caisse'}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
            error={amount.error}
            trailing={currency}
            hint="Les frais s’ajoutent à ce montant."
          />

          {preview.state === 'loading' ? (
            <div className="desk-quote desk-quote--loading" aria-busy="true">
              <Spinner label="Calcul des frais" />
              <span>Calcul des frais…</span>
            </div>
          ) : null}
          {preview.state === 'error' && previewKey ? <Notice tone="error" title="Calcul impossible">{preview.message}</Notice> : null}
          {quote ? (
            <div className="desk-quote" aria-live="polite">
              <dl>
                <div>
                  <dt>Montant</dt>
                  <dd>{formatAmount(quote.amount, quote.currency)}</dd>
                </div>
                <div>
                  <dt>Frais{quote.feeRatePct ? ` (${quote.feeRatePct} %)` : ''}</dt>
                  <dd>{quote.fees > 0 ? formatAmount(quote.fees, quote.currency) : 'Gratuit'}</dd>
                </div>
                <div className="desk-quote__total">
                  <dt>Total à encaisser</dt>
                  <dd>{formatAmount(quote.total, quote.currency)}</dd>
                </div>
              </dl>
              <div className="desk-quote__recv">
                <Icon name="swap" size={18} />
                <div>
                  <span>Le bénéficiaire reçoit</span>
                  <strong>{formatAmount(quote.receivedAmount, quote.targetCurrency)}</strong>
                  {quote.currency !== quote.targetCurrency ? (
                    <small>
                      1 {quote.currency} = {quote.exchangeRate.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} {quote.targetCurrency}
                    </small>
                  ) : null}
                </div>
              </div>
              {!quote.enough ? (
                <Notice tone="error" title="Caisse insuffisante">
                  Il manque {formatAmount(quote.total - quote.available, quote.currency)} en caisse pour cet envoi.
                </Notice>
              ) : null}
              {quote.needsValidation ? (
                <Notice tone="info" title="Validation requise">
                  Au-delà de {formatAmount(quote.validationThreshold, quote.currency)}, un administrateur doit valider l’envoi avant le retrait.
                </Notice>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="desk-step">
        <h2 className="card-title">3. Client au guichet</h2>
        <div className="desk-form">
          <div className="desk-form__pair">
            <Field id="send-sender-first" label="Prénom" autoComplete="off" value={senderFirst} onChange={(e) => setSenderFirst(e.target.value)} />
            <Field id="send-sender-last" label="Nom" autoComplete="off" value={senderLast} onChange={(e) => setSenderLast(e.target.value)} />
          </div>
          <PhoneField
            id="send-sender-phone"
            label="Téléphone du client (facultatif)"
            dial={sendDial}
            value={senderPhoneRaw}
            onDial={setSendDialPick}
            onValue={setSenderPhoneRaw}
            error={senderPhone.error}
          />
          <Field
            id="send-note"
            label="Motif (facultatif)"
            autoComplete="off"
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button icon="send" disabled={!canSubmit} onClick={() => setConfirming(true)}>
            Vérifier et envoyer
          </Button>
          {!canSubmit && quote?.enough !== false ? (
            <p className="desk-form__help">
              {!nameOk || !cityOk || !country
                ? 'Complétez le bénéficiaire (nom, pays, ville).'
                : !quote
                  ? 'Saisissez le montant pour calculer les frais.'
                  : !senderOk
                    ? 'Indiquez le nom du client qui remet l’argent.'
                    : ''}
            </p>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Confirmer l’envoi"
        confirmLabel="Envoyer"
        busy={busy}
        onConfirm={() => void send()}
        onCancel={() => setConfirming(false)}
      >
        {quote ? (
          <>
            <dl className="kv kv--compact">
              <div className="kv__row">
                <dt>Bénéficiaire</dt>
                <dd>
                  {fullName.trim()}, {city.trim()} ({country?.name})
                </dd>
              </div>
              <div className="kv__row">
                <dt>Il reçoit</dt>
                <dd>
                  <strong>{formatAmount(quote.receivedAmount, quote.targetCurrency)}</strong>
                </dd>
              </div>
              <div className="kv__row">
                <dt>À encaisser</dt>
                <dd>
                  <strong>{formatAmount(quote.total, quote.currency)}</strong> (frais {formatAmount(quote.fees, quote.currency)} compris)
                </dd>
              </div>
            </dl>
            <p>Avez-vous bien encaissé cette somme en espèces ? Votre caisse sera débitée.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
