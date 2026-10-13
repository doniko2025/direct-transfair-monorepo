// src/pages/SsoPage.tsx
// =========================================================
// ARRIVÉE DEPUIS LA CONSOLE dkmoney.store v1.0  (route /sso)
//
// La console remet une assertion signée de 60 s dans le FRAGMENT de l'URL (#a=…) : un fragment n'est jamais
// envoyé au serveur ni consigné dans les journaux. On la lit, on l'efface aussitôt de la barre d'adresse, puis on
// l'échange contre une session (POST /auth/platform-sso). Elle ne sert qu'une fois : en cas d'échec, on propose
// de retourner à la console plutôt que de réessayer en boucle.
// =========================================================

import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '@direct-transfair/shared';
import { CONSOLE_EMBEDDED, CONSOLE_URL } from '../config';
import { LoadingScreen, ScreenState } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';

/** Lit puis efface l'assertion du fragment d'URL (une seule fois par chargement de page). */
function takeAssertion(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const value = new URLSearchParams(hash).get('a');
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return value && value.length >= 20 ? value : null;
}

export default function SsoPage() {
  const { state, loginWithAssertion } = useAuth();
  const navigate = useNavigate();
  const assertionRef = useRef<string | null | undefined>(undefined);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  if (assertionRef.current === undefined) assertionRef.current = takeAssertion();

  useEffect(() => {
    // On attend que la restauration d'une éventuelle ancienne session soit terminée, pour ne pas la voir
    // écraser la nouvelle.
    if (state.status !== 'anonymous' || started.current) return;
    const assertion = assertionRef.current;
    if (!assertion) {
      setError("Lien de connexion absent ou déjà utilisé. Reviens à la console puis clique de nouveau sur « Consulter les sociétés de transfert ».");
      return;
    }
    started.current = true;
    loginWithAssertion(assertion)
      .then((outcome) => {
        if (outcome.kind === 'success') navigate('/', { replace: true });
        else setError('Ce compte ne peut pas ouvrir le portail des sociétés de transfert.');
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Connexion impossible.');
      });
  }, [state.status, loginWithAssertion, navigate]);

  if (state.status === 'authenticated') return <Navigate to="/" replace />;

  if (error) {
    return (
      <ScreenState
        title="Connexion depuis la console impossible"
        icon="alert"
        actions={
          CONSOLE_EMBEDDED ? (
            <a className="btn btn--primary" href={CONSOLE_URL}>
              Retour à la console
            </a>
          ) : undefined
        }
      >
        <p>{error}</p>
      </ScreenState>
    );
  }

  return <LoadingScreen label="Ouverture des sociétés de transfert…" />;
}
