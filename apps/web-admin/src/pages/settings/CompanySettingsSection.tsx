// src/pages/settings/CompanySettingsSection.tsx
// Réglages › Paramètres de la société : modes d'envoi gratuits, taux de repli, recharge, comptes marchands, partage par défaut,
// règles des codes de retrait et seuils d'alerte de caisse basse.
// Présentation : un groupe repliable par thème (titre + résumé d'une ligne), champs en grille à deux colonnes, et une barre
// d'enregistrement fixe en bas de l'écran. Rien n'est codé en dur : chaque valeur est celle que l'administrateur a choisie.
// Admin de société : modifie. Super admin : consulte.

import { useEffect, useMemo, useState } from 'react';
import type { CompanySettingsChange, CompanySettingsView } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Button, Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import {
  CURRENCY_NAME,
  FALLBACK_LIMITS,
  platformShare,
  sameForm,
  toForm,
  toPatch,
  validate,
  type Limits,
  type SettingsForm,
} from '../../lib/companySettingsRules';
import { describeError } from '../../lib/errors';
import { fullDate, when } from '../../lib/supervisionRules';
import type { Resource } from '../../lib/useResource';
import { ChangeLog, SetGroup, SwitchRow, type LogItem } from './SettingsKit';

interface Props {
  settings: Resource<CompanySettingsView | null>;
  log: Resource<{ data: CompanySettingsChange[] }>;
  onChanged: (message: string) => void;
  /** Prévient la page quand des changements ne sont pas enregistrés (point sur l'onglet). */
  onDirtyChange?: (dirty: boolean) => void;
}

const MERCHANT_PAYOUTS = [
  { key: 'ORANGE_MONEY', label: 'Orange Money', hint: 'Vers le numéro choisi à l’inscription' },
  { key: 'BANK_TRANSFER', label: 'Virement bancaire', hint: 'Vers le compte bancaire (IBAN) du marchand' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const toItem = (c: CompanySettingsChange): LogItem => ({
  id: c.id,
  title: 'Paramètres modifiés',
  createdAt: c.createdAt,
  user: c.user,
  lines: [],
});

function toggled(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

export default function CompanySettingsSection({ settings, log, onChanged, onDirtyChange }: Props) {
  const view = settings.data;
  const editable = view?.editable ?? false;
  const limits = useMemo<Limits>(() => ({ ...FALLBACK_LIMITS, ...(view?.options.limits as Partial<Limits> | undefined) }), [view]);

  const saved = useMemo(() => (view ? toForm(view.settings) : null), [view]);
  const [form, setForm] = useState<SettingsForm | null>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Repart des valeurs enregistrées à chaque rechargement (changement de société, enregistrement, rétablissement).
  useEffect(() => {
    setForm(saved);
    setError(null);
  }, [saved]);

  const dirty = form !== null && saved !== null && !sameForm(form, saved);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  if (!view || !form || !saved) return null;

  const errors = validate(form, limits);
  const hasErrors = Object.keys(errors).length > 0;
  const platform = platformShare(form);
  const patch = (p: Partial<SettingsForm>) => {
    setForm({ ...form, ...p });
    setError(null);
  };
  const off = !editable || busy;
  const bad = (...keys: string[]) => Object.keys(errors).some((k) => keys.some((p) => k === p || k.startsWith(`${p}.`)));
  const currencies = Object.keys(form.merchantMinPayment);

  async function save() {
    if (!form || hasErrors || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      await api.companySettings.update(toPatch(form));
      onChanged('Paramètres enregistrés : ils s’appliquent dès le prochain envoi.');
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await api.companySettings.reset();
      setConfirmReset(false);
      onChanged('Paramètres rétablis : les valeurs par défaut s’appliquent de nouveau.');
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const freeCount = view.options.feeMethods.filter((m) => form.freeMethods.includes(m.key)).length;
  const rechargeCount = view.options.rechargeMethods.filter((m) => form.rechargeMethods.includes(m.key)).length;
  const watched = Object.values(form.lowBalance).filter((v) => Number(String(v).replace(',', '.')) > 0).length;

  return (
    <div className="set-panel cs">
      <p className="set-intro">
        Tout est réglé par votre société. Les changements s’appliquent aux prochains envois et retraits ; pensez à enregistrer en bas de l’écran.
      </p>

      <SetGroup
        id="cs-free"
        icon="send"
        title="Envois gratuits"
        summary={`${freeCount === 0 ? 'Aucun mode gratuit' : plural(freeCount, 'mode gratuit', 'modes gratuits')} · repli ${form.fallbackFeeRatePct || '—'} %`}
        alert={bad('fallbackFeeRatePct')}
        forceOpen={bad('fallbackFeeRatePct')}
        defaultOpen
      >
        <p className="set-note">Seuls les modes activés sont gratuits. Par défaut : uniquement l’envoi de wallet à wallet.</p>
        <div className="set-switches">
          {view.options.feeMethods.map((m) => (
            <SwitchRow
              key={m.key}
              label={m.label}
              hint={form.freeMethods.includes(m.key) ? 'Gratuit : aucun frais prélevé' : 'Payant : barème, tarif du mode ou taux de repli'}
              checked={form.freeMethods.includes(m.key)}
              disabled={off}
              onChange={() => patch({ freeMethods: toggled(form.freeMethods, m.key) })}
            />
          ))}
        </div>
        <div className="set-grid">
          <Field
            id="cs-fallback"
            label="Taux de repli (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.fallbackFeeRatePct}
            disabled={off}
            onChange={(e) => patch({ fallbackFeeRatePct: e.target.value })}
            error={errors.fallbackFeeRatePct}
          />
        </div>
        <p className="set-note">Le taux de repli s’applique quand ni le barème ni le tarif du mode ne couvre un envoi payant.</p>
        {freeCount === 0 ? <Notice tone="info">Aucun mode gratuit : même un envoi de wallet à wallet sera facturé.</Notice> : null}
      </SetGroup>

      <SetGroup
        id="cs-recharge"
        icon="deposit"
        title="Recharge du wallet"
        summary={rechargeCount === 0 ? 'Recharge fermée' : `${plural(rechargeCount, 'moyen ouvert', 'moyens ouverts')} aux clients`}
      >
        <p className="set-note">Moyens que vos clients peuvent utiliser pour recharger leur wallet. Désactivez-les tous pour fermer la recharge.</p>
        <div className="set-switches">
          {view.options.rechargeMethods.map((m) => (
            <SwitchRow
              key={m.key}
              label={m.label}
              hint={form.rechargeMethods.includes(m.key) ? 'Ouvert aux clients' : 'Fermé'}
              checked={form.rechargeMethods.includes(m.key)}
              disabled={off}
              onChange={() => patch({ rechargeMethods: toggled(form.rechargeMethods, m.key) })}
            />
          ))}
        </div>
        <Notice tone="info">
          Aucun prestataire de paiement réel n’est encore raccordé : les recharges sont des simulations. Avant l’ouverture au public, fermez-les ici ou sur le serveur
          (BLOCK_SIMULATED_RECHARGES=true).
        </Notice>
      </SetGroup>

      <SetGroup
        id="cs-merchant"
        icon="wallet"
        title="Comptes marchands"
        summary={`${form.merchantEnabled ? 'Ouverts' : 'Fermés'} · commission ${form.merchantPaymentFeePct || '—'} %`}
        alert={bad('merchantPaymentFeePct', 'merchantQrMinutes', 'merchantPhoneMinutes', 'merchantMinPayment', 'merchantMaxPayment', 'merchantPayoutFeePct', 'merchantCooldownHours', 'merchantMinPayout')}
        forceOpen={bad('merchantPaymentFeePct', 'merchantQrMinutes', 'merchantPhoneMinutes', 'merchantMinPayment', 'merchantMaxPayment', 'merchantPayoutFeePct', 'merchantCooldownHours', 'merchantMinPayout')}
      >
        <p className="set-note">Encaissement des commerçants par numéro de téléphone ou par QR code, et retrait de leur solde.</p>
        <SwitchRow
          label="Comptes marchands ouverts"
          hint={form.merchantEnabled ? 'Inscription et encaissement possibles' : 'Fermé : plus d’inscription ni de nouvel encaissement'}
          checked={form.merchantEnabled}
          disabled={off}
          onChange={(v) => patch({ merchantEnabled: v })}
        />
        <div className="set-grid">
          <Field
            id="cs-m-fee"
            label="Commission d’encaissement (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.merchantPaymentFeePct}
            disabled={off}
            onChange={(e) => patch({ merchantPaymentFeePct: e.target.value })}
            error={errors.merchantPaymentFeePct}
          />
          <Field
            id="cs-m-qr"
            label="Validité d’un QR (min)"
            inputMode="numeric"
            autoComplete="off"
            value={form.merchantQrMinutes}
            disabled={off}
            onChange={(e) => patch({ merchantQrMinutes: e.target.value })}
            error={errors.merchantQrMinutes}
          />
          <Field
            id="cs-m-phone"
            label="Validité par téléphone (min)"
            inputMode="numeric"
            autoComplete="off"
            value={form.merchantPhoneMinutes}
            disabled={off}
            onChange={(e) => patch({ merchantPhoneMinutes: e.target.value })}
            error={errors.merchantPhoneMinutes}
          />
        </div>
        <p className="set-note">La commission est retenue sur le marchand à chaque paiement reçu et versée à la société.</p>

        <h4 className="set-sub">Plafonds par paiement</h4>
        <div className="set-curs">
          {currencies.map((cur) => (
            <div key={`pay-${cur}`} className="set-cur" role="group" aria-label={`Plafonds par paiement en ${cur}`}>
              <span className="set-cur__code">{cur}</span>
              <Field
                id={`cs-m-min-${cur}`}
                label="Minimum"
                inputMode="decimal"
                autoComplete="off"
                value={form.merchantMinPayment[cur] ?? ''}
                disabled={off}
                onChange={(e) => patch({ merchantMinPayment: { ...form.merchantMinPayment, [cur]: e.target.value } })}
                error={errors[`merchantMinPayment.${cur}`]}
              />
              <Field
                id={`cs-m-max-${cur}`}
                label="Maximum"
                inputMode="decimal"
                autoComplete="off"
                value={form.merchantMaxPayment[cur] ?? ''}
                disabled={off}
                onChange={(e) => patch({ merchantMaxPayment: { ...form.merchantMaxPayment, [cur]: e.target.value } })}
                error={errors[`merchantMaxPayment.${cur}`]}
              />
            </div>
          ))}
        </div>

        <h4 className="set-sub">Retraits des marchands</h4>
        <div className="set-switches">
          {MERCHANT_PAYOUTS.map((m) => (
            <SwitchRow
              key={m.key}
              label={m.label}
              hint={form.merchantPayoutMethods.includes(m.key) ? m.hint : 'Fermé'}
              checked={form.merchantPayoutMethods.includes(m.key)}
              disabled={off}
              onChange={() => patch({ merchantPayoutMethods: toggled(form.merchantPayoutMethods, m.key) })}
            />
          ))}
        </div>
        <div className="set-grid">
          <Field
            id="cs-m-payfee"
            label="Commission de retrait (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.merchantPayoutFeePct}
            disabled={off}
            onChange={(e) => patch({ merchantPayoutFeePct: e.target.value })}
            error={errors.merchantPayoutFeePct}
          />
          <Field
            id="cs-m-cool"
            label="Délai de sécurité (h)"
            inputMode="numeric"
            autoComplete="off"
            value={form.merchantCooldownHours}
            disabled={off}
            onChange={(e) => patch({ merchantCooldownHours: e.target.value })}
            error={errors.merchantCooldownHours}
          />
          {currencies.map((cur) => (
            <Field
              key={`payout-${cur}`}
              id={`cs-m-minpayout-${cur}`}
              label={`Retrait minimum ${cur}`}
              inputMode="decimal"
              autoComplete="off"
              value={form.merchantMinPayout[cur] ?? ''}
              disabled={off}
              onChange={(e) => patch({ merchantMinPayout: { ...form.merchantMinPayout, [cur]: e.target.value } })}
              error={errors[`merchantMinPayout.${cur}`]}
            />
          ))}
        </div>
        <p className="set-note">
          La commission de retrait n’est prélevée que si le retrait est payé. Pendant le délai de sécurité (0 = aucun), aucun retrait n’est possible après un
          changement de numéro Orange Money ou de compte bancaire.
        </p>
        <SwitchRow
          label="Mode essai : retraits payés automatiquement"
          hint="Pour tester sans argent réel. Sans effet en production : les retraits y restent à confirmer à la main (Marchands › Retraits)."
          checked={form.merchantPayoutMode === 'SANDBOX'}
          disabled={off}
          onChange={(v) => patch({ merchantPayoutMode: v ? 'SANDBOX' : 'MANUAL' })}
        />
      </SetGroup>

      <SetGroup
        id="cs-split"
        icon="percent"
        title="Partage des frais par défaut"
        summary={`Paiement ${form.payerShare || '—'} % · Envoi ${form.senderShare || '—'} % · Société ${platform === null ? '—' : String(platform).replace('.', ',')} %`}
        alert={bad('payerShare', 'senderShare')}
        forceOpen={bad('payerShare', 'senderShare')}
      >
        <p className="set-note">Utilisé tant qu’aucune règle n’est enregistrée pour une combinaison (onglet Frais).</p>
        <div className="set-grid set-grid--3">
          <Field
            id="cs-payer"
            label="Payeuse (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.payerShare}
            disabled={off}
            onChange={(e) => patch({ payerShare: e.target.value })}
            error={errors.payerShare}
          />
          <Field
            id="cs-sender"
            label="Envoi (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.senderShare}
            disabled={off}
            onChange={(e) => patch({ senderShare: e.target.value })}
            error={errors.senderShare}
          />
          <div className="set-rest" aria-live="polite">
            <span>Société</span>
            <strong data-testid="cs-platform">{platform === null ? '—' : `${String(platform).replace('.', ',')} %`}</strong>
          </div>
        </div>
        <p className="set-note">Agence payeuse, agence d’envoi ; la société reçoit le reste.</p>
      </SetGroup>

      <SetGroup
        id="cs-pickup"
        icon="shield"
        title="Codes de retrait"
        summary={`Valables ${form.validityMonths || '—'} mois · blocage après ${form.maxFailedChecks || '—'} essais`}
        alert={bad('validityMonths', 'maxFailedChecks', 'lockMinutes', 'phoneCheckDigits')}
        forceOpen={bad('validityMonths', 'maxFailedChecks', 'lockMinutes', 'phoneCheckDigits')}
      >
        <div className="set-grid set-grid--3">
          <Field
            id="cs-validity"
            label="Validité (mois)"
            inputMode="numeric"
            autoComplete="off"
            value={form.validityMonths}
            disabled={off}
            onChange={(e) => patch({ validityMonths: e.target.value })}
            error={errors.validityMonths}
          />
          <Field
            id="cs-max"
            label="Essais ratés"
            inputMode="numeric"
            autoComplete="off"
            value={form.maxFailedChecks}
            disabled={off}
            onChange={(e) => patch({ maxFailedChecks: e.target.value })}
            error={errors.maxFailedChecks}
          />
          <Field
            id="cs-lock"
            label="Blocage (min)"
            inputMode="numeric"
            autoComplete="off"
            value={form.lockMinutes}
            disabled={off}
            onChange={(e) => patch({ lockMinutes: e.target.value })}
            error={errors.lockMinutes}
          />
        </div>
        <p className="set-note">
          Validité : s’applique aux nouveaux codes ; passé ce délai, l’envoi est annulé et remboursé. Essais ratés avant blocage : comptés par agent.
        </p>
        <SwitchRow
          label="Vérifier le téléphone du bénéficiaire"
          hint="L’agent saisit les derniers chiffres du numéro donné par le bénéficiaire ; sans eux, le retrait n’est pas payé."
          checked={form.requirePhoneCheck}
          disabled={off}
          onChange={(v) => patch({ requirePhoneCheck: v })}
        />
        {form.requirePhoneCheck ? (
          <div className="set-grid">
            <Field
              id="cs-digits"
              label="Chiffres demandés"
              inputMode="numeric"
              autoComplete="off"
              value={form.phoneCheckDigits}
              disabled={off}
              onChange={(e) => patch({ phoneCheckDigits: e.target.value })}
              error={errors.phoneCheckDigits}
            />
          </div>
        ) : null}
      </SetGroup>

      <SetGroup
        id="cs-low"
        icon="vault"
        title="Alerte de caisse basse"
        summary={watched === 0 ? 'Aucune alerte' : `${plural(watched, 'devise surveillée', 'devises surveillées')}`}
        alert={bad('lowBalance')}
        forceOpen={bad('lowBalance')}
      >
        <p className="set-note">Seuil par devise sous lequel l’agent est prévenu après un paiement. 0 = pas d’alerte.</p>
        <div className="set-grid">
          {Object.keys(form.lowBalance).map((cur) => (
            <Field
              key={cur}
              id={`cs-low-${cur}`}
              label={CURRENCY_NAME[cur] ?? cur}
              inputMode="decimal"
              autoComplete="off"
              value={form.lowBalance[cur] ?? ''}
              disabled={off}
              onChange={(e) => patch({ lowBalance: { ...form.lowBalance, [cur]: e.target.value } })}
              error={errors[`lowBalance.${cur}`]}
            />
          ))}
        </div>
      </SetGroup>

      <ChangeLog resource={log} toItem={toItem} emptyText="Les changements de paramètres apparaîtront ici." />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {editable ? (
        <div className="set-savebar" role="group" aria-label="Enregistrement des paramètres">
          <p className="set-savebar__status" aria-live="polite">
            {dirty ? (
              <strong>{hasErrors ? 'Valeurs à corriger' : 'Modifications non enregistrées'}</strong>
            ) : view.updatedAt ? (
              <span className="muted">
                Modifié{' '}
                <time dateTime={view.updatedAt} title={fullDate(view.updatedAt)}>
                  {when(view.updatedAt)}
                </time>
              </span>
            ) : (
              <span className="muted">Valeurs par défaut</span>
            )}
          </p>
          <div className="set-savebar__btns">
            <Button onClick={save} busy={busy} disabled={!dirty || hasErrors}>
              Enregistrer
            </Button>
            <Button variant="secondary" onClick={() => setForm(saved)} disabled={!dirty || busy}>
              Annuler<span className="only-desktop"> les changements</span>
            </Button>
            <Button variant="secondary" icon="refresh" onClick={() => setConfirmReset(true)} disabled={busy || Object.keys(view.overridden).length === 0}>
              <span className="only-mobile">Défauts</span>
              <span className="only-desktop">Rétablir les valeurs par défaut</span>
            </Button>
          </div>
        </div>
      ) : (
        <Notice tone="info">Seul l’administrateur de la société modifie ces paramètres.</Notice>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Rétablir les valeurs par défaut ?"
        confirmLabel="Rétablir"
        busy={busy}
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      >
        <p>
          Tous les paramètres de la société reviennent aux valeurs d’origine (seul le wallet est gratuit, partage 40 / 20 / 40, code valable 5 mois…). Les barèmes, tarifs
          et règles de partage déjà enregistrés ne changent pas.
        </p>
      </ConfirmDialog>
    </div>
  );
}
