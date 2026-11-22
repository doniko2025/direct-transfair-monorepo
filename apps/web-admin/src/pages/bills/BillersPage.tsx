// apps/web-admin/src/pages/bills/BillersPage.tsx
// Facturiers de la société (lot 14) : ce que les clients peuvent payer depuis l'application (électricité, eau, assurance, scolarité, loyer…).
//   • « Paiement de factures » : ouverture à vos clients (fermé par défaut), plafonds, frais rendus en cas d'échec ;
//   • un facturier = un partenaire : nom, catégorie, devise, frais, champs demandés au client, délai de règlement annoncé,
//     connecteur (« manuel » : vous réglez puis confirmez ; « simulation » : essais), suivi du partenariat et coordonnées de règlement ;
//   • « Paiements programmés » : récurrence, prélèvement automatique (fermé par défaut), rappels ;
//   • un facturier « Brouillon » ou « Suspendu » n'est jamais visible des clients.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BILL_AMOUNT_MODE_LABEL,
  BILL_CATEGORY_LABEL,
  BILL_PARTNERSHIP_LABEL,
  BILLER_STATUS_LABEL,
  type BillAmountMode,
  type BillerAdmin,
  type BillerInput,
  type BillerStatus,
  type BillFieldDef,
  type BillFieldType,
  type BillPartnership,
  type CompanySettingsView,
} from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, SelectField, TextAreaField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { BILLER_TONE, PARTNERSHIP_TONE, categoryName, readNumber } from '../../lib/billRules';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { SwitchRow } from '../settings/SettingsKit';
import { useDialogAction } from '../treasury/useDialogAction';

// ─── Fonction « Paiement de factures » (réglages de la société) ───
function BillSettingsCard({ view, onSaved }: { view: CompanySettingsView; onSaved: (v: CompanySettingsView) => void }) {
  const current = view.settings.bills;
  const currencies = view.options.currencies;
  const [enabled, setEnabled] = useState(current.enabled);
  const [refundFee, setRefundFee] = useState(current.refundFeeOnFailure);
  const rec = current.recurring;
  const [recEnabled, setRecEnabled] = useState(rec.enabled);
  const [recAuto, setRecAuto] = useState(rec.autoDebitEnabled);
  const [recMax, setRecMax] = useState(String(rec.maxPerClient));
  const [recRemind, setRecRemind] = useState(String(rec.remindDaysBefore));
  const [recFailures, setRecFailures] = useState(String(rec.maxFailures));
  const [maxPay, setMaxPay] = useState<Record<string, string>>(() => Object.fromEntries(currencies.map((c) => [c, String(current.maxPerPayment[c] ?? '')])));
  const [maxDay, setMaxDay] = useState<Record<string, string>>(() => Object.fromEntries(currencies.map((c) => [c, String(current.maxPerDay[c] ?? '')])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const toMap = (src: Record<string, string>): Record<string, number | null> | string => {
      const out: Record<string, number | null> = {};
      for (const c of currencies) {
        const n = readNumber(src[c] ?? '');
        if (Number.isNaN(n)) return `Plafond ${c} : nombre invalide.`;
        out[c] = n;
      }
      return out;
    };
    const perPayment = toMap(maxPay);
    const perDay = toMap(maxDay);
    if (typeof perPayment === 'string') return setError(perPayment);
    if (typeof perDay === 'string') return setError(perDay);
    const intIn = (raw: string, label: string, min: number, max: number): number | string => {
      const n = Number(raw.trim());
      if (!Number.isInteger(n) || n < min || n > max) return `${label} : entier entre ${min} et ${max}.`;
      return n;
    };
    const maxPerClient = intIn(recMax, 'Paiements programmés par client', 1, 50);
    const remindDaysBefore = intIn(recRemind, 'Jours de rappel avant l’échéance', 0, 14);
    const maxFailures = intIn(recFailures, 'Échecs avant pause', 1, 10);
    for (const v of [maxPerClient, remindDaysBefore, maxFailures]) if (typeof v === 'string') return setError(v);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api.companySettings.update({
        // null = revenir à la valeur par défaut de la plateforme pour cette devise.
        bills: {
          enabled,
          refundFeeOnFailure: refundFee,
          maxPerPayment: perPayment as Record<string, number>,
          maxPerDay: perDay as Record<string, number>,
          recurring: {
            enabled: recEnabled,
            autoDebitEnabled: recAuto,
            maxPerClient: maxPerClient as number,
            remindDaysBefore: remindDaysBefore as number,
            maxFailures: maxFailures as number,
          },
        },
      });
      onSaved(next);
      setSaved(true);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bl-settings">
      <h2 className="bl-h2">Paiement de factures</h2>
      <SwitchRow
        checked={enabled}
        onChange={setEnabled}
        label={enabled ? 'Ouvert à vos clients' : 'Fermé'}
        hint={enabled ? 'Vos clients voient « Payer mes factures » dans l’application et les facturiers « Ouverts ».' : 'Rien n’est visible dans l’application tant que c’est fermé.'}
      />
      <SwitchRow
        checked={refundFee}
        onChange={setRefundFee}
        label="Rendre les frais si la facture n’est pas réglée"
        hint="Facture refusée : le client récupère le montant ET les frais (sinon, seulement le montant)."
      />
      <details className="bl-limits">
        <summary>Paiements programmés (loyer, abonnements…)</summary>
        <div className="bl-limits__grid">
          <SwitchRow
            checked={recEnabled}
            onChange={setRecEnabled}
            label={recEnabled ? 'Programmation autorisée' : 'Programmation fermée'}
            hint="Le client peut programmer une facture qui revient (hebdomadaire, mensuelle, trimestrielle, annuelle) avec un rappel avant chaque échéance."
          />
          <SwitchRow
            checked={recAuto}
            onChange={setRecAuto}
            label={recAuto ? 'Prélèvement automatique autorisé' : 'Rappel seulement (le client paie lui-même)'}
            hint="Fermé par défaut. Si ouvert, le client peut autoriser le débit de son portefeuille à chaque échéance (identité vérifiée et code PIN exigés). À valider avec votre conseil juridique."
          />
          <div className="bl-limits__row">
            <Field id="bl-rec-max" label="Paiements programmés par client (1–50)" inputMode="numeric" value={recMax} onChange={(e) => setRecMax(e.target.value)} />
            <Field id="bl-rec-remind" label="Rappel (jours avant, 0–14)" inputMode="numeric" value={recRemind} onChange={(e) => setRecRemind(e.target.value)} />
            <Field id="bl-rec-fail" label="Échecs avant pause (1–10)" inputMode="numeric" value={recFailures} onChange={(e) => setRecFailures(e.target.value)} />
          </div>
        </div>
      </details>
      <details className="bl-limits">
        <summary>Plafonds par devise du facturier</summary>
        <div className="bl-limits__grid">
          {currencies.map((c) => (
            <div key={c} className="bl-limits__row">
              <strong>{c}</strong>
              <Field id={`bl-pay-${c}`} label="Facture maximum" inputMode="decimal" value={maxPay[c] ?? ''} onChange={(e) => setMaxPay({ ...maxPay, [c]: e.target.value })} />
              <Field id={`bl-day-${c}`} label="Maximum par client et par jour" inputMode="decimal" value={maxDay[c] ?? ''} onChange={(e) => setMaxDay({ ...maxDay, [c]: e.target.value })} />
            </div>
          ))}
        </div>
      </details>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="ok" title="Réglages enregistrés" /> : null}
      <div className="bl-actions">
        <Button busy={busy} onClick={() => void save()}>Enregistrer</Button>
      </div>
      <p className="muted bl-note">
        L’argent payé par vos clients est crédité sur le portefeuille de votre société : gardez-le approvisionné pour pouvoir rembourser une facture refusée.
      </p>
    </Card>
  );
}

// ─── Formulaire d'un facturier ───
interface FieldRow {
  key: string;
  label: string;
  type: BillFieldType;
  required: boolean;
  options: string;
  pattern: string;
}

interface FormState {
  name: string;
  category: string;
  customCategory: string;
  country: string;
  currency: string;
  description: string;
  status: BillerStatus;
  connectorKey: string;
  referenceLabel: string;
  referenceHint: string;
  referencePattern: string;
  amountMode: BillAmountMode;
  minAmount: string;
  maxAmount: string;
  feeFixed: string;
  feePct: string;
  partnershipStatus: BillPartnership;
  settlementInfo: string;
  settlementDelayHours: string;
  internalNote: string;
  sortOrder: string;
  fields: FieldRow[];
}

const CUSTOM = '__custom__';

function emptyForm(currency: string): FormState {
  return {
    name: '', category: 'ELECTRICITY', customCategory: '', country: '', currency, description: '', status: 'DRAFT', connectorKey: 'manual',
    referenceLabel: 'Numéro de facture', referenceHint: '', referencePattern: '', amountMode: 'FREE', minAmount: '', maxAmount: '', feeFixed: '0', feePct: '0',
    partnershipStatus: 'NONE', settlementInfo: '', settlementDelayHours: '24', internalNote: '', sortOrder: '0', fields: [],
  };
}

function formOf(b: BillerAdmin): FormState {
  const known = b.category in BILL_CATEGORY_LABEL;
  return {
    name: b.name, category: known ? b.category : CUSTOM, customCategory: known ? '' : b.category, country: b.country ?? '', currency: b.currency,
    description: b.description ?? '', status: b.status, connectorKey: b.connectorKey, referenceLabel: b.referenceLabel, referenceHint: b.referenceHint ?? '',
    referencePattern: b.referencePattern ?? '', amountMode: b.amountMode, minAmount: b.minAmount === null ? '' : String(b.minAmount),
    maxAmount: b.maxAmount === null ? '' : String(b.maxAmount), feeFixed: String(b.feeFixed), feePct: String(b.feePct), partnershipStatus: b.partnershipStatus,
    settlementInfo: b.settlementInfo ?? '', settlementDelayHours: String(b.settlementDelayHours), internalNote: b.internalNote ?? '', sortOrder: String(b.sortOrder),
    fields: (b.fields ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, options: (f.options ?? []).join(', '), pattern: f.pattern ?? '' })),
  };
}

/** Formulaire → données du serveur, ou les erreurs de saisie (le serveur revérifie tout). */
function toInput(f: FormState): { input?: BillerInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const category = f.category === CUSTOM ? f.customCategory.trim().toUpperCase().replace(/[\s-]+/g, '_') : f.category;
  if (f.name.trim().length < 2) errors.name = 'Saisissez le nom du facturier.';
  if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(category)) errors.category = 'Catégorie : lettres, chiffres et « _ » (2 à 40 caractères).';
  if (f.country.trim() && !/^[A-Za-z]{2}$/.test(f.country.trim())) errors.country = 'Code pays à 2 lettres (ex. GN).';
  const num = (key: string, text: string, label: string, opts: { min?: number; max?: number } = {}) => {
    const n = readNumber(text);
    if (Number.isNaN(n)) errors[key] = `${label} : nombre invalide.`;
    else if (n !== null && opts.min !== undefined && n < opts.min) errors[key] = `${label} : ${opts.min} au minimum.`;
    else if (n !== null && opts.max !== undefined && n > opts.max) errors[key] = `${label} : ${opts.max} au maximum.`;
    return n;
  };
  const minAmount = num('minAmount', f.minAmount, 'Montant minimum', { min: 0 });
  const maxAmount = num('maxAmount', f.maxAmount, 'Montant maximum', { min: 0 });
  if (minAmount !== null && maxAmount !== null && !Number.isNaN(minAmount) && !Number.isNaN(maxAmount) && minAmount > maxAmount) errors.maxAmount = 'Le maximum est inférieur au minimum.';
  const feeFixed = num('feeFixed', f.feeFixed, 'Frais fixes', { min: 0 });
  const feePct = num('feePct', f.feePct, 'Frais en %', { min: 0, max: 50 });
  const delay = num('settlementDelayHours', f.settlementDelayHours, 'Délai de règlement', { min: 1, max: 720 });
  const sort = num('sortOrder', f.sortOrder, 'Ordre', { min: 0, max: 9999 });
  if (f.referencePattern.trim()) {
    try { new RegExp(f.referencePattern.trim()); } catch { errors.referencePattern = 'Format invalide.'; }
  }
  const fields: BillFieldDef[] = [];
  f.fields.forEach((row, i) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,29}$/.test(row.key.trim())) errors[`field${i}`] = `Champ ${i + 1} : identifiant invalide (lettres, chiffres, « _ »).`;
    else if (!row.label.trim()) errors[`field${i}`] = `Champ ${i + 1} : intitulé requis.`;
    const options = row.options.split(',').map((o) => o.trim()).filter(Boolean);
    if (row.type === 'select' && options.length < 2) errors[`field${i}`] = `Champ ${i + 1} : au moins 2 choix séparés par des virgules.`;
    const def: BillFieldDef = { key: row.key.trim(), label: row.label.trim(), type: row.type, required: row.required };
    if (row.pattern.trim()) def.pattern = row.pattern.trim();
    if (row.type === 'select') def.options = options;
    fields.push(def);
  });
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: {
      name: f.name.trim(),
      category,
      country: f.country.trim() ? f.country.trim().toUpperCase() : null,
      currency: f.currency,
      description: f.description.trim() || null,
      status: f.status,
      connectorKey: f.connectorKey,
      referenceLabel: f.referenceLabel.trim() || 'Numéro de facture',
      referenceHint: f.referenceHint.trim() || null,
      referencePattern: f.referencePattern.trim() || null,
      fields,
      amountMode: f.amountMode,
      minAmount,
      maxAmount,
      feeFixed: feeFixed ?? 0,
      feePct: feePct ?? 0,
      partnershipStatus: f.partnershipStatus,
      settlementInfo: f.settlementInfo.trim() || null,
      settlementDelayHours: delay ?? 24,
      internalNote: f.internalNote.trim() || null,
      sortOrder: sort ?? 0,
    },
  };
}

function BillerDialog({
  biller, currencies, connectors, onClose, onDone,
}: {
  biller: BillerAdmin | null;
  currencies: string[];
  connectors: Array<{ key: string; label: string; automatic: boolean; lookup: boolean }>;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => (biller ? formOf(biller) : emptyForm(currencies[0] ?? 'XOF')));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, run } = useDialogAction(onDone);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const canLookup = !!connectors.find((c) => c.key === form.connectorKey)?.lookup;
  const setRow = (i: number, patch: Partial<FieldRow>) => setForm((f) => ({ ...f, fields: f.fields.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const categories = [...Object.entries(BILL_CATEGORY_LABEL).map(([value, label]) => ({ value, label })), { value: CUSTOM, label: 'Autre (saisir un code)…' }];

  return (
    <ConfirmDialog
      open
      title={biller ? `Modifier ${biller.name}` : 'Ajouter un facturier'}
      confirmLabel="Enregistrer"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        const r = toInput(form);
        setErrors(r.errors);
        const input = r.input;
        if (!input) return;
        void run(async () => {
          if (biller) await api.bills.updateBiller(biller.id, input);
          else await api.bills.createBiller(input);
          return biller ? 'Facturier modifié.' : 'Facturier ajouté. Passez-le en « Ouvert aux clients » quand votre accord est prêt.';
        });
      }}
    >
      <div className="dialog-form bl-form">
        <Field id="bl-name" label="Nom du facturier" value={form.name} maxLength={80} error={errors.name} onChange={(e) => set('name', e.target.value)} />
        <SelectField id="bl-cat" label="Catégorie" value={form.category} options={categories} error={errors.category} onChange={(e) => set('category', e.target.value)} />
        {form.category === CUSTOM ? (
          <Field id="bl-cat2" label="Code de la catégorie" hint="Ex. FRAIS_CRECHE (majuscules, chiffres, « _ »)" value={form.customCategory} maxLength={40} onChange={(e) => set('customCategory', e.target.value)} />
        ) : null}
        <div className="bl-row">
          <SelectField id="bl-cur" label="Devise du facturier" value={form.currency} options={currencies.map((c) => ({ value: c, label: c }))} onChange={(e) => set('currency', e.target.value)} />
          <Field id="bl-country" label="Pays (facultatif)" hint="2 lettres, ex. GN" value={form.country} maxLength={2} error={errors.country} onChange={(e) => set('country', e.target.value)} />
        </div>
        <TextAreaField id="bl-desc" label="Description (vue par les clients)" value={form.description} maxLength={400} onChange={(e) => set('description', e.target.value)} />

        <h3 className="bl-h3">Ce que le client saisit</h3>
        <Field id="bl-ref" label="Intitulé du numéro" hint="Ex. N° de compteur, Matricule de l’élève, Police d’assurance" value={form.referenceLabel} maxLength={60} onChange={(e) => set('referenceLabel', e.target.value)} />
        <Field id="bl-refhint" label="Aide sous le champ (facultatif)" value={form.referenceHint} maxLength={160} onChange={(e) => set('referenceHint', e.target.value)} />
        <Field id="bl-refpat" label="Format attendu (expression régulière, facultatif)" hint="Ex. ^\d{10}$ pour 10 chiffres" value={form.referencePattern} maxLength={120} error={errors.referencePattern} onChange={(e) => set('referencePattern', e.target.value)} />

        <div className="bl-fields">
          <div className="bl-fields__head">
            <strong>Champs supplémentaires</strong>
            <Button variant="secondary" icon="plus" onClick={() => setForm((f) => (f.fields.length >= 8 ? f : { ...f, fields: [...f.fields, { key: '', label: '', type: 'text', required: true, options: '', pattern: '' }] }))}>Ajouter</Button>
          </div>
          {form.fields.map((row, i) => (
            <div key={i} className="bl-field">
              <div className="bl-row">
                <Field id={`bl-fk-${i}`} label="Identifiant" value={row.key} maxLength={30} onChange={(e) => setRow(i, { key: e.target.value })} />
                <Field id={`bl-fl-${i}`} label="Intitulé" value={row.label} maxLength={60} onChange={(e) => setRow(i, { label: e.target.value })} />
              </div>
              <div className="bl-row">
                <SelectField id={`bl-ft-${i}`} label="Type" value={row.type} options={[{ value: 'text', label: 'Texte' }, { value: 'number', label: 'Nombre' }, { value: 'select', label: 'Choix dans une liste' }]} onChange={(e) => setRow(i, { type: e.target.value as BillFieldType })} />
                <SwitchRow checked={row.required} onChange={(v) => setRow(i, { required: v })} label="Obligatoire" />
              </div>
              {row.type === 'select' ? <Field id={`bl-fo-${i}`} label="Choix (séparés par des virgules)" value={row.options} onChange={(e) => setRow(i, { options: e.target.value })} /> : null}
              {row.type !== 'select' ? <Field id={`bl-fp-${i}`} label="Format (facultatif)" value={row.pattern} maxLength={120} onChange={(e) => setRow(i, { pattern: e.target.value })} /> : null}
              {errors[`field${i}`] ? <p className="field__error">{errors[`field${i}`]}</p> : null}
              <Button variant="ghost" icon="trash" onClick={() => setForm((f) => ({ ...f, fields: f.fields.filter((_, j) => j !== i) }))}>Retirer ce champ</Button>
            </div>
          ))}
        </div>

        <h3 className="bl-h3">Montant et frais</h3>
        <SelectField
          id="bl-mode"
          label="Montant"
          value={form.amountMode}
          options={(Object.keys(BILL_AMOUNT_MODE_LABEL) as BillAmountMode[]).filter((k) => k === 'FREE' || canLookup).map((k) => ({ value: k, label: BILL_AMOUNT_MODE_LABEL[k] }))}
          hint={canLookup ? 'Avec « montant fourni par le facturier », le client saisit son numéro et le montant s\'affiche automatiquement.' : 'Ce mode de règlement ne permet pas d\'interroger la facture à l\'avance : le client saisit lui-même le montant. Le montant automatique demande une connexion API avec le facturier.'}
          onChange={(e) => set('amountMode', e.target.value as BillAmountMode)}
        />
        <div className="bl-row">
          <Field id="bl-min" label="Minimum" inputMode="decimal" value={form.minAmount} error={errors.minAmount} onChange={(e) => set('minAmount', e.target.value)} />
          <Field id="bl-max" label="Maximum" inputMode="decimal" value={form.maxAmount} error={errors.maxAmount} onChange={(e) => set('maxAmount', e.target.value)} />
        </div>
        <div className="bl-row">
          <Field id="bl-ff" label="Frais fixes (payés par le client en plus)" inputMode="decimal" value={form.feeFixed} error={errors.feeFixed} onChange={(e) => set('feeFixed', e.target.value)} />
          <Field id="bl-fp" label="Frais en %" inputMode="decimal" value={form.feePct} error={errors.feePct} onChange={(e) => set('feePct', e.target.value)} />
        </div>

        <h3 className="bl-h3">Règlement et partenariat</h3>
        <SelectField id="bl-conn" label="Mode de règlement" value={form.connectorKey} options={connectors.map((c) => ({ value: c.key, label: c.label }))} onChange={(e) => {
          const key = e.target.value;
          // Un connecteur qui ne sait pas interroger la facture ne peut pas fournir le montant : retour au montant libre.
          setForm((f) => ({ ...f, connectorKey: key, amountMode: connectors.find((c) => c.key === key)?.lookup ? f.amountMode : 'FREE' }));
        }} />
        <Field id="bl-delay" label="Délai de règlement annoncé au client (heures)" inputMode="numeric" value={form.settlementDelayHours} error={errors.settlementDelayHours} onChange={(e) => set('settlementDelayHours', e.target.value)} />
        <SelectField id="bl-part" label="Partenariat" value={form.partnershipStatus} options={(Object.keys(BILL_PARTNERSHIP_LABEL) as BillPartnership[]).map((k) => ({ value: k, label: BILL_PARTNERSHIP_LABEL[k] }))} onChange={(e) => set('partnershipStatus', e.target.value as BillPartnership)} />
        <TextAreaField id="bl-settle" label="Coordonnées de règlement (jamais vues des clients)" hint="Compte à créditer, référence de convention, contact du facturier…" value={form.settlementInfo} maxLength={600} onChange={(e) => set('settlementInfo', e.target.value)} />
        <TextAreaField id="bl-note" label="Note interne (jamais vue des clients)" value={form.internalNote} maxLength={600} onChange={(e) => set('internalNote', e.target.value)} />
        <div className="bl-row">
          <SelectField id="bl-status" label="Visibilité" value={form.status} options={(Object.keys(BILLER_STATUS_LABEL) as BillerStatus[]).map((k) => ({ value: k, label: BILLER_STATUS_LABEL[k] }))} onChange={(e) => set('status', e.target.value as BillerStatus)} />
          <Field id="bl-sort" label="Ordre d’affichage" inputMode="numeric" value={form.sortOrder} error={errors.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

function RemoveDialog({ biller, onClose, onDone }: { biller: BillerAdmin; onClose: () => void; onDone: (m: string) => void }) {
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title="Supprimer ce facturier ?"
      confirmLabel="Supprimer"
      tone="danger"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => void run(async () => { await api.bills.removeBiller(biller.id); return 'Facturier supprimé.'; })}
    >
      <div className="dialog-form">
        <p><strong>{biller.name}</strong> disparaît du catalogue. Impossible s’il a déjà reçu des paiements : suspendez-le alors.</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function BillersPage() {
  const [billers, setBillers] = useState<BillerAdmin[] | null>(null);
  const [view, setView] = useState<CompanySettingsView | null>(null);
  const [connectors, setConnectors] = useState<Array<{ key: string; label: string; automatic: boolean; lookup: boolean }>>([{ key: 'manual', label: 'Manuel (vous réglez puis confirmez)', automatic: false, lookup: false }]);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'edit'; biller: BillerAdmin | null } | { kind: 'remove'; biller: BillerAdmin } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, settings, meta] = await Promise.all([api.bills.billers(), api.companySettings.get(), api.bills.meta()]);
      setBillers(list);
      setView(settings);
      setConnectors(meta.connectors);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const done = (text: string) => {
    setDialog(null);
    setMessage(text);
    void load();
  };

  const toggle = async (b: BillerAdmin) => {
    setBusyId(b.id);
    try {
      await api.bills.updateBiller(b.id, { status: b.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
      setMessage(b.status === 'ACTIVE' ? `${b.name} est suspendu : les clients ne le voient plus.` : `${b.name} est ouvert à vos clients.`);
      await load();
    } catch (err) {
      setMessage(describeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const currencies = useMemo(() => view?.options.currencies ?? ['XOF', 'GNF', 'EUR'], [view]);

  return (
    <>
      <PageHeader
        title="Factures — facturiers"
        description="Les services que vos clients paient depuis l’application : électricité, eau, assurance, scolarité, loyer… Chaque facturier est un partenaire que vous négociez et réglez."
        actions={
          <>
            <Link to="/bills/payments" className="btn btn--secondary">
              <Icon name="list" size={18} />
              <span>Factures à régler</span>
            </Link>
            <Button icon="plus" onClick={() => setDialog({ kind: 'edit', biller: null })}>Ajouter</Button>
          </>
        }
      />
      {message ? (
        <div className="stack stack--tight">
          <Notice tone="ok" title={message} action={<button type="button" className="link-btn" onClick={() => setMessage(null)}>Fermer</button>} />
        </div>
      ) : null}

      {view ? <BillSettingsCard key={view.updatedAt ?? 'init'} view={view} onSaved={setView} /> : null}

      {!billers && !error ? (
        <div className="center-block"><Spinner label="Chargement des facturiers" /></div>
      ) : error && !billers ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les facturiers" action={<button type="button" className="link-btn" onClick={() => void load()}>Réessayer</button>}>
            {describeError(error).message}
          </Notice>
        </Card>
      ) : billers && billers.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon"><Icon name="file" size={26} /></span>
          <h2>Aucun facturier</h2>
          <p>Ajoutez votre premier facturier (même sans accord signé : il reste invisible tant que vous ne l’ouvrez pas).</p>
          <Button icon="plus" onClick={() => setDialog({ kind: 'edit', biller: null })}>Ajouter un facturier</Button>
        </Card>
      ) : (
        <ul className="mc-grid">
          {(billers ?? []).map((b) => (
            <li key={b.id} className="bl-card">
              <div className="bl-card__head">
                <div className="bl-card__who">
                  <strong>{b.name}</strong>
                  <span className="muted">{categoryName(b.category, BILL_CATEGORY_LABEL)}{b.country ? ` · ${b.country}` : ''} · {b.currency}</span>
                </div>
                <Pill tone={BILLER_TONE[b.status]}>{BILLER_STATUS_LABEL[b.status]}</Pill>
              </div>
              <div className="bl-card__pills">
                <Pill tone={PARTNERSHIP_TONE[b.partnershipStatus]}>{BILL_PARTNERSHIP_LABEL[b.partnershipStatus]}</Pill>
                <Pill tone="neutral">{connectors.find((c) => c.key === b.connectorKey)?.label.split(' (')[0] ?? b.connectorKey}</Pill>
                {b.openPayments ? <Pill tone="warn">{b.openPayments} à régler</Pill> : null}
              </div>
              <dl className="kv kv--compact">
                <div className="kv__row"><dt>Frais</dt><dd>{b.feeFixed > 0 ? formatAmount(b.feeFixed, b.currency) : ''}{b.feeFixed > 0 && b.feePct > 0 ? ' + ' : ''}{b.feePct > 0 ? `${b.feePct} %` : ''}{b.feeFixed <= 0 && b.feePct <= 0 ? 'Aucun' : ''}</dd></div>
                <div className="kv__row"><dt>Montant</dt><dd>{BILL_AMOUNT_MODE_LABEL[b.amountMode]}</dd></div>
                <div className="kv__row"><dt>Délai annoncé</dt><dd>{b.settlementDelayHours} h</dd></div>
                {b.settlementInfo ? <div className="kv__row"><dt>Règlement</dt><dd className="mc-break">{b.settlementInfo}</dd></div> : null}
                {b.internalNote ? <div className="kv__row"><dt>Note</dt><dd className="mc-break">{b.internalNote}</dd></div> : null}
              </dl>
              <div className="mc-actions">
                <Button variant="secondary" icon="pen" onClick={() => setDialog({ kind: 'edit', biller: b })}>Modifier</Button>
                <Button variant="secondary" busy={busyId === b.id} onClick={() => void toggle(b)}>{b.status === 'ACTIVE' ? 'Suspendre' : 'Ouvrir aux clients'}</Button>
                <Button variant="ghost" icon="trash" onClick={() => setDialog({ kind: 'remove', biller: b })}>Supprimer</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'edit' ? <BillerDialog biller={dialog.biller} currencies={currencies} connectors={connectors} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog?.kind === 'remove' ? <RemoveDialog biller={dialog.biller} onClose={() => setDialog(null)} onDone={done} /> : null}
    </>
  );
}
