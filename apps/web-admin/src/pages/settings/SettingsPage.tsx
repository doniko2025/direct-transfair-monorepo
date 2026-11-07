// src/pages/settings/SettingsPage.tsx
// Réglages de la société, rangés en 4 onglets :
//   Paramètres (modes gratuits, recharge, marchands, codes de retrait, caisse) · Frais (partage entre agences)
//   Seuils (validation d'un envoi cash, par devise) · Plafonds (envoi par niveau KYC et par devise).
// Chaque onglet a son historique compact. Les 4 panneaux restent montés (masqués) : changer d'onglet ne fait pas perdre une saisie.
// Admin de société : modifie. Super admin : consulte ceux de la société de son choix.

import { useCallback, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { useKeyedResource, useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';
import CompanySettingsSection from './CompanySettingsSection';
import LimitsSection from './LimitsSection';
import SplitSection from './SplitSection';
import ThresholdSection from './ThresholdSection';

const TABS = [
  { id: 'params', label: 'Paramètres' },
  { id: 'frais', label: 'Frais' },
  { id: 'seuils', label: 'Seuils' },
  { id: 'plafonds', label: 'Plafonds' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** L'onglet ouvert se retrouve dans l'adresse (#frais…) : on revient où l'on était après un rechargement. */
function initialTab(): TabId {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return TABS.find((t) => t.id === hash)?.id ?? 'params';
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

  const thresholds = useKeyedResource(scope, async () => (skip ? null : api.validationThresholds.get(clientId)), [skip]);
  const thresholdLog = useKeyedResource(scope, async () => (skip ? { data: [] } : api.validationThresholds.history(clientId, 10)), [skip]);

  const limits = useKeyedResource(scope, async () => (skip ? null : api.transferLimits.get(clientId)), [skip]);
  const limitsLog = useKeyedResource(scope, async () => (skip ? { data: [] } : api.transferLimits.history(clientId, 10)), [skip]);

  const companySettings = useKeyedResource(scope, async () => (skip ? null : api.companySettings.get(clientId)), [skip]);
  const companySettingsLog = useKeyedResource(scope, async () => (skip ? { data: [] } : api.companySettings.history(clientId, 10)), [skip]);

  const [tab, setTabState] = useState<TabId>(initialTab);
  const [paramsDirty, setParamsDirty] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const setTab = useCallback((id: TabId) => {
    setTabState(id);
    try {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${id}`);
    } catch {
      /* adresse non modifiable : l'onglet reste choisi, sans lien direct */
    }
  }, []);

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    if (!next) return;
    setTab(next.id);
    document.getElementById(`set-tab-${next.id}`)?.focus();
  };

  const reloadRules = rules.reload;
  const reloadHistory = history.reload;
  const done = useCallback(
    (message: string) => {
      setFlash(message);
      reloadRules();
      reloadHistory();
    },
    [reloadRules, reloadHistory],
  );

  const reloadThresholds = thresholds.reload;
  const reloadThresholdLog = thresholdLog.reload;
  const thresholdDone = useCallback(
    (message: string) => {
      setFlash(message);
      reloadThresholds();
      reloadThresholdLog();
    },
    [reloadThresholds, reloadThresholdLog],
  );

  const reloadLimits = limits.reload;
  const reloadLimitsLog = limitsLog.reload;
  const limitsDone = useCallback(
    (message: string) => {
      setFlash(message);
      reloadLimits();
      reloadLimitsLog();
    },
    [reloadLimits, reloadLimitsLog],
  );

  const reloadCompanySettings = companySettings.reload;
  const reloadCompanySettingsLog = companySettingsLog.reload;
  const companySettingsDone = useCallback(
    (message: string) => {
      setFlash(message);
      reloadCompanySettings();
      reloadCompanySettingsLog();
      // Les parts « par défaut » du partage des frais dépendent de ces paramètres.
      reloadRules();
    },
    [reloadCompanySettings, reloadCompanySettingsLog, reloadRules],
  );

  const data = rules.data;
  const companyOptions = (companies.data ?? []).map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <>
      <PageHeader
        title="Réglages"
        description={data ? `Paramètres, frais, seuils et plafonds de ${data.company.name}.` : 'Paramètres, frais, seuils et plafonds.'}
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => {
              rules.reload();
              history.reload();
              companySettings.reload();
              companySettingsLog.reload();
              thresholds.reload();
              thresholdLog.reload();
              limits.reload();
              limitsLog.reload();
            }}
            busy={rules.loading && data !== null}
          >
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
        <div className="toolbar toolbar--inline">
          <SelectField
            id="set-company"
            label="Société"
            className="toolbar__select"
            value={picked || String(companies.data?.[0]?.id ?? '')}
            onChange={(e) => setPicked(e.target.value)}
            options={companyOptions}
          />
          <Notice tone="info">Chaque société fixe ses réglages : vous les consultez ici sans pouvoir les modifier.</Notice>
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
        <div className="set-page">
          <div className="set-tabs" role="tablist" aria-label="Rubriques des réglages" onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`set-tab-${t.id}`}
                type="button"
                role="tab"
                className="set-tab"
                aria-selected={tab === t.id}
                aria-controls={`set-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'params' && paramsDirty ? <span className="set-tab__dot" role="img" aria-label="Modifications non enregistrées" /> : null}
              </button>
            ))}
          </div>

          <div id="set-panel-params" role="tabpanel" aria-labelledby="set-tab-params" hidden={tab !== 'params'}>
            <CompanySettingsSection
              settings={companySettings}
              log={companySettingsLog}
              onChanged={companySettingsDone}
              onDirtyChange={setParamsDirty}
            />
          </div>
          <div id="set-panel-frais" role="tabpanel" aria-labelledby="set-tab-frais" hidden={tab !== 'frais'}>
            <SplitSection rules={rules} history={history} onChanged={done} />
          </div>
          <div id="set-panel-seuils" role="tabpanel" aria-labelledby="set-tab-seuils" hidden={tab !== 'seuils'}>
            <ThresholdSection thresholds={thresholds} log={thresholdLog} onChanged={thresholdDone} />
          </div>
          <div id="set-panel-plafonds" role="tabpanel" aria-labelledby="set-tab-plafonds" hidden={tab !== 'plafonds'}>
            <LimitsSection limits={limits} log={limitsLog} onChanged={limitsDone} />
          </div>
        </div>
      )}
    </>
  );
}
