// src/pages/settings/SettingsPage.tsx
// Réglages de la société : répartition des frais d'un retrait payé en agence.
// Admin de société : modifie les 6 combinaisons. Super admin : consulte celles de la société de son choix.

import { useCallback, useState } from 'react';
import type { SplitRule } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { DEST_LABEL, pct, SOURCE_LABEL, sortSplitRules } from '../../lib/splitRules';
import { useKeyedResource, useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';
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
    <li className="split-card" data-split={`${rule.sourceType}-${rule.destType}`}>
      <div className="split-card__head">
        <h3>{SOURCE_LABEL[rule.sourceType]}</h3>
        {rule.configured ? <Pill tone="ok">Configuré</Pill> : <Pill tone="warn">Par défaut</Pill>}
      </div>
      <p className="split-card__dest">{DEST_LABEL[rule.destType]}</p>
      <Bar sender={s.senderShare} payer={s.payerShare} platform={s.platformShare} />
      <dl className="split-card__shares">
        {fromWallet ? null : (
          <div>
            <dt>Agence d’envoi</dt>
            <dd data-part="sender">{pct(s.senderShare)}</dd>
          </div>
        )}
        <div>
          <dt>Agence payeuse</dt>
          <dd data-part="payer">{pct(s.payerShare)}</dd>
        </div>
        <div>
          <dt>Société</dt>
          <dd data-part="platform">{pct(s.platformShare)}</dd>
        </div>
      </dl>
      {fromWallet ? <p className="split-card__hint">Un client n’a pas d’agence d’envoi : cette part revient à la société.</p> : null}
      {!rule.configured ? <p className="split-card__hint">Rien n’est enregistré : la répartition par défaut s’applique.</p> : null}
      {editable ? (
        <div className="split-card__actions">
          <Button variant="secondary" icon="edit" onClick={onEdit}>
            Modifier
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export default function SettingsPage() {
  const me = useCurrentUser();
  const isSuper = me.role === 'SUPER_ADMIN';

  const companies = useResource(async () => (isSuper ? (await api.fees.companies()).companies : []), [isSuper]);
  const [picked, setPicked] = useState('');
  const clientId = isSuper ? (picked ? Number(picked) : (companies.data?.[0]?.id ?? undefined)) : undefined;
  const skip = isSuper && !clientId;

  const scope = String(clientId ?? 'none');
  const rules = useKeyedResource(scope, async () => (skip ? null : api.commissionRules.get(clientId)), [skip]);
  const history = useKeyedResource(scope, async () => (skip ? { data: [] } : api.commissionRules.history(clientId, 10)), [skip]);

  const [editing, setEditing] = useState<SplitRule | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const reloadRules = rules.reload;
  const reloadHistory = history.reload;
  const done = useCallback(
    (message: string) => {
      setEditing(null);
      setFlash(message);
      reloadRules();
      reloadHistory();
    },
    [reloadRules, reloadHistory],
  );

  const data = rules.data;
  const list = sortSplitRules(data?.rules ?? []);
  const editable = data?.editable ?? false;
  const companyOptions = (companies.data ?? []).map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <>
      <PageHeader
        title="Réglages"
        description={
          data
            ? `Comment ${data.company.name} partage les frais d’un retrait payé en agence.`
            : 'Comment les frais d’un retrait payé en agence sont partagés.'
        }
        actions={
          <Button variant="secondary" onClick={() => { rules.reload(); history.reload(); }} busy={rules.loading && data !== null}>
            Actualiser
          </Button>
        }
      />

      {flash ? (
        <div className="stack stack--tight">
          <Notice
            tone="ok"
            title={flash}
            action={
              <button type="button" className="link-btn" onClick={() => setFlash(null)}>
                Fermer
              </button>
            }
          />
        </div>
      ) : null}

      {isSuper ? (
        <div className="toolbar">
          <SelectField
            id="set-company"
            label="Société"
            className="toolbar__select"
            value={picked || String(companies.data?.[0]?.id ?? '')}
            onChange={(e) => setPicked(e.target.value)}
            options={companyOptions}
          />
          <Notice tone="info">Chaque société fixe sa répartition : vous la consultez ici sans pouvoir la modifier.</Notice>
        </div>
      ) : null}

      {(rules.loading && !data) || (isSuper && companies.loading && !companies.data) ? (
        <div className="center-block">
          <Spinner label="Chargement des réglages" />
        </div>
      ) : rules.error && !data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les réglages"
            action={
              <button type="button" className="link-btn" onClick={rules.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(rules.error).message}
          </Notice>
        </Card>
      ) : skip ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h2>Aucune société</h2>
          <p>Les réglages d’une société apparaîtront ici dès qu’elle existe.</p>
        </Card>
      ) : (
        <div className="tr-stack">
          <section aria-labelledby="split-title" className="tr-section">
            <div className="tr-section__head">
              <h2 id="split-title">Partage des frais</h2>
              <p>
                Quand un retrait est payé en agence, les frais de l’envoi sont partagés entre l’agence d’envoi, l’agence qui paie le cash et la société. Chaque
                combinaison a sa propre répartition.
              </p>
            </div>
            <ul className="split-grid">
              {list.map((r) => (
                <RuleCard key={`${r.sourceType}-${r.destType}`} rule={r} editable={editable} onEdit={() => setEditing(r)} />
              ))}
            </ul>
            <ul className="split-legend" aria-label="Légende">
              <li><span className="split-dot split-dot--sender" />Agence d’envoi</li>
              <li><span className="split-dot split-dot--payer" />Agence payeuse</li>
              <li><span className="split-dot split-dot--platform" />Société</li>
            </ul>
            <p className="muted">
              Si l’agence d’envoi est aussi celle qui paie le cash, elle touche les deux parts. Les frais d’un envoi vers Mobile Money ou entre wallets sont nuls : rien à
              partager.
            </p>
          </section>

          <SplitHistory resource={history} />
        </div>
      )}

      {editing ? <SplitDialog rule={editing} onClose={() => setEditing(null)} onDone={done} /> : null}
    </>
  );
}
