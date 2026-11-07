// src/pages/kyc/KycFileView.tsx
// Affiche une pièce du dossier. Le fichier est demandé avec le jeton de l'administrateur (une balise <img> ne sait pas
// l'envoyer), transformé en URL locale, et libéré au démontage. Image : miniature + plein écran avec zoom et rotation.
// PDF : ouverture dans un nouvel onglet.

import { useEffect, useRef, useState } from 'react';
import type { KycFileKind } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';

interface Props {
  /** Identifiant de la pièce, ou du client de passage quand source = 'counter'. */
  documentId: string;
  kind: KycFileKind;
  label: string;
  /** 'counter' : photo de la pièce d'un client de passage prise au comptoir (consultation journalisée côté serveur). */
  source?: 'document' | 'counter';
}

interface Loaded {
  url: string;
  isPdf: boolean;
}

function Lightbox({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="kyc-lightbox"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="kyc-lightbox__bar">
        <strong>{label}</strong>
        <div className="kyc-lightbox__tools">
          <button type="button" className="icon-btn" aria-label="Zoom arrière" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
            <span aria-hidden="true">−</span>
          </button>
          <button type="button" className="kyc-lightbox__zoom" onClick={() => setZoom(1)} aria-label="Réinitialiser le zoom">
            {Math.round(zoom * 100)} %
          </button>
          <button type="button" className="icon-btn" aria-label="Zoom avant" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>
            <Icon name="plus" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Pivoter" onClick={() => setTurn((t) => (t + 90) % 360)}>
            <Icon name="refresh" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
      </div>
      <div className="kyc-lightbox__stage">
        <img
          src={url}
          alt={label}
          style={{ transform: `rotate(${turn}deg) scale(${zoom})`, maxWidth: zoom === 1 && turn % 180 === 0 ? '100%' : 'none' }}
        />
      </div>
    </dialog>
  );
}

export function KycFileView({ documentId, kind, label, source = 'document' }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setLoaded(null);
    setError(null);
    (source === 'counter' ? api.kyc.fetchCounterFile(documentId, kind) : api.kyc.fetchFile(documentId, kind))
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setLoaded({ url: created, isPdf: blob.type === 'application/pdf' });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err).message);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [documentId, kind, source, tick]);

  if (error) {
    return (
      <div className="kyc-file kyc-file--state" role="alert">
        <Icon name="alert" size={22} />
        <p>{error}</p>
        <Button variant="secondary" onClick={() => setTick((t) => t + 1)}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="kyc-file kyc-file--state">
        <Spinner label={`Chargement : ${label}`} />
      </div>
    );
  }

  if (loaded.isPdf) {
    return (
      <div className="kyc-file kyc-file--state">
        <Icon name="file" size={28} />
        <p>{label} (PDF)</p>
        <a className="btn btn--secondary" href={loaded.url} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={18} />
          <span>Ouvrir le PDF</span>
        </a>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="kyc-file kyc-file--image" onClick={() => setOpen(true)} aria-label={`Agrandir : ${label}`}>
        <img src={loaded.url} alt={label} />
        <span className="kyc-file__zoom">
          <Icon name="search" size={16} /> Agrandir
        </span>
      </button>
      {open ? <Lightbox url={loaded.url} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
