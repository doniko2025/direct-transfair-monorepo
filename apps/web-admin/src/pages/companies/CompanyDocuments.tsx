// src/pages/companies/CompanyDocuments.tsx
// Documents légaux d'une société (super admin) : RCCM, pièce d'identité du représentant, statuts, agrément…
// Consultation (aperçu image / PDF), téléchargement, ajout et suppression. Les fichiers sont lus avec le jeton du super admin.

import { useState } from 'react';
import {
  COMPANY_DOC_KINDS,
  COMPANY_DOC_LABEL,
  type CompanyDocKind,
  type CompanyDocument,
} from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { DocumentPicker, formatSize, type PickedDocument } from '../../components/DocumentPicker';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Button, Card, Field, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { saveBlob } from '../../lib/contractRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import { KycFileView } from '../kyc/KycFileView';

const KIND_OPTIONS = COMPANY_DOC_KINDS.map((k) => ({ value: k, label: COMPANY_DOC_LABEL[k] }));
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

function fileName(d: CompanyDocument): string {
  const base = (d.label || d.kindLabel)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'document'}.${EXT[d.mimeType] ?? 'bin'}`;
}

export function CompanyDocuments({ companyId }: { companyId: number }) {
  const docs = useResource(() => api.companies.documents(companyId), [companyId]);
  const [kind, setKind] = useState<CompanyDocKind>('RCCM');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CompanyDocument | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const list = docs.data?.documents ?? [];

  async function add() {
    if (!file) {
      setError('Choisissez un fichier.');
      return;
    }
    if (kind === 'OTHER' && !label.trim()) {
      setError('Indiquez le nom du document.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await api.companies.addDocument(companyId, { kind, ...(label.trim() ? { label: label.trim() } : {}), file: file.dataUrl });
      setFile(null);
      setLabel('');
      setFlash('Document ajouté.');
      docs.reload();
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setAdding(false);
    }
  }

  async function download(d: CompanyDocument) {
    try {
      saveBlob(await api.companies.documentFile(companyId, d.id), fileName(d));
    } catch (err) {
      setError(describeError(err).message);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await api.companies.removeDocument(companyId, removing.id);
      if (viewing === removing.id) setViewing(null);
      setRemoving(null);
      setFlash('Document supprimé.');
      docs.reload();
    } catch (err) {
      setError(describeError(err).message);
      setRemoving(null);
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <Card as="section" aria-labelledby="docs-title" className="section-card">
      <header className="section-card__head">
        <span className="section-card__icon">
          <Icon name="file" size={20} />
        </span>
        <div className="section-card__title">
          <h2 id="docs-title">Documents légaux</h2>
          <p>RCCM, pièce d’identité du représentant, statuts, agrément… Visibles par le super administrateur uniquement.</p>
        </div>
      </header>

      {flash ? (
        <Notice
          tone="ok"
          title={flash}
          action={
            <button type="button" className="link-btn" onClick={() => setFlash(null)}>
              Fermer
            </button>
          }
        />
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {docs.loading && !docs.data ? (
        <div className="center-block center-block--sm">
          <Spinner label="Chargement des documents" />
        </div>
      ) : docs.error && !docs.data ? (
        <Notice
          tone="error"
          title="Impossible de charger les documents"
          action={
            <button type="button" className="link-btn" onClick={docs.reload}>
              Réessayer
            </button>
          }
        >
          {describeError(docs.error).message}
        </Notice>
      ) : list.length === 0 ? (
        <p className="muted">Aucun document fourni pour le moment.</p>
      ) : (
        <ul className="doc-list">
          {list.map((d) => (
            <li key={d.id} className="doc-item">
              <div className="doc-item__head">
                <div className="doc-item__main">
                  <strong>{d.label || d.kindLabel}</strong>
                  <span className="muted">
                    {d.label ? `${d.kindLabel} · ` : ''}
                    {d.mimeType === 'application/pdf' ? 'PDF' : 'Photo'} · {formatSize(d.sizeBytes)} · ajouté le{' '}
                    {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <Pill tone={d.kind === 'RCCM' ? 'brand' : 'neutral'}>{d.kind === 'RCCM' ? 'RCCM' : 'Document'}</Pill>
                <div className="doc-item__actions">
                  <Button variant="secondary" icon="eye" onClick={() => setViewing(viewing === d.id ? null : d.id)}>
                    {viewing === d.id ? 'Masquer' : 'Voir'}
                  </Button>
                  <Button variant="secondary" icon="download" onClick={() => void download(d)}>
                    Télécharger
                  </Button>
                  <Button variant="ghost" icon="trash" onClick={() => setRemoving(d)}>
                    Supprimer
                  </Button>
                </div>
              </div>
              {viewing === d.id ? (
                <KycFileView
                  documentId={d.id}
                  kind="front"
                  label={d.label || d.kindLabel}
                  load={() => api.companies.documentFile(companyId, d.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="form-grid">
        <SelectField
          id="doc-kind"
          className="form-grid__half"
          label="Type de document"
          value={kind}
          onChange={(e) => setKind(e.target.value as CompanyDocKind)}
          options={KIND_OPTIONS}
        />
        <Field
          id="doc-label"
          className="form-grid__half"
          label={kind === 'OTHER' ? 'Nom du document' : 'Précision (facultatif)'}
          value={label}
          maxLength={120}
          onChange={(e) => setLabel(e.target.value)}
          autoComplete="off"
        />
        <div className="form-grid__wide">
          <DocumentPicker
            id="doc-file"
            label="Fichier"
            hint="Photo (JPEG, PNG, WebP) ou PDF, 6 Mo au maximum."
            value={file}
            onChange={setFile}
          />
        </div>
      </div>
      <div className="form-actions form-actions--start">
        <Button icon="plus" busy={adding} onClick={() => void add()}>
          Ajouter le document
        </Button>
      </div>

      <ConfirmDialog
        open={removing !== null}
        title="Supprimer ce document ?"
        confirmLabel="Supprimer"
        tone="danger"
        busy={removeBusy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      >
        {removing ? `« ${removing.label || removing.kindLabel} » sera supprimé définitivement. La suppression est inscrite au journal d’audit.` : null}
      </ConfirmDialog>
    </Card>
  );
}
