// src/pages/treasury/useDialogAction.ts
// Exécution d'une opération depuis une boîte de dialogue : état occupé, erreur du serveur
// affichée dans la boîte, et fermeture + message de réussite une fois l'opération faite.

import { useCallback, useState } from 'react';
import { describeError } from '../../lib/errors';

export function useDialogAction(onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<string>) => {
      setBusy(true);
      setError(null);
      try {
        const message = await action();
        onDone(message);
      } catch (err) {
        setError(describeError(err).message);
        setBusy(false);
      }
    },
    [onDone],
  );

  return { busy, error, run, clearError: () => setError(null) };
}
