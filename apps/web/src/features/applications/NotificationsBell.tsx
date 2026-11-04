import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
  type NotificationWithId,
} from './applicationsService';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString('en-ZA');
};

/** Top-bar bell: unread count, a panel of recent notifications, mark read / clear. */
export function NotificationsBell({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const items = useNotifications(uid);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = items.status === 'ready' ? items.data : [];
  const unread = list.filter((n) => !n.read).length;

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  function openItem(n: NotificationWithId) {
    if (!n.read) void markNotificationRead(uid, n.id).catch(() => {});
    setOpen(false);
    navigate(n.link);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="sb-icon-btn"
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{ position: 'relative' }}
      >
        <Bell className="icon" aria-hidden="true" />
        {unread > 0 && <span className="sb-notif-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="sb-card sb-notif-panel" role="dialog" aria-label="Notifications">
          <div className="sb-notif-head">
            <b>Notifications</b>
            {unread > 0 && (
              <button
                type="button"
                className="auth-link"
                onClick={() => void markAllNotificationsRead(uid, list).catch(() => {})}
              >
                Mark all read
              </button>
            )}
          </div>
          {items.status === 'error' ? (
            <p className="sb-meta" role="alert">
              {items.message}
            </p>
          ) : list.length === 0 ? (
            <p className="sb-meta" style={{ padding: '6px 0' }}>
              Nothing new. Updates about applications appear here.
            </p>
          ) : (
            <ul className="sb-notif-list">
              {list.slice(0, 20).map((n) => (
                <li key={n.id} className={n.read ? '' : 'unread'}>
                  <button type="button" className="sb-notif-item" onClick={() => openItem(n)}>
                    <b>{n.title}</b>
                    <span>{n.body}</span>
                    <small>{ago(n.createdAt)}</small>
                  </button>
                  <button
                    type="button"
                    className="sb-notif-clear"
                    aria-label={`Clear: ${n.title}`}
                    onClick={() => void deleteNotification(uid, n.id).catch(() => {})}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
