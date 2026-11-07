// src/components/NotificationBell.tsx
// Cloche de la barre du haut : pastille de notifications non lues + volet des dernières notifications.
// Le volet se ferme au clic extérieur, sur Échap, et à chaque changement de page.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { AppNotification } from '@direct-transfair/shared';
import { api } from '../lib/api';
import { when } from '../lib/dashboardRules';
import { useUnread } from '../providers/UnreadProvider';
import { useUrgent } from '../providers/UrgentProvider';
import { Icon } from './Icon';

const PEEK = 6;

export function NotificationBell() {
  const { unread, refresh } = useUnread();
  const { fresh } = useUrgent();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    api.notifications
      .list({ limit: PEEK })
      .then((list) => setItems(Array.isArray(list) ? list : []))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, load]);

  const openOne = (n: AppNotification) => {
    setOpen(false);
    if (!n.isRead) {
      void api.notifications
        .markRead(n.id)
        .then(refresh)
        .catch(() => undefined);
    }
    const txId = n.metadata && typeof n.metadata.transactionId === 'string' ? n.metadata.transactionId : null;
    navigate(txId ? `/transactions/${encodeURIComponent(txId)}` : '/notifications');
  };

  const readAll = () => {
    void api.notifications
      .markAllRead()
      .then(() => {
        refresh();
        load();
      })
      .catch(() => undefined);
  };

  const label = unread > 0 ? `Notifications : ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications';

  return (
    <div className="bell" ref={rootRef}>
      <button
        type="button"
        className={`icon-btn bell__btn${fresh > 0 ? ' is-ringing' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="bell" size={21} />
        {unread > 0 ? <b className="bell__badge">{unread > 99 ? '99+' : unread}</b> : fresh > 0 ? <i className="bell__dot" aria-hidden="true" /> : null}
      </button>

      {open ? (
        <div className="bell__panel" role="dialog" aria-label="Dernières notifications">
          <header className="bell__head">
            <strong>Notifications</strong>
            {unread > 0 ? (
              <button type="button" className="link-btn" onClick={readAll}>
                Tout marquer lu
              </button>
            ) : null}
          </header>

          {failed ? (
            <p className="bell__empty">
              Chargement impossible.{' '}
              <button type="button" className="link-btn" onClick={load}>
                Réessayer
              </button>
            </p>
          ) : items === null ? (
            <p className="bell__empty">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="bell__empty">Aucune notification pour le moment.</p>
          ) : (
            <ul className="bell__list">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`bell__item${n.isRead ? '' : ' is-unread'}`} onClick={() => openOne(n)}>
                    <span className="bell__dotmark" aria-hidden="true" />
                    <span className="bell__text">
                      <strong>{n.title}</strong>
                      <span>{n.message}</span>
                    </span>
                    <small>{when(n.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link to="/notifications" className="bell__all" onClick={() => setOpen(false)}>
            Voir toutes les notifications
            <Icon name="chevronRight" size={16} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
