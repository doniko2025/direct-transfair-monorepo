// apps/web-admin/src/pages/bills/BillReconcilePage.tsx
// Rapprochement (lot 14b) : l'administrateur de la société colle ou charge le relevé CSV d'un facturier,
// la page le compare aux factures réglées et liste les écarts (montant différent, absent chez le facturier, inconnu chez nous, doublon).
//   • rien n'est conservé côté serveur : le fichier est analysé puis oublié ;
//   • si les colonnes ne sont pas reconnues, l'administrateur les choisit puis relance ;
//   • mise en page en cartes (pas de tableau) : lisible sur téléphone comme sur grand écran.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BILL_RECONCILE_KIND_LABEL,
  type BillColumnMapping,
  type BillerAdmin,
  type BillReconcileInput,
  type BillReconcileKind,
  type BillReconcileNeedsMapping,
  type BillReconcileReport,
  type BillReconcileRow,
} from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SelectField, TextAreaField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { saveBlob } from '../../lib/contractRules';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

const KIND_TONE: Record<BillReconcileKind, Tone> = {
  MATCHED: 'ok',
  AMOUNT_MISMATCH: 'warn',
  MISSING_AT_BILLER: 'danger',
  UNKNOWN_AT_BILLER: 'danger',
  DUPLICATE_LINE: 'warn',
};

/** Ordre d'affichage : les écarts d'abord, les lignes concordantes en dernier. */
const KIND_ORDER: BillReconcileKind[] = ['AMOUNT_MISMATCH', 'MISSING_AT_BILLER', 'UNKNOWN_AT_BILLER', 'DUPLICATE_LINE', 'MATCHED'];

const KIND_HELP: Record<BillReconcileKind, string> = {
  MATCHED: 'Même facture, même montant des deux côtés.',
  AMOUNT_MISMATCH: 'Retrouvée des deux côtés, mais le montant n’est pas le même : à vérifier avec le facturier.',
  MISSING_AT_BILLER: 'Réglée chez vous, absente du relevé : le facturier ne l’a peut-être pas reçue.',
  UNKNOWN_AT_BILLER: 'Sur le relevé, mais aucune facture correspondante chez vous.',
  DUPLICATE_LINE: 'La même ligne apparaît plusieurs fois dans le relevé.',
};

const DELIMITERS: { value: string; label: string }[] = [
  { value: '', label: 'Automatique' },
  { value: ';', label: 'Point-virgule ( ; )' },
  { value: ',', label: 'Virgule ( , )' },
  { value: '\t', label: 'Tabulation' },
  { value: '|', label: 'Barre verticale ( | )' },
];

const MAX_FILE_BYTES = 2_500_000; // le serveur accepte 3 Mo de JSON : on garde de la marge

function RowCard({ row, currency }: { row: BillReconcileRow; currency: string }) {
  const money = (n: number | null) => (n === null ? '—' : formatAmount(n, currency));
  return (
    <li className={`bl-rc-row bl-rc-row--${KIND_TONE[row.kind]}`}>
      <div className="bl-rc-row__head">
        <Pill tone={KIND_TONE[row.kind]}>{BILL_RECONCILE_KIND_LABEL[row.kind]}</Pill>
        {row.line !== null ? <span className="muted">ligne {row.line}</span> : <span className="muted">chez nous seulement</span>}
        {row.diff !== null && row.diff !== 0 ? <strong className="bl-rc-row__diff">écart {money(row.diff)}</strong> : null}
      </div>
      <dl className="bl-rc-row__body">
        <div>
          <dt>Relevé du facturier</dt>
          <dd>
            <strong>{money(row.fileAmount)}</strong>
            {row.fileRef ? <span>réf. {row.fileRef}</span> : null}
            {row.fileProviderRef ? <span>n° {row.fileProviderRef}</span> : null}
            {row.fileDate ? <span>{row.fileDate}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Nos paiements</dt>
          <dd>
            <strong>{money(row.paymentAmount)}</strong>
            {row.paymentReference ? <span>reçu {row.paymentReference}</span> : null}
            {row.paymentAccountRef ? <span>compte {row.paymentAccountRef}</span> : null}
            {row.paymentProviderRef ? <span>n° {row.paymentProviderRef}</span> : null}
          </dd>
        </div>
      </dl>
    </li>
  );
}

export default function BillReconcilePage() {
  const [billers, setBillers] = useState<BillerAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [billerId, setBillerId] = useState('');
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tolerance, setTolerance] = useState('');
  const [mapping, setMapping] = useState<BillColumnMapping | null>(null);
  const [needs, setNeeds] = useState<BillReconcileNeedsMapping | null>(null);
  const [report, setReport] = useState<BillReconcileReport | null>(null);
  const [filter, setFilter] = useState<BillReconcileKind | 'GAPS'>('GAPS');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.bills.billers().then(setBillers).catch((err) => { setBillers([]); setLoadError(describeError(err).message); });
  }, []);

  const biller = useMemo(() => billers?.find((b) => b.id === billerId) ?? null, [billers, billerId]);

  const buildInput = (withMapping: BillColumnMapping | null): BillReconcileInput | string => {
    if (!billerId) return 'Choisissez un facturier.';
    if (!csv.trim()) return 'Chargez le relevé du facturier (fichier CSV) ou collez son contenu.';
    const input: BillReconcileInput = { billerId, csv };
    if (delimiter) input.delimiter = delimiter as BillReconcileInput['delimiter'];
    if (from) input.from = from;
    if (to) input.to = to;
    if (from && to && from > to) return 'La date de début est après la date de fin.';
    if (tolerance.trim()) {
      const t = Number(tolerance.replace(',', '.'));
      if (!Number.isFinite(t) || t < 0) return 'Tolérance invalide (nombre positif).';
      input.tolerance = t;
    }
    if (withMapping) input.mapping = withMapping;
    return input;
  };

  const analyse = async (withMapping: BillColumnMapping | null) => {
    const input = buildInput(withMapping);
    if (typeof input === 'string') return setError(input);
    setBusy(true);
    setError(null);
    try {
      const res = await api.bills.reconcile(input);
      if (res.needsMapping) {
        setNeeds(res);
        setReport(null);
        setMapping((m) => m ?? { amount: '' });
      } else {
        setNeeds(null);
        setReport(res);
        setMapping(res.mapping);
        setFilter('GAPS');
      }
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const input = buildInput(mapping);
    if (typeof input === 'string') return setError(input);
    setExporting(true);
    setError(null);
    try {
      const blob = await api.bills.reconcileCsv(input);
      saveBlob(blob, `rapprochement-${(biller?.name ?? 'facturier').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setExporting(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('Fichier trop volumineux (2,5 Mo maximum, environ 5 000 lignes). Découpez-le par période.');
      return;
    }
    try {
      setCsv(await file.text());
      setFileName(file.name);
      setReport(null);
      setNeeds(null);
      setMapping(null);
      setError(null);
    } catch {
      setError('Impossible de lire ce fichier.');
    }
  };

  const currency = report?.biller.currency ?? needs?.biller.currency ?? biller?.currency ?? '';
  const gaps = report ? report.counts.AMOUNT_MISMATCH + report.counts.MISSING_AT_BILLER + report.counts.UNKNOWN_AT_BILLER + report.counts.DUPLICATE_LINE : 0;
  const visible = useMemo(() => {
    if (!report) return [];
    return report.rows
      .filter((r) => (filter === 'GAPS' ? r.kind !== 'MATCHED' : r.kind === filter))
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  }, [report, filter]);

  return (
    <>
      <PageHeader
        title="Rapprochement avec un facturier"
        description="Comparez le relevé que le facturier vous envoie à ce que vos clients ont payé. Le fichier est analysé puis oublié : rien n’est conservé."
        actions={
          <Link to="/bills/payments" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Factures à régler</span>
          </Link>
        }
      />

      {loadError ? <Notice tone="error">{loadError}</Notice> : null}

      <Card className="bl-rc-form">
        {billers === null ? (
          <Spinner />
        ) : (
          <>
            <SelectField
              id="bl-rc-biller"
              label="Facturier"
              value={billerId}
              placeholder="Choisir un facturier"
              options={billers.map((b) => ({ value: b.id, label: `${b.name} (${b.currency})` }))}
              onChange={(e) => { setBillerId(e.target.value); setReport(null); setNeeds(null); setMapping(null); }}
            />
            <div className="bl-rc-file">
              <input
                ref={picker}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                hidden
                onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }}
              />
              <Button variant="secondary" icon="file" onClick={() => picker.current?.click()}>Charger le relevé (CSV)</Button>
              <span className="muted">{fileName ?? 'ou collez son contenu ci-dessous'}</span>
            </div>
            <TextAreaField
              id="bl-rc-csv"
              label="Contenu du relevé"
              rows={5}
              value={csv}
              placeholder={'reference;montant;date\nFAC-001;25000;2026-11-02'}
              onChange={(e) => { setCsv(e.target.value); setFileName(null); setReport(null); setNeeds(null); }}
            />
            <details className="bl-limits">
              <summary>Options (séparateur, période, tolérance)</summary>
              <div className="bl-rc-options">
                <SelectField id="bl-rc-delim" label="Séparateur" value={delimiter} options={DELIMITERS} onChange={(e) => setDelimiter(e.target.value)} />
                <Field id="bl-rc-from" label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Field id="bl-rc-to" label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                <Field id="bl-rc-tol" label="Tolérance de montant" inputMode="decimal" value={tolerance} hint="Écart accepté (arrondis). Vide = montants exacts." onChange={(e) => setTolerance(e.target.value)} />
              </div>
            </details>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <div className="bl-actions">
              <Button icon="refresh" busy={busy} onClick={() => void analyse(needs ? mapping : null)}>Analyser</Button>
            </div>
          </>
        )}
      </Card>

      {needs ? (
        <Card className="bl-rc-map">
          <h2 className="bl-h2">Quelles colonnes utiliser ?</h2>
          <p className="muted">Les colonnes de {needs.biller.name} n’ont pas pu être reconnues automatiquement. Indiquez-les, puis relancez l’analyse.</p>
          <div className="bl-rc-options">
            {([
              ['amount', 'Montant (obligatoire)'],
              ['reference', 'Référence de la facture'],
              ['providerRef', 'Numéro de reçu du facturier'],
              ['date', 'Date'],
            ] as const).map(([key, label]) => (
              <SelectField
                key={key}
                id={`bl-rc-map-${key}`}
                label={label}
                value={(mapping?.[key] as string | null | undefined) ?? ''}
                placeholder={key === 'amount' ? 'Choisir' : 'Aucune'}
                options={needs.headers.map((h) => ({ value: h, label: h }))}
                onChange={(e) => setMapping({ ...(mapping ?? { amount: '' }), [key]: e.target.value || (key === 'amount' ? '' : null) })}
              />
            ))}
          </div>
          {needs.sample.length > 0 ? (
            <div className="bl-rc-sample" aria-label="Aperçu du fichier">
              <strong>Aperçu</strong>
              <ul>
                {needs.sample.slice(0, 3).map((line, i) => (
                  <li key={i}>{line.join('  ·  ')}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="bl-actions">
            <Button busy={busy} disabled={!mapping?.amount} onClick={() => void analyse(mapping)}>Relancer avec ces colonnes</Button>
          </div>
        </Card>
      ) : null}

      {report ? (
        <>
          <div className="bl-stats bl-rc-stats">
            <div className="bl-stat"><strong>{report.fileLines}</strong><span>lignes du relevé</span></div>
            <div className="bl-stat"><strong>{report.ourPayments}</strong><span>nos paiements ({report.period.from} → {report.period.to})</span></div>
            <div className="bl-stat"><strong>{report.counts.MATCHED}</strong><span>concordants</span></div>
            <div className={`bl-stat${gaps > 0 ? ' bl-stat--alert' : ''}`}><strong>{gaps}</strong><span>écart{gaps > 1 ? 's' : ''}</span></div>
          </div>

          {gaps === 0 ? (
            <Notice tone="ok" title="Tout concorde" action={undefined}>Le relevé de {report.biller.name} correspond à vos paiements sur cette période.</Notice>
          ) : (
            <Card tone="flat" className="bl-owed">
              <strong>Montants concernés</strong>
              <ul>
                <li><span>Concordants</span><strong>{formatAmount(report.totals.matched, currency)}</strong></li>
                <li><span>Montant différent</span><strong>{formatAmount(report.totals.amountMismatch, currency)}</strong></li>
                <li><span>Absents chez le facturier</span><strong>{formatAmount(report.totals.missingAtBiller, currency)}</strong></li>
                <li><span>Inconnus chez nous</span><strong>{formatAmount(report.totals.unknownAtBiller, currency)}</strong></li>
              </ul>
            </Card>
          )}

          {report.invalidAmountCount > 0 ? (
            <Notice tone="info" title={`${report.invalidAmountCount} ligne(s) ignorée(s) : montant illisible`}>
              Lignes : {report.invalidAmountLines.slice(0, 20).join(', ')}{report.invalidAmountCount > 20 ? '…' : ''}
            </Notice>
          ) : null}
          {report.truncated ? <Notice tone="info" title="Liste raccourcie">Seules les 500 premières lignes de chaque catégorie sont affichées ; les compteurs restent exacts. Réduisez la période pour tout voir.</Notice> : null}

          <div className="bl-rc-tabs" role="tablist" aria-label="Filtrer le rapprochement">
            {([['GAPS', `Écarts (${gaps})`], ...KIND_ORDER.map((k) => [k, `${BILL_RECONCILE_KIND_LABEL[k]} (${report.counts[k]})`])] as [string, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={`bl-rc-tab${filter === id ? ' is-active' : ''}`}
                onClick={() => setFilter(id as BillReconcileKind | 'GAPS')}
              >
                {label}
              </button>
            ))}
          </div>
          {filter !== 'GAPS' ? <p className="muted bl-rc-help">{KIND_HELP[filter]}</p> : null}

          {visible.length === 0 ? (
            <Card tone="flat" className="empty"><p>Rien à afficher dans cette catégorie.</p></Card>
          ) : (
            <ul className="bl-rc-list">
              {visible.map((row, i) => <RowCard key={`${row.kind}-${row.line ?? 'n'}-${row.paymentId ?? i}-${i}`} row={row} currency={currency} />)}
            </ul>
          )}

          <div className="bl-actions">
            <Button variant="secondary" icon="download" busy={exporting} onClick={() => void exportCsv()}>Exporter les écarts (CSV)</Button>
          </div>
        </>
      ) : null}
    </>
  );
}
