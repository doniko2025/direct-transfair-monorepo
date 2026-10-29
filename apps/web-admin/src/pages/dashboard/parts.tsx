// apps/web-admin/src/pages/dashboard/parts.tsx
// Briques communes des tableaux de bord (admin de société, agent, super admin) :
// indicateur, panneau, lignes d'opérations, raccourcis, aperçu des notifications.
// Jamais de tableau : uniquement des cartes.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '@direct-transfair/shared';
import { Icon, type IconName } from '../../components/Icon';
import { Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { when } from '../../lib/dashboardRules';
import { statusLabel, statusTone, viewFor } from '../../lib/transactionRules';
import { useResource, type Resource } from '../../lib/useResource';

// ─── Indicateur ──────────────────────────────────────────
export function KpiCard({
  icon,
  label,
  value,
  note,
  to,
  tone = 'default',
  variant,
  loading = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  note?: string;
  to?: string;
  tone?: 'default' | 'warn' | 'ok';
  /** Variante visuelle facultative (ex. « in », « out ») : ajoute la classe `dash-kpi--<variant>`. */
  variant?: string;
  loading?: boolean;
}) {
  const body = (
    <>
      <span className="dash-kpi__icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="dash-kpi__label">{label}</span>
      <strong className="dash-kpi__value">{loading ? '…' : value}</strong>
      {note ? <small className="dash-kpi__note">{loading ? ' ' : note}</small> : null}
    </>
  );
  const cls = `dash-kpi dash-kpi--${tone}${variant ? ` dash-kpi--${variant}` : ''}`;
  return to ? (
    <Link to={to} className={cls} aria-busy={loading || undefined}>
      {body}
    </Link>
  ) : (
    <div className={cls} aria-busy={loading || undefined}>
      {body}
    </div>
  );
}

export function KpiGrid({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div className={className ? `dash-kpis ${className}` : 'dash-kpis'} role="group" aria-label={label}>
      {children}
    </div>
  );
}

// ─── Panneau ─────────────────────────────────────────────
export function Panel({
  title,
  to,
  linkLabel = 'Tout voir',
  badge,
  children,
}: {
  title: string;
  to?: string;
  linkLabel?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card card--raised dash-panel">
      <header className="dash-panel__head">
        <h2 className="card-title">{title}</h2>
        {badge}
        {to ? (
          <Link to={to} className="link-btn dash-panel__more">
            {linkLabel}
            <Icon name="chevronRight" size={15} />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Contenu d'un panneau selon l'état de chargement de sa ressource. */
export function PanelState<T>({
  res,
  what,
  empty,
  children,
}: {
  res: Resource<T>;
  what: string;
  /** Texte quand la ressource est chargée mais vide (`isEmpty` vrai). */
  empty?: { when: (data: T) => boolean; text: ReactNode };
  children: (data: T) => ReactNode;
}) {
  if (res.loading && !res.data) {
    return (
      <div className="center-block center-block--sm">
        <Spinner label={`Chargement : ${what}`} />
      </div>
    );
  }
  if (res.error || !res.data) {
    return (
      <p className="muted dash-empty">
        Impossible de charger {what} pour le moment.{' '}
        <button type="button" className="link-btn" onClick={res.reload}>
          Réessayer
        </button>
      </p>
    );
  }
  if (empty?.when(res.data)) return <p className="muted dash-empty">{empty.text}</p>;
  return <>{children(res.data)}</>;
}

// ─── Lignes d'opérations ─────────────────────────────────
export function TxRows({ txs, viewer }: { txs: readonly Transaction[]; viewer: { id: string | number; role: string } }) {
  return (
    <ul className="dash-tx">
      {txs.map((tx) => {
        const v = viewFor(tx, viewer);
        return (
          <li key={tx.id}>
            <Link to={`/transactions/${encodeURIComponent(tx.id)}`} className="dash-tx__row">
              <span className={`dash-tx__icon dash-tx__icon--${v.flow}`} aria-hidden="true">
                <Icon name={v.icon} size={18} />
              </span>
              <span className="dash-tx__main">
                <strong>{v.title}</strong>
                <span>{v.subtitle}</span>
              </span>
              <span className="dash-tx__side">
                <strong>{v.amount}</strong>
                <span>
                  <Pill tone={statusTone(tx.status)}>{statusLabel(tx.status)}</Pill>
                </span>
                <small>{when(tx.createdAt)}</small>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Raccourcis ──────────────────────────────────────────
export interface ShortcutDef {
  to: string;
  label: string;
  icon: IconName;
}

export function Shortcuts({ items, label = 'Raccourcis' }: { items: readonly ShortcutDef[]; label?: string }) {
  return (
    <nav className="dash-shortcuts" aria-label={label}>
      {items.map((s) => (
        <Link key={s.to} to={s.to} className="dash-shortcut">
          <Icon name={s.icon} size={20} />
          <span>{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// ─── Notifications ───────────────────────────────────────
export function NotificationsPeek() {
  const res = useResource(async () => {
    const [list, unread] = await Promise.all([api.notifications.list({ limit: 4 }), api.notifications.unreadCount()]);
    return { list: Array.isArray(list) ? list : [], unread: unread?.count ?? 0 };
  }, []);

  return (
    <Panel
      title="Notifications"
      to="/notifications"
      badge={res.data && res.data.unread > 0 ? <Pill tone="brand">{res.data.unread} non lue{res.data.unread > 1 ? 's' : ''}</Pill> : null}
    >
      <PanelState res={res} what="les notifications" empty={{ when: (d) => d.list.length === 0, text: 'Aucune notification.' }}>
        {(d) => (
          <ul className="dash-notifs">
            {d.list.map((n) => (
              <li key={n.id} className={n.isRead ? undefined : 'is-unread'}>
                <Link to="/notifications">
                  <span className="dash-notifs__dot" aria-hidden="true" />
                  <span className="dash-notifs__text">
                    <strong>{n.title}</strong>
                    <span>{n.message}</span>
                  </span>
                  <small>{when(n.createdAt)}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelState>
    </Panel>
  );
}
