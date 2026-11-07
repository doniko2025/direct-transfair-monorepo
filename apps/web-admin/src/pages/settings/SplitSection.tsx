// src/pages/settings/SplitSection.tsx
// Réglages › Frais : partage des frais d'un retrait payé en agence (6 combinaisons) + historique compact.
// Admin de société : modifie. Super admin : consulte (lecture seule).

import { useState } from 'react';
import type { SplitChange, SplitRule, SplitRules } from '@direct-transfair/shared';
import { Pill } from '../../components/ui';
import { DEST_LABEL, pct, SOURCE_LABEL, sortSplitRules } from '../../lib/splitRules';
import type { Resource } from '../../lib/useResource';
import { IconBtn, SectionState } from './SettingsKit';
import SplitDialog from './SplitDialog';
import SplitHistory from './SplitHistory';

function Bar({ sender, payer, platform }: { sender: number; payer: number; platform: number }) {
  return (
    <div className="split-bar" role="img" aria-label={`Agence d’envoi ${pct(sender)}, agence payeuse ${pct(payer)}, société ${pct(platform)}`}>
      <span className="split-bar__seg split-bar__seg--sender" style={{ flexGrow: sender }} />
      <span className="split-bar__seg split-bar__seg--payer" style={{ flexGrow: payer }} />
      <span className="split-bar__seg split-bar__seg--platform" style={{ flexGrow: platform }} />
    </div>
  );
}

function RuleCard({ rule, editable, onEdit }: { rule: SplitRule; editable: boolean; onEdit: () => void }) {
  const s = rule.effective;
  const fromWallet = rule.sourceType === 'WALLET';
  return (
    <li className="set-tile" data-split={`${rule.sourceType}-${rule.destType}`}>
      <div className="set-tile__head">
        <div className="set-tile__title">
          <strong>{SOURCE_LABEL[rule.sourceType]}</strong>
          <small>{DEST_LABEL[rule.destType]}</small>
        </div>
        <div className="set-tile__tools">
          {rule.configured ? <Pill tone="ok">Configuré</Pill> : <Pill tone="warn">Par défaut</Pill>}
          {editable ? <IconBtn icon="edit" label={`Modifier le partage : ${SOURCE_LABEL[rule.sourceType]}, ${DEST_LABEL[rule.destType]}`} onClick={onEdit} /> : null}
        </div>
      </div>
      <Bar sender={s.senderShare} payer={s.payerShare} platform={s.platformShare} />
      <dl className="set-shares">
        {fromWallet ? null : (
          <div>
            <dt>
              <span className="split-dot split-dot--sender" />
              Envoi
            </dt>
            <dd data-part="sender">{pct(s.senderShare)}</dd>
          </div>
        )}
        <div>
          <dt>
            <span className="split-dot split-dot--payer" />
            Paiement
          </dt>
          <dd data-part="payer">{pct(s.payerShare)}</dd>
        </div>
        <div>
          <dt>
            <span className="split-dot split-dot--platform" />
            Société
          </dt>
          <dd data-part="platform">{pct(s.platformShare)}</dd>
        </div>
      </dl>
      {fromWallet ? <p className="set-tile__note">Un client n’a pas d’agence d’envoi : cette part revient à la société.</p> : null}
    </li>
  );
}

interface Props {
  rules: Resource<SplitRules | null>;
  history: Resource<{ data: SplitChange[] }>;
  onChanged: (message: string) => void;
}

export default function SplitSection({ rules, history, onChanged }: Props) {
  const [editing, setEditing] = useState<SplitRule | null>(null);
  const data = rules.data;
  const list = sortSplitRules(data?.rules ?? []);
  const editable = data?.editable ?? false;

  return (
    <div className="set-panel">
      <p className="set-intro">
        Quand un retrait est payé en agence, les frais de l’envoi sont partagés entre l’agence d’envoi, l’agence qui paie le cash et la société. Chaque combinaison a
        sa répartition.
      </p>
      <SectionState resource={rules} loadingLabel="Chargement du partage des frais" errorTitle="Impossible de charger le partage des frais" />
      {data ? (
        <ul className="set-tiles">
          {list.map((r) => (
            <RuleCard key={`${r.sourceType}-${r.destType}`} rule={r} editable={editable} onEdit={() => setEditing(r)} />
          ))}
        </ul>
      ) : null}
      <p className="set-note">
        Si l’agence d’envoi est aussi celle qui paie le cash, elle touche les deux parts. Les envois gratuits (réglables dans l’onglet Paramètres) n’ont aucun frais à
        partager.
      </p>
      <SplitHistory resource={history} />
      {editing ? (
        <SplitDialog
          rule={editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            onChanged(message);
          }}
        />
      ) : null}
    </div>
  );
}
