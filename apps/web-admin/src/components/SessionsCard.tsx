// src/components/SessionsCard.tsx
// v1.0 — Carte « Appareils connectés » de la page Mon compte.
// Liste les sessions actives (GET /auth/sessions), permet d'en fermer une (DELETE /auth/sessions/:id) ou de fermer
// toutes les autres (POST /auth/sessions/revoke-others). La session de cet appareil est signalée et ne se ferme pas ici
// (le bouton « Se déconnecter » de la page sert à cela). Confirmation en deux temps, sans fenêtre du navigateur.
// Affichage en cartes : une colonne sur téléphone, boutons pleine largeur.

import { useCallback, useEffect, useState } from 'react';
import { describeSession, type UserSession } from '@direct-transfair/shared';
import { Button, Card, Notice, Pill, Spinner } from './ui';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d);
}

function DeviceGlyph({ kind }: { kind: 'mobile' | 'desktop' | 'unknown' }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'mobile' ? (
        <>
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </>
      ) : (
        <>
          <rect x="3" y="4.5" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16.5V20" />
        </>
      )}
    </svg>
  );
}

export function SessionsCard() {
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null); // id de session, ou '*' pour « toutes les autres »
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSessions(await api.sessions.list());
    } catch (err) {
      setLoadError(describeError(err).message);
      setSessions((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeOne(id: string) {
    setBusyId(id);
    setFeedback(null);
    try {
      await api.sessions.revoke(id);
      setConfirmId(null);
      setFeedback({ tone: 'ok', text: 'Appareil déconnecté.' });
      await load();
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err).message });
    } finally {
      setBusyId(null);
    }
  }

  async function revokeOthers() {
    setBusyId('*');
    setFeedback(null);
    try {
      const r = await api.sessions.revokeOthers();
      setConfirmId(null);
      setFeedback({
        tone: 'ok',
        text: r.revoked > 0 ? `${r.revoked} appareil${r.revoked > 1 ? 's' : ''} déconnecté${r.revoked > 1 ? 's' : ''}.` : 'Aucun autre appareil connecté.',
      });
      await load();
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err).message });
    } finally {
      setBusyId(null);
    }
  }

  const others = (sessions ?? []).filter((s) => !s.current);

  return (
    <Card className="sess-card">
      <div className="sess-head">
        <div>
          <h2 className="card-title">Appareils connectés</h2>
          <p className="muted">
            Les appareils où votre compte est ouvert. Fermez ceux que vous ne reconnaissez pas, puis changez votre mot de passe.
          </p>
        </div>
        <Button variant="secondary" icon="refresh" onClick={() => void load()} disabled={busyId !== null}>
          Actualiser
        </Button>
      </div>

      {feedback ? (
        <div className="sess-feedback">
          <Notice tone={feedback.tone}>{feedback.text}</Notice>
        </div>
      ) : null}
      {loadError ? (
        <div className="sess-feedback">
          <Notice tone="error">{loadError}</Notice>
        </div>
      ) : null}

      {sessions === null ? (
        <div className="sess-loading"><Spinner label="Chargement des appareils" /></div>
      ) : sessions.length === 0 && !loadError ? (
        <p className="muted sess-empty">Aucune session active.</p>
      ) : (
        <ul className="sess-list">
          {sessions.map((s) => {
            const label = describeSession(s);
            const asking = confirmId === s.id;
            return (
              <li key={s.id} className={s.current ? 'sess-item sess-item--current' : 'sess-item'}>
                <span className="sess-item__icon"><DeviceGlyph kind={label.kind} /></span>
                <div className="sess-item__body">
                  <div className="sess-item__title">
                    <strong>{label.title}</strong>
                    {s.current ? <Pill tone="ok" icon="check">Cet appareil</Pill> : null}
                  </div>
                  <p className="sess-item__meta">
                    Connecté le {fmt(s.createdAt)}
                    {s.ipAddress ? ` · IP ${s.ipAddress}` : ''}
                    {s.country ? ` · ${s.country}` : ''}
                  </p>
                </div>
                {!s.current ? (
                  <div className="sess-item__actions">
                    {asking ? (
                      <>
                        <Button variant="danger" busy={busyId === s.id} onClick={() => void revokeOne(s.id)}>
                          Confirmer
                        </Button>
                        <Button variant="secondary" disabled={busyId !== null} onClick={() => setConfirmId(null)}>
                          Annuler
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" icon="logout" disabled={busyId !== null} onClick={() => setConfirmId(s.id)}>
                        Déconnecter
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {others.length > 0 ? (
        <div className="card-actions sess-all">
          {confirmId === '*' ? (
            <>
              <Button variant="danger" busy={busyId === '*'} onClick={() => void revokeOthers()}>
                Confirmer : déconnecter les {others.length} autres appareils
              </Button>
              <Button variant="secondary" disabled={busyId !== null} onClick={() => setConfirmId(null)}>
                Annuler
              </Button>
            </>
          ) : (
            <Button variant="secondary" icon="logout" disabled={busyId !== null} onClick={() => setConfirmId('*')}>
              Déconnecter tous les autres appareils
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
