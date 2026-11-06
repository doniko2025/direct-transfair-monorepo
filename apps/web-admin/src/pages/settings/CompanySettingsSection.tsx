// src/pages/settings/CompanySettingsSection.tsx
// Réglages › Paramètres de la société : modes d'envoi gratuits, taux de repli, répartition par défaut des frais,
// règles des codes de retrait (validité, blocage, contrôle du téléphone) et seuils d'alerte de caisse basse.
// Rien n'est codé en dur : chaque valeur ci-dessous est celle que l'administrateur de la société a choisie.
// Admin de société : modifie. Super admin : consulte.

import { useEffect, useMemo, useState } from 'react';
import type { CompanySettingsChange, CompanySettingsView } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Button, Card, Field, Notice, Pill } from '../../components/ui';
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

interface Props {
  settings: Resource<CompanySettingsView | null>;
  log: Resource<{ data: CompanySettingsChange[] }>;
  onChanged: (message: string) => void;
}

const sectionTitle = (id: string, title: string, text: string) => (
  <div className="tr-section__head">
    <h3 id={id}>{title}</h3>
    <p>{text}</p>
  </div>
);

export default function CompanySettingsSection({ settings, log, onChanged }: Props) {
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

  if (!view || !form || !saved) return null;

  const errors = validate(form, limits);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = !sameForm(form, saved);
  const platform = platformShare(form);
  const patch = (p: Partial<SettingsForm>) => {
    setForm({ ...form, ...p });
    setError(null);
  };

  const toggleFree = (key: string) => {
    patch({ freeMethods: form.freeMethods.includes(key) ? form.freeMethods.filter((k) => k !== key) : [...form.freeMethods, key] });
  };

  const toggleRecharge = (key: string) => {
    patch({ rechargeMethods: form.rechargeMethods.includes(key) ? form.rechargeMethods.filter((k) => k !== key) : [...form.rechargeMethods, key] });
  };

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

  const freeLabel = view.options.feeMethods.filter((m) => form.freeMethods.includes(m.key)).map((m) => m.label);
  const entries = log.data?.data ?? [];

  return (
    <section aria-labelledby="cs-title" className="tr-section cs">
      <div className="tr-section__head">
        <h2 id="cs-title">Paramètres de la société</h2>
        <p>
          Tout ce qui suit est réglé par votre société : modes d’envoi gratuits, frais de repli, partage par défaut, règles des codes de retrait et alertes de
          caisse. Les changements s’appliquent aux prochains envois et retraits.
        </p>
      </div>

      <Card className="cs-card">
        {sectionTitle('cs-free', 'Envois gratuits', 'Seuls les modes cochés sont gratuits. Par défaut : uniquement l’envoi de wallet à wallet.')}
        <ul className="cs-checks" aria-labelledby="cs-free">
          {view.options.feeMethods.map((m) => (
            <li key={m.key}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.freeMethods.includes(m.key)}
                  disabled={!editable || busy}
                  onChange={() => toggleFree(m.key)}
                />
                <span>
                  {m.label}
                  <small>{form.freeMethods.includes(m.key) ? 'Gratuit : aucun frais prélevé' : 'Payant : barème, tarif du mode ou taux de repli'}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="cs-grid">
          <Field
            id="cs-fallback"
            label="Taux de repli (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.fallbackFeeRatePct}
            disabled={!editable || busy}
            onChange={(e) => patch({ fallbackFeeRatePct: e.target.value })}
            error={errors.fallbackFeeRatePct}
            hint="Appliqué quand ni le barème ni le tarif du mode ne couvre un envoi payant."
          />
        </div>
        {freeLabel.length === 0 ? <Notice tone="info">Aucun mode gratuit : même un envoi de wallet à wallet sera facturé.</Notice> : null}
      </Card>

      <Card className="cs-card">
        {sectionTitle('cs-recharge', 'Recharge du wallet', 'Moyens que vos clients peuvent utiliser pour recharger leur wallet. Décochez-les tous pour fermer la recharge.')}
        <ul className="cs-checks" aria-labelledby="cs-recharge">
          {view.options.rechargeMethods.map((m) => (
            <li key={m.key}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.rechargeMethods.includes(m.key)}
                  disabled={!editable || busy}
                  onChange={() => toggleRecharge(m.key)}
                />
                <span>
                  {m.label}
                  <small>{form.rechargeMethods.includes(m.key) ? 'Ouvert aux clients' : 'Fermé'}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Notice tone="info">
          Aucun prestataire de paiement réel n’est encore raccordé : les recharges sont des simulations. Avant l’ouverture au public, fermez-les ici ou
          sur le serveur (BLOCK_SIMULATED_RECHARGES=true).
        </Notice>
      </Card>

      <Card className="cs-card">
        {sectionTitle('cs-split', 'Partage des frais par défaut', 'Utilisé tant qu’aucune règle n’est enregistrée pour une combinaison (Réglages › Partage des frais).')}
        <div className="cs-grid">
          <Field
            id="cs-payer"
            label="Agence payeuse (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.payerShare}
            disabled={!editable || busy}
            onChange={(e) => patch({ payerShare: e.target.value })}
            error={errors.payerShare}
          />
          <Field
            id="cs-sender"
            label="Agence d’envoi (%)"
            inputMode="decimal"
            autoComplete="off"
            value={form.senderShare}
            disabled={!editable || busy}
            onChange={(e) => patch({ senderShare: e.target.value })}
            error={errors.senderShare}
          />
          <div className="fee-preview" aria-live="polite">
            <p>
              <span className="muted">Société (le reste)</span>
              <strong data-testid="cs-platform">{platform === null ? '—' : `${String(platform).replace('.', ',')} %`}</strong>
            </p>
          </div>
        </div>
      </Card>

      <Card className="cs-card">
        {sectionTitle('cs-pickup', 'Codes de retrait', 'Durée de vie des codes et protection contre les essais au hasard.')}
        <div className="cs-grid">
          <Field
            id="cs-validity"
            label="Validité d’un code (mois)"
            inputMode="numeric"
            autoComplete="off"
            value={form.validityMonths}
            disabled={!editable || busy}
            onChange={(e) => patch({ validityMonths: e.target.value })}
            error={errors.validityMonths}
            hint="S’applique aux nouveaux codes. Passé ce délai, l’envoi est annulé et remboursé."
          />
          <Field
            id="cs-max"
            label="Essais ratés avant blocage"
            inputMode="numeric"
            autoComplete="off"
            value={form.maxFailedChecks}
            disabled={!editable || busy}
            onChange={(e) => patch({ maxFailedChecks: e.target.value })}
            error={errors.maxFailedChecks}
            hint="Compté par agent."
          />
          <Field
            id="cs-lock"
            label="Durée du blocage (minutes)"
            inputMode="numeric"
            autoComplete="off"
            value={form.lockMinutes}
            disabled={!editable || busy}
            onChange={(e) => patch({ lockMinutes: e.target.value })}
            error={errors.lockMinutes}
          />
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.requirePhoneCheck}
            disabled={!editable || busy}
            onChange={(e) => patch({ requirePhoneCheck: e.target.checked })}
          />
          <span>
            Vérifier le téléphone du bénéficiaire
            <small>L’agent saisit les derniers chiffres du numéro que le bénéficiaire lui donne ; sans eux, le retrait n’est pas payé.</small>
          </span>
        </label>
        {form.requirePhoneCheck ? (
          <div className="cs-grid">
            <Field
              id="cs-digits"
              label="Chiffres demandés"
              inputMode="numeric"
              autoComplete="off"
              value={form.phoneCheckDigits}
              disabled={!editable || busy}
              onChange={(e) => patch({ phoneCheckDigits: e.target.value })}
              error={errors.phoneCheckDigits}
            />
          </div>
        ) : null}
      </Card>

      <Card className="cs-card">
        {sectionTitle('cs-low', 'Alerte de caisse basse', 'Seuil par devise sous lequel l’agent est prévenu après un paiement. 0 = pas d’alerte.')}
        <div className="cs-grid">
          {Object.keys(form.lowBalance).map((cur) => (
            <Field
              key={cur}
              id={`cs-low-${cur}`}
              label={CURRENCY_NAME[cur] ?? cur}
              inputMode="decimal"
              autoComplete="off"
              value={form.lowBalance[cur] ?? ''}
              disabled={!editable || busy}
              onChange={(e) => patch({ lowBalance: { ...form.lowBalance, [cur]: e.target.value } })}
              error={errors[`lowBalance.${cur}`]}
            />
          ))}
        </div>
      </Card>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {editable ? (
        <div className="cs-actions">
          <Button onClick={save} busy={busy} disabled={!dirty || hasErrors}>
            Enregistrer les paramètres
          </Button>
          <Button variant="secondary" onClick={() => setForm(saved)} disabled={!dirty || busy}>
            Annuler les changements
          </Button>
          <Button variant="secondary" onClick={() => setConfirmReset(true)} disabled={busy || Object.keys(view.overridden).length === 0}>
            Rétablir les valeurs par défaut
          </Button>
          {view.updatedAt ? (
            <span className="muted">
              Dernière modification{' '}
              <time dateTime={view.updatedAt} title={fullDate(view.updatedAt)}>
                {when(view.updatedAt)}
              </time>
            </span>
          ) : (
            <Pill tone="warn">Valeurs par défaut</Pill>
          )}
        </div>
      ) : (
        <Notice tone="info">Seul l’administrateur de la société modifie ces paramètres.</Notice>
      )}

      {entries.length > 0 ? (
        <Card className="cs-card">
          {sectionTitle('cs-log', 'Dernières modifications', 'Qui a changé les paramètres, et quand.')}
          <ul className="cs-log">
            {entries.map((c) => (
              <li key={c.id}>
                <strong>{c.user ?? 'Un administrateur'}</strong>
                <span className="muted">
                  <time dateTime={c.createdAt} title={fullDate(c.createdAt)}>
                    {when(c.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
    </section>
  );
}
