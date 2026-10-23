// apps/web-admin/src/pages/notifications/NotificationsPage.tsx
// v2.0 : SUPPRESSION — « Supprimer » ouvre le mode sélection (cases à cocher, « Tout sélectionner », « Supprimer (N) »),
//        confirmation dans une fenêtre puis toast de succès centré. Appelle POST /notifications/delete.
// Boîte de réception : une carte par notification, les plus récentes d'abord. Chaque utilisateur ne voit que les siennes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AppNotification } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { RefreshButton } from '../../components/RefreshButton';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { deleteNotifications, describeDeleteError } from '../../lib/notificationsApi';
import { isUrgent, TYPE_OPTIONS, transactionIdOf, viewOf } from '../../lib/notificationRules';
import { fullDate, plural, when } from '../../lib/supervisionRules';
import { useResource } from '../../lib/useResource';
import { useUnread } from '../../providers/UnreadProvider';

const FIRST = 50;
const MAX = 100;

type View = 'all' | 'unread';

const VIEW_OPTIONS: readonly { id: View; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'unread', label: 'Non lues' },
];

// Carte compacte : une ligne de titre, un aperçu d'une ligne, l'heure. Le texte complet
// s'ouvre dans une fenêtre (NotificationDetail) au clic.
function NotificationCard({
  n,
  read,
  onOpen,
  selectMode,
  checked,
  onToggle,
}: {
  n: AppNotification;
  read: boolean;
  onOpen: (n: AppNotification) => void;
  /** Mode sélection : un clic coche la carte au lieu de l'ouvrir. */
  selectMode: boolean;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const view = viewOf(n.type);
  return (
    <li className={`notif${read ? '' : ' notif--unread'}${checked ? ' notif--selected' : ''}`} data-id={n.id}>
      <button
        type="button"
        className="notif__open"
        {...(selectMode ? { role: 'checkbox', 'aria-checked': checked } : { 'aria-haspopup': 'dialog' as const })}
        onClick={() => (selectMode ? onToggle(n.id) : onOpen(n))}
      >
        {selectMode ? (
          <span className={`notif__check${checked ? ' is-checked' : ''}`} aria-hidden="true">
            {checked ? <Icon name="check" size={14} /> : null}
          </span>
        ) : null}
        <span className={`notif__icon notif__icon--${view.tone}`} aria-hidden="true">
          <Icon name={view.icon} size={18} />
        </span>
        <span className="notif__main">
          <span className="notif__head">
            <strong className="notif__title">{n.title}</strong>
            {read ? null : <span className="notif__dot" aria-label="Non lue" />}
            {isUrgent(n) ? <Pill tone="danger">{n.priority === 'URGENT' ? 'Urgent' : 'Important'}</Pill> : null}
          </span>
          <span className="notif__preview">{n.message}</span>
        </span>
        <time className="notif__time muted" dateTime={n.createdAt} title={fullDate(n.createdAt)}>
          {when(n.createdAt)}
        </time>
      </button>
    </li>
  );
}

// Contenu de la fenêtre de lecture : le texte en entier, le type, la date complète et le lien éventuel.
function NotificationDetail({ n, onNavigate }: { n: AppNotification; onNavigate: () => void }) {
  const view = viewOf(n.type);
  const txId = transactionIdOf(n);
  return (
    <>
      <div className="notif__meta">
        <Pill tone={view.tone}>{view.label}</Pill>
        {isUrgent(n) ? <Pill tone="danger">{n.priority === 'URGENT' ? 'Urgent' : 'Important'}</Pill> : null}
        <time className="muted" dateTime={n.createdAt}>
          {fullDate(n.createdAt)}
        </time>
      </div>
      <p className="notif__message">{n.message}</p>
      {txId ? (
        <Link className="link" to={`/transactions/${encodeURIComponent(txId)}`} onClick={onNavigate}>
          Voir la transaction
        </Link>
      ) : null}
    </>
  );
}

export default function NotificationsPage() {
  const { unread, refresh } = useUnread();
  const [view, setView] = useState<View>('all');
  const [type, setType] = useState('');
  const [limit, setLimit] = useState(FIRST);
  const [opened, setOpened] = useState<AppNotification | null>(null);

  // Suppression : mode sélection, confirmation, toast de succès
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const list = useResource(() => api.notifications.list({ limit, unreadOnly: view === 'unread' }), [limit, view]);

  // Notifications marquées comme lues ici : affichées lues tout de suite, sans attendre le rechargement.
  const [readNow, setReadNow] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<string | null>(null);
  const [allBusy, setAllBusy] = useState(false);

  // Un nouveau chargement apporte l'état du serveur : les marques locales n'ont plus lieu d'être.
  useEffect(() => {
    if (!list.loading) setReadNow(new Set());
  }, [list.data, list.loading]);

  const markRead = useCallback(
    async (id: string) => {
      setFailure(null);
      setReadNow((s) => new Set(s).add(id));
      try {
        await api.notifications.markRead(id);
        refresh();
      } catch (err) {
        setReadNow((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
        setFailure(describeError(err).message);
      }
    },
    [refresh],
  );

  const items = useMemo(() => list.data ?? [], [list.data]);
  const isRead = (n: AppNotification) => n.isRead || readNow.has(n.id);
  const shown = type ? items.filter((n) => n.type === type) : items;
  const unreadShown = items.filter((n) => !isRead(n)).length;
  const mayHaveMore = items.length >= limit && limit < MAX;

  async function markAll() {
    setAllBusy(true);
    setFailure(null);
    try {
      await api.notifications.markAllRead();
      setReadNow(new Set(items.map((n) => n.id)));
      refresh();
      list.reload();
    } catch (err) {
      setFailure(describeError(err).message);
    } finally {
      setAllBusy(false);
    }
  }

  // Seules les notifications visibles ET cochées sont supprimées : jamais une carte masquée par le filtre de type.
  const selectedShown = shown.filter((n) => selected.has(n.id));
  const allSelected = shown.length > 0 && selectedShown.length === shown.length;

  function startSelecting() {
    setFailure(null);
    setSelected(new Set());
    setSelectMode(true);
  }

  function stopSelecting() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmOpen(false);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(shown.map((n) => n.id)));
  }

  async function removeSelected() {
    const ids = selectedShown.map((n) => n.id);
    if (ids.length === 0 || deleting) return;
    setDeleting(true);
    setFailure(null);
    try {
      await deleteNotifications(ids);
      stopSelecting();
      refresh();
      list.reload();
      setToast(ids.length > 1 ? `${ids.length} notifications supprimées` : 'Notification supprimée');
    } catch (err) {
      setConfirmOpen(false);
      setFailure(describeDeleteError(err));
    } finally {
      setDeleting(false);
    }
  }

  // Ouvrir une notification non lue la marque comme lue : c'est la lire.
  function open(n: AppNotification) {
    setOpened(n);
    if (!isRead(n)) void markRead(n.id);
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Les messages qui vous sont adressés : transactions à traiter, alertes de sécurité, informations de la plateforme."
        actions={
          <div className="notif-actions hide-mobile">
            <Button variant="secondary" onClick={markAll} busy={allBusy} disabled={unread === 0 && unreadShown === 0}>
              Tout marquer comme lu
            </Button>
            <Button variant="secondary" icon="trash" onClick={startSelecting} disabled={selectMode || items.length === 0}>
              Supprimer
            </Button>
            <Button variant="secondary" onClick={() => { list.reload(); refresh(); }} busy={list.loading && list.data !== null}>
              Actualiser
            </Button>
          </div>
        }
      />

      {failure ? (
        <div className="stack stack--tight">
          <Notice
            tone="error"
            title="Action impossible"
            action={
              <button type="button" className="link-btn" onClick={() => setFailure(null)}>
                Fermer
              </button>
            }
          >
            {failure}
          </Notice>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="toolbar__filters toolbar__filters--inline">
          <FilterTabs
            id="notif-view"
            label="Filtrer les notifications"
            value={view}
            onChange={(next) => {
              setView(next);
              setLimit(FIRST);
            }}
            options={VIEW_OPTIONS}
          />
          <SelectField
            id="notif-type"
            label="Type"
            className="toolbar__select"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[{ value: '', label: 'Tous les types' }, ...TYPE_OPTIONS]}
          />
        </div>
        <RefreshButton
          onClick={() => {
            list.reload();
            refresh();
          }}
          busy={list.loading && list.data !== null}
        />
      </div>

      {list.loading && !list.data ? (
        <div className="center-block">
          <Spinner label="Chargement des notifications" />
        </div>
      ) : list.error && !list.data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les notifications"
            action={
              <button type="button" className="link-btn" onClick={list.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : shown.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="bell" size={26} />
          </span>
          <h2>{view === 'unread' ? 'Tout est lu' : type ? 'Aucune notification de ce type' : 'Aucune notification'}</h2>
          <p>
            {view === 'unread'
              ? 'Vous n’avez aucune notification non lue.'
              : type
                ? 'Essayez un autre type, ou affichez tous les types.'
                : 'Les nouvelles notifications apparaîtront ici.'}
          </p>
        </Card>
      ) : (
        <>
          {selectMode ? (
            <div className="notif-bar" role="group" aria-label="Sélection de notifications">
              <label className="notif-bar__all">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
              </label>
              <span className="notif-bar__count muted">
                {selectedShown.length} {plural(selectedShown.length, 'sélectionnée', 'sélectionnées')}
              </span>
              <div className="notif-bar__actions">
                <Button variant="secondary" onClick={stopSelecting} disabled={deleting}>
                  Annuler
                </Button>
                <Button
                  icon="trash"
                  className="btn--danger"
                  disabled={selectedShown.length === 0}
                  onClick={() => setConfirmOpen(true)}
                >
                  Supprimer{selectedShown.length > 0 ? ` (${selectedShown.length})` : ''}
                </Button>
              </div>
            </div>
          ) : (
            <div className="notif-summary">
              <p className="tx-summary">
                <strong>
                  {shown.length} {plural(shown.length, 'notification', 'notifications')}
                </strong>
                {unreadShown > 0 ? ` · ${unreadShown} ${plural(unreadShown, 'non lue', 'non lues')}` : ''}
              </p>
              <div className="notif-summary__links show-mobile">
                {unread > 0 || unreadShown > 0 ? (
                  <button type="button" className="link-btn" disabled={allBusy} onClick={() => void markAll()}>
                    Tout marquer comme lu
                  </button>
                ) : null}
                <button type="button" className="link-btn" onClick={startSelecting}>
                  Supprimer
                </button>
              </div>
            </div>
          )}
          <ul className="notif-list">
            {shown.map((n) => (
              <NotificationCard
                key={n.id}
                n={n}
                read={isRead(n)}
                onOpen={open}
                selectMode={selectMode}
                checked={selected.has(n.id)}
                onToggle={toggle}
              />
            ))}
          </ul>
          {mayHaveMore ? (
            <div className="more">
              <Button variant="secondary" busy={list.loading} onClick={() => setLimit(MAX)}>
                Afficher les notifications plus anciennes
              </Button>
            </div>
          ) : items.length >= MAX ? (
            <p className="muted more">Les {MAX} notifications les plus récentes sont affichées.</p>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={opened !== null}
        title={opened?.title ?? ''}
        confirmLabel="Fermer"
        hideCancel
        onConfirm={() => setOpened(null)}
        onCancel={() => setOpened(null)}
      >
        {opened ? <NotificationDetail n={opened} onNavigate={() => setOpened(null)} /> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmOpen}
        title={selectedShown.length > 1 ? `Supprimer ${selectedShown.length} notifications ?` : 'Supprimer cette notification ?'}
        confirmLabel="Supprimer"
        tone="danger"
        busy={deleting}
        onConfirm={() => void removeSelected()}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          {selectedShown.length > 1
            ? 'Ces notifications seront supprimées définitivement.'
            : 'Cette notification sera supprimée définitivement.'}
        </p>
      </ConfirmDialog>

      {toast ? (
        <div className="toast-center" role="status">
          <span>
            <Icon name="check" size={18} />
            {toast}
          </span>
        </div>
      ) : null}
    </>
  );
}
