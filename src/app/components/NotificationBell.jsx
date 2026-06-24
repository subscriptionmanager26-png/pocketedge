import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  getUnreadNotificationCount,
  getVisibleNotifications,
  loadNotifications,
  markNotificationRead,
  markVisibleNotificationsRead,
  subscribeNotifications,
} from '../notificationStore';
import { loadSubscribedBasketIds, subscribeSubscriptions } from '../subscriptionStore';
import { navigateApp } from '../appRoute';

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(loadNotifications);
  const [subscribedIds, setSubscribedIds] = useState(loadSubscribedBasketIds);
  const panelRef = useRef(null);

  useEffect(() => {
    const syncNotifs = () => setNotifications(loadNotifications());
    const syncSubs = () => setSubscribedIds(loadSubscribedBasketIds());
    const unsubNotifs = subscribeNotifications(syncNotifs);
    const unsubSubs = subscribeSubscriptions(syncSubs);
    return () => {
      unsubNotifs();
      unsubSubs();
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const visible = getVisibleNotifications(subscribedIds);
  const unread = getUnreadNotificationCount(notifications, subscribedIds);

  const handleOpenItem = (item) => {
    markNotificationRead(item.id);
    setOpen(false);
    if (item.type === 'basket_update' && item.basketId) {
      navigateApp({ tab: 'basket', basketId: item.basketId, basketTab: 'updates' });
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-10 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-pe-text hover:text-pe-text transition-colors"
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-neutral-900 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-pe-border/80 bg-white shadow-xl shadow-black/10 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-pe-border/60">
            <h3 className="text-sm font-semibold text-pe-text">Notifications</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markVisibleNotificationsRead(subscribedIds)}
                className="text-xs font-medium text-pe-positive hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-pe-text-muted">
                No notifications yet
              </li>
            ) : (
              visible.map((item) => (
                <li key={item.id} className="border-b border-pe-border/40 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handleOpenItem(item)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-neutral-50 transition-colors ${
                      item.read ? '' : 'bg-neutral-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.read && (
                        <span className="mt-1.5 size-2 rounded-full bg-pe-positive shrink-0" />
                      )}
                      <div className={item.read ? 'pl-4' : ''}>
                        <p className="text-sm font-medium text-pe-text leading-snug">{item.title}</p>
                        <p className="text-xs text-pe-text-muted mt-1 leading-relaxed">{item.body}</p>
                        <p className="text-[10px] text-pe-text-muted mt-1.5 uppercase tracking-wide">
                          {formatWhen(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
