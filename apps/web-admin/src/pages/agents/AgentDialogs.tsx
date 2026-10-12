// src/pages/agents/AgentDialogs.tsx
// Les trois opérations sur un agent : changer d'agence, le nommer responsable, lui donner un nouveau mot de passe.

import { useState, type FormEvent } from 'react';
import type { Agency, Agent } from '@direct-transfair/shared';
import { ConfirmDialog, CopyButton, SelectField } from '../../components/form';
import { Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { agentName } from '../../lib/agencyRules';
import { describeError } from '../../lib/errors';
import { fullName } from '../../lib/userRules';
import { useDialogAction } from '../treasury/useDialogAction';

interface Common {
  agent: Agent;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function AssignAgencyDialog({ agent, agencies, onClose, onDone }: Common & { agencies: readonly Agency[] }) {
  const options = agencies.filter((a) => a.isActive && a.id !== agent.agency?.id);
  const [agencyId, setAgencyId] = useState(options[0]?.id ?? '');
  const { busy, error, run } = useDialogAction(onDone);
  const target = options.find((a) => a.id === agencyId);

  function submit() {
    if (!target) return;
    void run(async () => {
      await api.agents.assignAgency(agent.id, target.id);
      return `${fullName(agent)} est maintenant à ${target.name}.`;
    });
  }

  return (
    <ConfirmDialog
      open
      title="Changer d'agence"
      confirmLabel="Changer d'agence"
      busy={busy}
      confirmDisabled={!target}
      onConfirm={submit}
      onCancel={onClose}
    >
      <form
        className="dialog-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="submit" hidden />
        {options.length === 0 ? (
          <Notice tone="info">Il n'y a pas d'autre agence active. Créez-en une d'abord.</Notice>
        ) : (
          <>
            <p className="muted">
              {fullName(agent)} quitte {agent.agency?.name ?? 'son agence'} et rejoint l'agence choisie.
              {agent.isManager ? ' Il n’en sera plus le responsable.' : ''} Son portefeuille personnel le suit.
            </p>
            <SelectField
              id="as-agency"
              label="Nouvelle agence"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              options={options.map((a) => ({ value: a.id, label: `${a.name} — ${a.city}` }))}
            />
          </>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}

export function SetManagerDialog({ agent, agencies, onClose, onDone }: Common & { agencies: readonly Agency[] }) {
  const { busy, error, run } = useDialogAction(onDone);
  const agency = agencies.find((a) => a.id === agent.agency?.id);
  const previous = agency?.agents?.find((a) => a.id === agency.managerId);

  return (
    <ConfirmDialog
      open
      title="Nommer le responsable"
      confirmLabel="Nommer responsable"
      busy={busy}
      onConfirm={() =>
        void run(async () => {
          await api.agents.setManager(agent.id);
          return `${fullName(agent)} est le responsable de ${agent.agency?.name ?? 'son agence'}.`;
        })
      }
      onCancel={onClose}
    >
      <div className="dialog-form">
        <p>
          {fullName(agent)} devient le responsable de {agent.agency?.name ?? 'son agence'}.
          {previous && previous.id !== agent.id ? ` ${agentName(previous)} ne l’est plus.` : ''}
        </p>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export function ResetPasswordDialog({ agent, onClose, onDone }: Common) {
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.agents.resetPassword(agent.id);
      setPassword(result.generatedPassword);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (password) {
    return (
      <ConfirmDialog
        open
        title="Nouveau mot de passe"
        confirmLabel="Terminé"
        hideCancel
        onConfirm={() => onDone(`Mot de passe de ${fullName(agent)} réinitialisé.`)}
        onCancel={() => onDone(`Mot de passe de ${fullName(agent)} réinitialisé.`)}
      >
        <div className="dialog-form">
          <p>Transmettez-le à {fullName(agent)} par un canal sûr. Un email lui a aussi été envoyé.</p>
          <p className="inline-copy">
            <span className="mono">{password}</span>
            <CopyButton value={password} />
          </p>
          <Notice tone="info">Ce mot de passe n'est affiché qu'ici. L'ancien ne fonctionne plus.</Notice>
        </div>
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      open
      title="Nouveau mot de passe"
      confirmLabel="Générer un mot de passe"
      busy={busy}
      onConfirm={() => void generate()}
      onCancel={onClose}
    >
      <div className="dialog-form">
        <p>
          Le mot de passe actuel de {fullName(agent)} cessera de fonctionner. Un mot de passe temporaire sera généré
          et envoyé à {agent.email}.
        </p>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}
