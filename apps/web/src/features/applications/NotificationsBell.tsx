import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const list = items.status === 'ready' ? items.data : [];
  const unread = list.filter((n) => !n.read).length;

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close(false);
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && close(true);
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Move focus into the panel when it opens, so keyboard and screen-reader users land on its
  // content instead of staying on a now visually-replaced trigger button.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // A basic focus trap while the panel is open: Tab/Shift+Tab wraps between its first and last
  // focusable element instead of escaping to the rest of the page, as a "dialog" role implies.
  function trapTab(e: ReactKeyboardEvent) {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openItem(n: NotificationWithId) {
    if (!n.read) void markNotificationRead(uid, n.id).catch(() => {});
    setOpen(false);
    navigate(n.link);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
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
        <div
          className="sb-card sb-notif-panel"
          role="dialog"
          aria-label="Notifications"
          aria-modal="true"
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={trapTab}
        >
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
