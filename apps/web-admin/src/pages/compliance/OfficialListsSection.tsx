// src/pages/compliance/OfficialListsSection.tsx
// Listes officielles de sanctions (ONU · OFAC · UE) : une carte par liste avec interrupteur d'activation pour la société,
// état de la dernière mise à jour, nombre de fiches et bouton « Actualiser ». Les listes sont téléchargées chaque nuit.

import { useEffect, useState } from 'react';
import type { OfficialList, OfficialProvider } from '@direct-transfair/shared';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { OFFICIAL_ABOUT, OFFICIAL_FLAG, OFFICIAL_HEALTH_LABEL, OFFICIAL_HEALTH_TONE, OFFICIAL_SHORT, ago, officialHealth } from '../../lib/complianceRules';
import { useResource } from '../../lib/useResource';

export function OfficialListsSection() {
  const res = useResource(() => api.compliance.officialLists(), []);
  const lists = res.data ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const running = lists.some((l) => l.status === 'RUNNING');

  // Pendant un téléchargement, l'écran se rafraîchit seul toutes les 3 secondes.
  useEffect(() => {
    if (!running) return undefined;
    const t = window.setInterval(() => res.reload(), 3000);
    return () => window.clearInterval(t);
  }, [running, res]);

  const toggle = async (l: OfficialList) => {
    setBusy(l.provider); setError(null); setInfo(null);
    try {
      await api.compliance.setOfficialList(l.provider, !l.enabled);
      if (!l.enabled) setInfo(l.entryCount > 0 ? `${OFFICIAL_SHORT[l.provider]} activée : vos clients sont en cours de contrôle.` : `${OFFICIAL_SHORT[l.provider]} activée : téléchargement de la liste en cours.`);
      res.reload();
    } catch (err) { setError(describeError(err).message); } finally { setBusy(null); }
  };

  const refresh = async (p: OfficialProvider) => {
    setBusy(p); setError(null); setInfo(null);
    try { await api.compliance.syncOfficialList(p); res.reload(); } catch (err) { setError(describeError(err).message); } finally { setBusy(null); }
  };

  return (
    <section className="cmp-official" aria-labelledby="cmp-official-title">
      <div className="cmp-official__head">
        <h2 id="cmp-official-title">Listes officielles</h2>
        <p>Activez une liste : elle est téléchargée et mise à jour chaque nuit, puis comparée à chaque envoi et à votre clientèle.</p>
      </div>
      {info ? <Notice tone="ok">{info}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {res.loading && lists.length === 0 ? (
        <div className="center-block"><Spinner label="Chargement des listes officielles" /></div>
      ) : res.error && lists.length === 0 ? (
        <Notice tone="error" title="Listes officielles indisponibles" action={<Button variant="secondary" onClick={res.reload}>Réessayer</Button>}>{describeError(res.error).message}</Notice>
      ) : (
        <div className="cmp-official__grid">
          {lists.map((l, i) => {
            const health = officialHealth(l);
            return (
              <Card key={l.provider} className={`cmp-off${l.enabled ? ' is-on' : ''}`} style={{ ['--i' as string]: i }}>
                <div className="cmp-off__top">
                  <span className="cmp-off__flag" aria-hidden="true">{OFFICIAL_FLAG[l.provider]}</span>
                  <Pill tone={OFFICIAL_HEALTH_TONE[health]}>{OFFICIAL_HEALTH_LABEL[health]}</Pill>
                  <label className="grw-switch cmp-off__switch" aria-label={`${l.enabled ? 'Désactiver' : 'Activer'} la liste ${OFFICIAL_SHORT[l.provider]}`}>
                    <input type="checkbox" checked={l.enabled} disabled={busy === l.provider} onChange={() => void toggle(l)} />
                    <span className="grw-switch__track" aria-hidden="true" />
                  </label>
                </div>
                <h3 className="cmp-off__name">{OFFICIAL_SHORT[l.provider]}</h3>
                <p className="cmp-off__about">{OFFICIAL_ABOUT[l.provider]}</p>
                <div className="cmp-off__stats">
                  <div><strong>{l.entryCount.toLocaleString('fr-FR')}</strong><span>fiches</span></div>
                  <div><strong>+{l.added}</strong><span>ajoutées</span></div>
                  <div><strong>−{l.removed}</strong><span>retirées</span></div>
                </div>
                <p className="cmp-off__when">
                  {health === 'RUNNING' ? <><Spinner label="Mise à jour en cours" /> Téléchargement en cours…</> : `Dernière mise à jour réussie : ${ago(l.lastSuccessAt)}`}
                </p>
                {l.stale && l.enabled ? <Notice tone="error">Cette liste n’est plus actualisée depuis plus de 3 jours : vos contrôles utilisent une version ancienne.</Notice> : null}
                {l.error && l.status === 'ERROR' ? <p className="cmp-off__err">Dernier essai : {l.error}</p> : null}
                <div className="cmp-off__actions">
                  <Button variant="secondary" icon="refresh" busy={l.status === 'RUNNING' || busy === l.provider} disabled={!l.configured} onClick={() => void refresh(l.provider)}>Actualiser</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
