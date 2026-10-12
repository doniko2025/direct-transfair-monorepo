// src/pages/fees/FeeSchedulePage.tsx
// Barème d'envoi. Admin de société : ajoute, modifie, désactive et supprime les règles de sa société.
// Super admin : consulte le barème de la société de son choix, sans pouvoir le modifier.

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FeeRule } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { rangeLabel, ruleCriteria, ruleFee, ruleTitle, sortRules } from '../../lib/feeScheduleRules';
import { useKeyedResource, useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useDialogAction } from '../treasury/useDialogAction';
import FeeRuleDialog from './FeeRuleDialog';
import FeeRuleHistory from './FeeRuleHistory';
import FeeSimulator from './FeeSimulator';

function RuleCard({ rule, editable, onEdit, onToggle, onDelete }: { rule: FeeRule; editable: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const criteria = ruleCriteria(rule);
  return (
    <li className={`rule-card${rule.isActive ? '' : ' is-off'}`} data-rule={rule.id}>
      <div className="rule-card__head">
        <h3>{ruleTitle(rule)}</h3>
        {rule.isActive ? <Pill tone="ok">Active</Pill> : <Pill tone="neutral">Désactivée</Pill>}
      </div>
      <p className="rule-card__fee">{ruleFee(rule)}</p>
      <p className="rule-card__range">{rangeLabel(rule)}</p>
      <ul className="rule-card__tags" aria-label="Critères">
        {criteria.length === 0 ? <li>Tous les envois</li> : criteria.map((c) => <li key={c}>{c}</li>)}
      </ul>
      {editable ? (
        <div className="rule-card__actions">
          <Button variant="secondary" icon="edit" onClick={onEdit}>
            Modifier
          </Button>
          <Button variant="secondary" onClick={onToggle}>
            {rule.isActive ? 'Désactiver' : 'Activer'}
          </Button>
          <Button variant="secondary" icon="trash" onClick={onDelete} aria-label={`Supprimer ${ruleTitle(rule)}`}>
            Supprimer
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function DeleteDialog({ rule, onClose, onDone }: { rule: FeeRule; onClose: () => void; onDone: (message: string) => void }) {
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title="Supprimer cette règle ?"
      confirmLabel="Supprimer la règle"
      tone="danger"
      busy={busy}
      onConfirm={() =>
        void run(async () => {
          await api.feeSchedule.remove(rule.id);
          return `Règle « ${ruleTitle(rule)} » supprimée.`;
        })
      }
      onCancel={onClose}
    >
      <p>
        « {ruleTitle(rule)} » ({ruleFee(rule)}, {rangeLabel(rule).toLowerCase()}) ne sera plus appliquée. Les envois déjà faits gardent leurs frais.
      </p>
      <p className="muted">Pour la mettre de côté sans la perdre, désactivez-la plutôt.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </ConfirmDialog>
  );
}

export default function FeeSchedulePage() {
  const me = useCurrentUser();
  const isSuper = me.role === 'SUPER_ADMIN';

  // Super admin : la liste des sociétés sert à choisir laquelle consulter.
  const companies = useResource(async () => (isSuper ? (await api.fees.companies()).companies : []), [isSuper]);
  const [picked, setPicked] = useState('');
  const clientId = isSuper ? (picked ? Number(picked) : (companies.data?.[0]?.id ?? undefined)) : undefined;

  const scope = String(clientId ?? 'none');
  const rules = useKeyedResource(scope, async () => (isSuper && !clientId ? null : api.feeSchedule.rules(clientId)), [isSuper]);
  const history = useKeyedResource(scope, async () => (isSuper && !clientId ? { data: [] } : api.feeSchedule.history(clientId, 10)), [isSuper]);

  const [dialog, setDialog] = useState<{ kind: 'edit'; rule: FeeRule | null } | { kind: 'delete'; rule: FeeRule } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reloadRules = rules.reload;
  const reloadHistory = history.reload;
  const done = useCallback(
    (message: string) => {
      setDialog(null);
      setFlash(message);
      setVersion((v) => v + 1);
      reloadRules();
      reloadHistory();
    },
    [reloadRules, reloadHistory],
  );

  async function toggle(rule: FeeRule) {
    setToggling(rule.id);
    setToggleError(null);
    try {
      await api.feeSchedule.update(rule.id, {
        label: rule.label,
        payoutMethod: rule.payoutMethod,
        sendCountry: rule.sendCountry,
        receiveCountry: rule.receiveCountry,
        currency: rule.currency,
        minAmount: rule.minAmount,
        maxAmount: rule.maxAmount,
        feeRate: rule.feeRate,
        fixedFee: rule.fixedFee,
        isActive: !rule.isActive,
      });
      done(`Règle « ${ruleTitle(rule)} » ${rule.isActive ? 'désactivée' : 'activée'}.`);
    } catch (err) {
      setToggleError(describeError(err).message);
    } finally {
      setToggling(null);
    }
  }

  const data = rules.data;
  const list = useMemo(() => sortRules(data?.rules ?? []), [data]);
  const editable = data?.editable ?? false;
  const companyOptions = (companies.data ?? []).map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <>
      <PageHeader
        title="Barème d’envoi"
        description={
          data
            ? `Les frais que ${data.company.name} facture selon le montant, le pays et le mode de retrait.`
            : 'Les frais facturés selon le montant, le pays et le mode de retrait.'
        }
        actions={
          <>
            <Link to="/fees" className="btn btn--secondary">
              Frais par mode
            </Link>
            {editable ? (
              <Button icon="plus" onClick={() => setDialog({ kind: 'edit', rule: null })}>
                Ajouter une règle
              </Button>
            ) : null}
          </>
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
      {toggleError ? (
        <div className="stack stack--tight">
          <Notice tone="error" title="Impossible de modifier la règle">
            {toggleError}
          </Notice>
        </div>
      ) : null}

      {isSuper ? (
        <div className="toolbar">
          <SelectField
            id="fs-company"
            label="Société"
            className="toolbar__select"
            value={picked || String(companies.data?.[0]?.id ?? '')}
            onChange={(e) => setPicked(e.target.value)}
            options={companyOptions}
          />
          <Notice tone="info">Chaque société fixe son barème : vous le consultez ici sans pouvoir le modifier.</Notice>
        </div>
      ) : null}

      {(rules.loading && !data) || (isSuper && companies.loading && !companies.data) ? (
        <div className="center-block">
          <Spinner label="Chargement du barème" />
        </div>
      ) : rules.error && !data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger le barème"
            action={
              <button type="button" className="link-btn" onClick={rules.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(rules.error).message}
          </Notice>
        </Card>
      ) : isSuper && !clientId ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h2>Aucune société</h2>
          <p>Le barème d’une société apparaîtra ici dès qu’elle existe.</p>
        </Card>
      ) : (
        <div className="tr-stack">
          <FeeSimulator clientId={clientId} version={version} />

          <section aria-labelledby="rules-title" className="tr-section">
            <div className="tr-section__head">
              <h2 id="rules-title">
                {list.length === 0 ? 'Règles' : `${list.length} ${list.length > 1 ? 'règles' : 'règle'}`}
              </h2>
              <p>
                Un envoi suit la règle la plus précise qui lui correspond : pays de réception, puis pays d’envoi, puis mode de retrait. Sans règle, le tarif du
                mode de retrait s’applique.
              </p>
            </div>
            {list.length === 0 ? (
              <Card className="empty empty--compact">
                <span className="empty__icon">
                  <Icon name="percent" size={26} />
                </span>
                <h3>Aucune règle pour l’instant</h3>
                <p>
                  {editable
                    ? 'Ajoutez une règle pour faire varier vos frais selon le montant ou le pays. Tant qu’il n’y en a pas, le tarif de chaque mode de retrait s’applique.'
                    : 'Cette société n’a pas de règle : le tarif de chaque mode de retrait s’applique.'}
                </p>
                {editable ? (
                  <Button icon="plus" onClick={() => setDialog({ kind: 'edit', rule: null })}>
                    Ajouter une règle
                  </Button>
                ) : null}
              </Card>
            ) : (
              <ul className="rule-grid">
                {list.map((r) => (
                  <RuleCard
                    key={r.id}
                    rule={r}
                    editable={editable && toggling !== r.id}
                    onEdit={() => setDialog({ kind: 'edit', rule: r })}
                    onToggle={() => void toggle(r)}
                    onDelete={() => setDialog({ kind: 'delete', rule: r })}
                  />
                ))}
              </ul>
            )}
          </section>

          <FeeRuleHistory resource={history} />
        </div>
      )}

      {dialog?.kind === 'edit' ? <FeeRuleDialog rule={dialog.rule} rules={data?.rules ?? []} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog?.kind === 'delete' ? <DeleteDialog rule={dialog.rule} onClose={() => setDialog(null)} onDone={done} /> : null}
    </>
  );
}
