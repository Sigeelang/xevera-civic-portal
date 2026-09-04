import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from './AuthContext';
import usePolling from '../hooks/usePolling';

const ResidentNotificationsContext = createContext(null);

// Client-side notifications (e.g. "report submitted" confirmations) are kept
// in localStorage and merged with the server list. No backend changes needed.
const LOCAL_KEY = 'xevera.resident.localNotifs';

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLocal(list) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 20))); } catch {}
}

export function ResidentNotificationsProvider({ children, onViewReport, onOpenAnnouncement, onNavigate }) {
  const toast = useToast();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [localNotifs, setLocalNotifs] = useState(readLocal);
  // Tracks which server notification ids we've already seen so the
  // polling loop can detect brand-new arrivals and toast about them.
  const seenIds = useRef(null);

  /*
   * PHASE 2 — stale-state isolation.
   * The notifications poll is keyed on user identity, not the `user`
   * object reference, and every in-flight response is gated by an
   * epoch so a previous resident's notifications cannot surface on
   * a newly signed-in account.
   */
  const epochRef = useRef(0);

  const load = useCallback(() => {
    const myEpoch = epochRef.current;
    apiFetch('notifications/list.php?limit=50')
      .then((d) => {
        if (myEpoch !== epochRef.current) return; // identity changed mid-flight
        const items = Array.isArray(d?.items) ? d.items : [];
        setNotifs(items);

        // Realtime: toast when unseen unread notifications arrive.
        const ids = new Set(items.map((n) => String(n.id)));
        if (seenIds.current === null) {
          seenIds.current = ids;
        } else {
          const fresh = items.filter((n) => !n.read && !seenIds.current.has(String(n.id)));
          seenIds.current = ids;
          if (fresh.length > 0) {
            toast(
              fresh.length === 1
                ? `🔔 ${String(fresh[0].message || 'New notification').slice(0, 80)}`
                : `🔔 You have ${fresh.length} new notifications`
            );
          }
        }
      })
      .catch(() => {
        if (myEpoch !== epochRef.current) return;
        setNotifs([]);
      })
      .finally(() => {
        if (myEpoch !== epochRef.current) return;
        setLoading(false);
      });
  }, [toast]);

  // Keep notifications live without page refreshes.
  usePolling(load, 10000);

  // Merge local + server notifications; unread count includes both.
  useEffect(() => {
    const merged = [...localNotifs, ...notifs];
    setNotifUnread(merged.filter((n) => !n.read).length);
  }, [localNotifs, notifs]);

  // Initial fetch on mount.
  useEffect(() => {
    load();
  }, [load]);

  /*
   * On every identity change (login, logout, role switch) bump the
   * epoch and clear the server-side notification cache so the prior
   * resident's data cannot bleed into the new account.
   * localNotifs is per-browser and intentionally retained.
   */
  useEffect(() => {
    epochRef.current += 1;
    setNotifs([]);
    setNotifUnread(0);
    setLoading(true);
    seenIds.current = null;
  }, [user?.id, user?.role]);

  function pushLocal(message) {
    const item = {
      id: 'local_' + Date.now(),
      message,
      date: 'Just now',
      read: false,
      local: true,
    };
    const next = [item, ...readLocal()];
    writeLocal(next);
    setLocalNotifs(next);
  }

  function markRead(id) {
    if (String(id).startsWith('local_')) {
      const next = readLocal().map((n) => (n.id === id ? { ...n, read: true } : n));
      writeLocal(next);
      setLocalNotifs(next);
      return;
    }
    apiFetch('notifications/mark-read.php', { method: 'POST', body: { id } })
      .then(() => {
        setNotifs((ns) => ns.map((x) => (x.id === id ? { ...x, read: true } : x)));
      })
      .catch(() => {});
  }

  function markAllRead() {
    const next = readLocal().map((n) => ({ ...n, read: true }));
    writeLocal(next);
    setLocalNotifs(next);
    apiFetch('notifications/mark-read.php', { method: 'POST', body: { id: 'all' } })
      .then(() => {
        setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
      })
      .catch(() => {});
  }

  /*
   * Route a notification to the right page.
   * Returns the page key it navigated to (or null) so the caller
   * can close the dropdown panel after the click.
   */
  function openNotif(n) {
    if (!n) return null;
    if (!n.read) markRead(n.id);

    // 1) Announcement -> jump straight into the announcement detail.
    if (n.type === 'announcement' && n.announcement_id && onOpenAnnouncement) {
      onOpenAnnouncement(n.announcement_id);
      return 'announcements';
    }

    // 2) Direct message -> open the Message Box.
    if (n.type === 'direct_message') {
      if (onNavigate) onNavigate('messages');
      return 'messages';
    }

    // 3) Contact support reply -> back to the contact support page.
    if (n.type === 'contact' || n.type === 'contact_message' || n.type === 'contact_reply') {
      if (onNavigate) onNavigate('contact');
      return 'contact';
    }

    // 4) Anything tied to a report (status change, assignment, etc.)
    if (n.report_id && onViewReport) {
      onViewReport(n.report_id);
      return 'report-detail';
    }

    // 5) Fallback -> open the full notifications page.
    if (onNavigate) onNavigate('notifications');
    return 'notifications';
  }

  return (
    <ResidentNotificationsContext.Provider
      value={{ notifs, notifUnread, loading, load, markRead, markAllRead, openNotif, pushLocal }}
    >
      {children}
    </ResidentNotificationsContext.Provider>
  );
}

export function useResidentNotifications() {
  const ctx = useContext(ResidentNotificationsContext);
  if (!ctx) throw new Error('useResidentNotifications must be used within ResidentNotificationsProvider');
  return ctx;
}
