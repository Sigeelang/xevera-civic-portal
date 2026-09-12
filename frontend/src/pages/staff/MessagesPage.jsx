import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Icon from '../../components/Icon';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import { useOnlineUsers } from '../../hooks/usePresence';

function initialsOf(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

/* Manager (Admin / Super Admin) Message Box filters */
const MANAGER_FILTERS = ['All', 'Unread', 'Residents', 'Staff', 'Admin', 'Contact'];
/*
 * Staff Message Box is strictly internal staff-to-management
 * communication - mirrors the direct_messages/send.php RBAC policy.
 */
const STAFF_FILTERS = ['All', 'Unread', 'Admin', 'Super Admin'];
const PAGE_SIZE = 9;

/* Role -> avatar colour */
function avatarColor(role) {
  if (role === 'Contact') return '#1769ed';
  if (role === 'Resident') return '#1769ed';
  if (role === 'Staff') return '#67c96c';
  if (role === 'Admin' || role === 'Super Admin') return '#8456db';
  return '#526582';
}

const MANILA_TZ = 'Asia/Manila';
function parseManila(created) {
  if (!created) return null;
  let s = String(created).trim().replace(' ', 'T');
  if (!/[Z+-]\d{2}:?\d{2}$/.test(s) && !s.endsWith('Z')) s += '+08:00';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function toManilaDateKey(d) {
  return d.toLocaleDateString('en-CA', { timeZone: MANILA_TZ });
}
function fmtListTime(created) {
  const d = parseManila(created);
  if (!d) return '';
  const now = new Date();
  const sameDay = toManilaDateKey(d) === toManilaDateKey(now);
  return sameDay
    ? d.toLocaleTimeString('en-US', { timeZone: MANILA_TZ, hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { timeZone: MANILA_TZ, month: 'short', day: 'numeric' });
}

function fmtBubbleTime(created) {
  const d = parseManila(created);
  return !d ? '' : d.toLocaleTimeString('en-US', { timeZone: MANILA_TZ, hour: 'numeric', minute: '2-digit' });
}

function dayLabel(created) {
  const d = parseManila(created);
  if (!d) return '';
  const now = new Date();
  const yDay = new Date(now.getTime() - 86400000);
  const dKey = toManilaDateKey(d);
  if (dKey === toManilaDateKey(now)) return 'Today';
  if (dKey === toManilaDateKey(yDay)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { timeZone: MANILA_TZ, month: 'long', day: 'numeric', year: 'numeric' });
}

const WORKFLOW_META = {
  New: { cls: 'bg-[#FFF4DF] text-[#D97706]', label: 'New' },
  'In Review': { cls: 'bg-[#F3E8FF] text-[#7C3AED]', label: 'In Review' },
  'In Progress': { cls: 'bg-[#EAF2FF] text-[#1769ED]', label: 'In Progress' },
  Resolved: { cls: 'bg-[#E7F8EF] text-[#159957]', label: 'Resolved' },
  Closed: { cls: 'bg-[#EEF1F5] text-[#5B6B82]', label: 'Closed' },
};
const WORKFLOW_OPTIONS = ['New', 'In Review', 'In Progress', 'Resolved', 'Closed'];

export default function MessagesPage({ onNavigate, onViewReport, initialFilter }) {
  const showToast = useToast();
  const { user } = useAuth();
  const isStaffUser = (user?.role || '') === 'Staff';
  const filters = isStaffUser ? STAFF_FILTERS : MANAGER_FILTERS;
  const onlineIds = useOnlineUsers();

  const [items, setItems] = useState(null);          /* raw direct messages */
  const [conversations, setConversations] = useState([]); /* grouped */
  const [contactItems, setContactItems] = useState(null);
  const [contactThread, setContactThread] = useState(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(
    MANAGER_FILTERS.includes(initialFilter) ? initialFilter : 'All'
  );
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);   /* direct-message partner id */
  const [selectedContact, setSelectedContact] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  /* New Message modal */
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composing, setComposing] = useState(false);

  /* Header "more" menu */
  const [moreOpen, setMoreOpen] = useState(false);

  const chatBodyRef = useRef(null);
  const isContactTab = filter === 'Contact';

  /* Contact-tab ticket status filter */
  const [contactStatus, setContactStatus] = useState('All');

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await apiFetch('direct_messages/list.php?limit=100');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
      setError(true);
    }
    try {
      const data = await apiFetch('contact/list.php?limit=100');
      setContactItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setContactItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /*
   * Real-time delivery: poll the lightweight updates endpoint every 2.5s.
   * New DMs merge straight into the list; a rising contact_unread count
   * (new public submission) triggers a full refresh so the ☎ toast and
   * list update too. A full refresh also runs as a 60s safety net.
   */
  const lastIdRef = useRef(0);
  const lastContactUnreadRef = useRef(null);
  useEffect(() => {
    if (items) {
      const maxId = items.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
      lastIdRef.current = Math.max(lastIdRef.current, maxId);
    }
  }, [items]);

  useEffect(() => {
    const poll = async () => {
      try {
        const d = await apiFetch(`direct_messages/updates.php?after_id=${lastIdRef.current}`);
        const fresh = Array.isArray(d?.items) ? d.items : [];
        if (fresh.length > 0) {
          lastIdRef.current = fresh.reduce((m, x) => Math.max(m, Number(x.id) || 0), lastIdRef.current);
          setItems((prev) => {
            const seen = new Set((prev || []).map((x) => x.id));
            return [...(prev || []), ...fresh.filter((x) => !seen.has(x.id))];
          });
        }
        const cu = d?.contact_unread;
        if (typeof cu === 'number') {
          if (lastContactUnreadRef.current !== null && cu > lastContactUnreadRef.current) {
            load(); /* new public contact submission - refresh list + toast */
          }
          lastContactUnreadRef.current = cu;
        }
      } catch { /* transient - next tick retries */ }
    };
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, [load]);

  /* Real-time: refresh the OPEN contact thread every 2.5s (resident replies) */
  useEffect(() => {
    if (!selectedContact) return undefined;
    const fetchThread = async () => {
      try {
        const d = await apiFetch(`contact/thread.php?id=${selectedContact.id}`);
        setContactThread(d?.messages ? d : { messages: [] });
      } catch { /* transient */ }
    };
    fetchThread();
    const t = setInterval(fetchThread, 2500);
    return () => clearInterval(t);
  }, [selectedContact?.id]);

  /* Safety net: full refresh every 60s */
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  /* Toast when a new contact-support submission arrives */
  const lastSeenContactRef = useRef(null);
  const isInitialContactLoad = useRef(true);
  useEffect(() => {
    if (!contactItems) return;
    const newest = contactItems.reduce((a, b) => (Number(b.id) > Number(a?.id ?? -1) ? b : a), null);
    if (newest) {
      const newestId = Number(newest.id);
      if (lastSeenContactRef.current !== null && newestId > Number(lastSeenContactRef.current) && !isInitialContactLoad.current) {
        showToast(`☎ New contact support message from ${newest.name || 'a resident'}`);
      }
      lastSeenContactRef.current = Math.max(Number(lastSeenContactRef.current ?? 0), newestId);
    }
    isInitialContactLoad.current = false;
  }, [contactItems, showToast]);

  /* Group direct messages into conversations keyed by the other user */
  useEffect(() => {
    if (!items) { setConversations([]); return; }
    const map = new Map();
    [...items]
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .forEach((m) => {
        const key = m.other_id;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: m.other_name,
            role: m.other_role || 'Staff',
            messages: [],
            unreadCount: 0,
          });
        }
        const convo = map.get(key);
        convo.messages.push(m);
        if (m.direction === 'received' && !m.is_read) convo.unreadCount += 1;
      });
    const list = [...map.values()].reverse(); /* most recent first */
    setConversations(list);
  }, [items]);

  /* Reset to page 1 when the list changes shape */
  useEffect(() => { setPage(1); }, [filter, search]);

  /* Staff never sees manager-only tabs (e.g. deep links with ?Contact) */
  useEffect(() => {
    if (isStaffUser && !STAFF_FILTERS.includes(filter)) setFilter('All');
  }, [isStaffUser, filter]);

  const selectedConversation = conversations.find((c) => String(c.id) === String(selectedId)) || null;

  /*
   * Chronological thread + scroll following.
   * Messages render oldest -> newest; when new messages arrive the view
   * follows automatically ONLY if the reader is near the bottom, otherwise
   * a "New messages" pill lets them jump down.
   */
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(false);

  function handleChatScroll() {
    const el = chatBodyRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    setAtBottom(near);
    if (near) setNewBelow(false);
  }

  function scrollToBottom() {
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
    setNewBelow(false);
  }

  const threadLength = selectedConversation?.messages?.length ?? 0;
  useEffect(() => {
    if (atBottom) scrollToBottom();
    else if (threadLength > 0 || (contactThread?.messages || []).length > 0) setNewBelow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadLength, selectedId, selectedContact?.id, (contactThread?.messages || []).length]);

  /* Auto-scroll chat body to the latest message while typing a reply */
  useEffect(() => {
    if (chatBodyRef.current && atBottom) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [reply, atBottom]);

  async function openConversation(convo) {
    setSelectedContact(null);
    setSelectedId(convo.id);
    setReply('');
    setAtBottom(true);
    setNewBelow(false);
    const unreadMsgs = convo.messages.filter((m) => m.direction === 'received' && !m.is_read);
    if (unreadMsgs.length > 0) {
      try {
        await Promise.all(unreadMsgs.map((m) =>
          apiFetch('direct_messages/read.php', { method: 'POST', body: { id: m.id } }).catch(() => {})
        ));
        load();
      } catch { /* best-effort */ }
    }
  }

  async function openContact(c) {
    setSelectedId(null);
    setSelectedContact(c);
    setContactThread(null);
    setReply('');
    setAtBottom(true);
    setNewBelow(false);
    if (c.status === 'new' || (c.unread_replies || 0) > 0) {
      try { await apiFetch('contact/read.php', { method: 'POST', body: { id: c.id } }); } catch {}
      load();
    }
    /* Fetch the full conversation thread (original + all replies) */
    try {
      const d = await apiFetch(`contact/thread.php?id=${c.id}`);
      setContactThread(d?.messages ? d : { messages: [] });
    } catch {
      setContactThread({ messages: [] });
    }
  }

  async function markConversationUnread() {
    if (!selectedConversation) return;
    try {
      await apiFetch('direct_messages/read.php', {
        method: 'POST',
        body: { unread: true, other_id: selectedConversation.id },
      });
      setMoreOpen(false);
      setSelectedId(null);
      showToast('Conversation marked as unread.', 'success', { priority: 1 });
      load();
    } catch (err) {
      showToast(err.message || 'Could not mark as unread.', 'error', { priority: 1 });
    }
  }

  function viewProfile() {
    if (!selectedConversation) return;
    setMoreOpen(false);
    if (selectedConversation.role === 'Resident' && onNavigate) {
      onNavigate('residents');
    } else if (onNavigate) {
      onNavigate(selectedConversation.role === 'Admin' || selectedConversation.role === 'Super Admin'
        ? 'users/administrators'
        : 'users/staff');
    }
  }

  async function sendReply(e) {
    e.preventDefault();

    if (selectedContact) {
      if (!reply.trim()) return;
      setSending(true);
      try {
        await apiFetch('contact/reply.php', {
          method: 'POST',
          body: { message_id: selectedContact.id, reply: reply.trim() },
        });
        setReply('');
        scrollToBottom();
        showToast(`Reply sent to ${selectedContact.name}.`, 'success', { priority: 1 });
        load();
        try {
          const d = await apiFetch(`contact/thread.php?id=${selectedContact.id}`);
          setContactThread(d?.messages ? d : { messages: [] });
        } catch { /* keep previous thread */ }
      } catch (err) {
        showToast(err.message || 'Could not send reply.', 'error', { priority: 1 });
      } finally {
        setSending(false);
      }
      return;
    }

    if (!selectedConversation || !reply.trim()) return;
    setSending(true);
    try {
      await apiFetch('direct_messages/send.php', {
        method: 'POST',
        body: {
          recipient_id: selectedConversation.id,
          message: reply.trim(),
          subject: selectedConversation.messages[selectedConversation.messages.length - 1]?.subject || '',
        },
      });
      setReply('');
      load();
      scrollToBottom();
      showToast('Reply sent successfully.', 'success', { priority: 1 });
    } catch (err) {
      showToast(err.message || 'Could not send message.', 'error', { priority: 1 });
    } finally {
      setSending(false);
    }
  }

  /* ================= New Message modal ================= */

  function openCompose() {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeOpen(true);
    apiFetch('direct_messages/recipients.php')
      .then((d) => setRecipients(Array.isArray(d) ? d : []))
      .catch(() => setRecipients([]));
  }

  async function submitCompose(e) {
    e.preventDefault();
    if (!composeTo) { showToast('Please select a recipient.', 'error', { priority: 1 }); return; }
    if (!composeBody.trim()) { showToast('Please enter a message.', 'error', { priority: 1 }); return; }
    setComposing(true);
    try {
      await apiFetch('direct_messages/send.php', {
        method: 'POST',
        body: {
          recipient_id: Number(composeTo),
          subject: composeSubject.trim(),
          message: composeBody.trim(),
        },
      });
      setComposeOpen(false);
      showToast('Message sent.', 'success', { priority: 1 });
      load();
    } catch (err) {
      showToast(err.message || 'Could not send message.', 'error', { priority: 1 });
    } finally {
      setComposing(false);
    }
  }

  /* ================= Derived lists ================= */

  const q = search.toLowerCase().trim();

  /*
   * Conversations visible to the current viewer. Staff accounts are
   * restricted to management (Admin / Super Admin) partners - matching
   * the backend direct_messages policy, not just the UI.
   */
  const scopedConversations = useMemo(() => (
    isStaffUser
      ? conversations.filter((c) => c.role === 'Admin' || c.role === 'Super Admin')
      : conversations
  ), [conversations, isStaffUser]);

  const visibleConversations = useMemo(() => scopedConversations
    .filter((c) => {
      if (filter === 'Unread') return c.unreadCount > 0;
      if (filter === 'Residents') return c.role === 'Resident';
      if (filter === 'Admin') return c.role === 'Admin';
      if (filter === 'Super Admin') return c.role === 'Super Admin';
      if (filter === 'Staff') return c.role === 'Staff';
      return true;
    })
    .filter((c) => {
      if (!q) return true;
      const last = c.messages[c.messages.length - 1];
      return (c.name + ' ' + (last?.subject || '') + ' ' + (last?.message || '')).toLowerCase().includes(q);
    }), [scopedConversations, filter, q]);

  /* Public Contact submissions - managers only */
  const visibleContacts = useMemo(() => (isStaffUser ? [] : (contactItems || []))
    .filter((c) => filter !== 'Unread' || c.status === 'new')
    .filter((c) => contactStatus === 'All' || (c.workflow_status || 'New') === contactStatus)
    .filter((c) =>
      !q || ((c.name || '') + ' ' + (c.subject || '') + ' ' + (c.message || '')).toLowerCase().includes(q)
    ), [contactItems, filter, q, contactStatus, isStaffUser]);

  /* Normalised rows so DMs and public contact submissions share one list. */
  const dmRows = useMemo(() => visibleConversations.map((c) => {
    const last = c.messages[c.messages.length - 1];
    return { key: 'dm' + c.id, kind: 'dm', c, sortTime: String(last?.created_at || '') };
  }), [visibleConversations]);

  const ctRows = useMemo(() => visibleContacts.map((c) => ({
    key: 'ct' + c.id, kind: 'ct', c, sortTime: String(c.date || c.created_at || ''),
  })), [visibleContacts]);

  const sourceRows = useMemo(() => {
    if (isContactTab) return ctRows;
    if (filter === 'Residents' || filter === 'Staff' || filter === 'Admin') return dmRows;
    /* All + Unread: merge DMs and contact-form submissions, newest first */
    return [...dmRows, ...ctRows].sort((a, b) => b.sortTime.localeCompare(a.sortTime));
  }, [isContactTab, filter, dmRows, ctRows]);

  const totalPages = Math.max(1, Math.ceil(sourceRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sourceRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = sourceRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (safePage - 1) * PAGE_SIZE + paged.length;

  /* Filter-pill counts */
  const allCount = scopedConversations.length + visibleContacts.length;
  const unreadCount =
    scopedConversations.filter((c) => c.unreadCount > 0).length +
    visibleContacts.filter((c) => c.status === 'new' || c.unread_replies > 0).length;

  const totalUnread = scopedConversations.reduce((n, c) => n + c.unreadCount, 0);
  const contactUnread = visibleContacts.filter((c) => c.status === 'new' || c.unread_replies > 0).length;
  const adminCount = scopedConversations.filter((c) => c.role === 'Admin').length;
  const superAdminCount = scopedConversations.filter((c) => c.role === 'Super Admin').length;
  const residentsCount = scopedConversations.filter((c) => c.role === 'Resident').length;
  const staffTabCount = scopedConversations.filter((c) => c.role === 'Staff').length;
  const contactCount = visibleContacts.length;
  const listLoading = isContactTab ? contactItems === null : items === null;

  /* Compact page numbers: 1 … (p-1) p (p+1) … last */
  const pageButtons = useMemo(() => {
    const t = totalPages;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, t - 1, t]);
    const nums = [...set].filter((n) => n >= 1 && n <= t).sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  }, [totalPages, safePage]);

  const replyTargetName = selectedContact
    ? (selectedContact.name || 'Anonymous')
    : selectedConversation?.name;

  return (
    <div className="flex-1 flex flex-col space-y-5 min-h-0">
      <StaffPageHeader
        eyebrow="Communications"
        title="Message Box"
        description={isStaffUser
          ? 'Direct messages with your Admin and Super Admin.'
          : 'Direct messages with admins, staff, residents, or the public contact form.'}
        actions={
          <div className="flex items-center gap-2.5">
            {(isContactTab ? contactUnread : totalUnread) > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-xevera-600 text-white text-xs font-bold">
                {isContactTab ? `${contactUnread} new` : `${totalUnread} unread`}
              </span>
            )}
            <button onClick={openCompose}
              className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-[9px] bg-[#1769ed] text-white text-sm font-bold hover:bg-[#0959d6] transition-all hover:-translate-y-px shadow-[0_6px_16px_rgba(23,105,237,0.2)] cursor-pointer">
              <span>＋</span> New Message
            </button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 flex flex-col bg-white border border-[#dce5f1] rounded-[14px] shadow-[0_5px_20px_rgba(28,58,102,0.06)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[535px_minmax(0,1fr)] lg:h-[calc(100vh-230px)] lg:min-h-[560px]">
          {/* ================= SIDEBAR ================= */}
          <aside className={`border-b lg:border-b-0 lg:border-r border-[#dce5f1] flex-col min-h-0 min-w-0 bg-white ${(selectedId || selectedContact) ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex flex-wrap gap-2 px-4 pt-5 pb-3">
              {filters.map((f) => {
                const count =
                  f === 'All' ? allCount
                  : f === 'Unread' ? unreadCount
                  : f === 'Admin' ? adminCount
                  : f === 'Super Admin' ? superAdminCount
                  : f === 'Residents' ? residentsCount
                  : f === 'Staff' ? staffTabCount
                  : f === 'Contact' ? contactCount
                  : null;
                return (
                  <button key={f} onClick={() => { setFilter(f); setSelectedId(null); setSelectedContact(null); }}
                    className={`h-[38px] px-[14px] rounded-[9px] text-[13px] font-semibold transition-colors cursor-pointer border whitespace-nowrap ${
                      filter === f ? 'bg-[#1769ed] border-[#1769ed] text-white shadow-[0_5px_12px_rgba(23,105,237,0.18)]' : 'bg-white text-[#263c60] border-[#d9e3f1] hover:border-[#9dbce9]'
                    }`}>
                    {f === 'Contact' ? '☎ Contact' : f}
                    {count !== null && <span className="ml-1 text-[11px]">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center h-[42px] mx-4 mb-3 border border-[#d9e3f1] rounded-[9px] overflow-hidden bg-white focus-within:border-[#1769ed]">
              <span className="pl-3 text-[#7890b1]">⌕</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="flex-1 h-full px-2.5 border-0 outline-none text-[13px] text-[#172b4d] bg-white placeholder:text-[#8ca0bc]" />
              <button type="button" title="Filter" onClick={() => setFilter('All')}
                className="w-[43px] h-full border-0 border-l border-[#e3eaf3] bg-white text-[#607594] hover:bg-[#f5f8fc] cursor-pointer">☷</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-1">
              {listLoading ? (
                <SkeletonRows rows={6} height="h-16" />
              ) : error ? (
                <StaffErrorState onRetry={load} />
              ) : paged.length === 0 ? (
                <div className="h-full min-h-[220px] flex items-center justify-center">
                  <StaffEmptyState title="No conversations found." description="Try another search or filter." />
                </div>
              ) : (
                paged.map((row) => {
                  const isCt = row.kind === 'ct';
                  const c = row.c;
                  const selected = isCt
                    ? selectedContact?.id === c.id
                    : String(selectedId) === String(c.id);
                  const last = isCt ? null : c.messages[c.messages.length - 1];
                  const isNew = isCt && (c.status === 'new' || (c.unread_replies || 0) > 0);
                  const unread = isCt ? (isNew ? (c.unread_replies || 1) : 0) : c.unreadCount;
                  return (
                    <button key={row.key}
                      onClick={() => (isCt ? openContact(c) : openConversation(c))}
                      className={`w-full flex items-center gap-3 py-4 px-2.5 text-left transition-colors cursor-pointer bg-white border-0 ${
                        selected
                          ? 'my-2 py-3.5 border border-[#c9dcfa] rounded-[10px] bg-[#f2f7ff]'
                          : 'border-b border-[#edf1f6] hover:bg-[#f8fbff]'
                      }`}>
                      <span className="relative w-10 h-10 flex-shrink-0 grid place-items-center rounded-full text-white text-xs font-extrabold"
                        style={{ background: isCt ? '#24b8c8' : avatarColor(c.role) }}>
                        {isCt ? (c.name || '?').charAt(0).toUpperCase() : initialsOf(c.name)}
                        {!isCt && (
                          <span className={`absolute -right-px bottom-px w-[9px] h-[9px] border-[1.5px] border-white rounded-full ${onlineIds.has(Number(c.id)) ? 'bg-[#20b86b]' : 'bg-[#AEB9C8]'}`} />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-[7px]">
                          <span className="max-w-[150px] overflow-hidden truncate text-sm font-bold text-[#142747]">{c.name || 'Anonymous'}</span>
                          {isCt && <span className="px-[7px] py-[3px] rounded-[5px] bg-[#edf4ff] text-[#1769ed] text-[10px] font-bold">Public Contact</span>}
                          {!isCt && c.unreadCount > 0 && <span className="w-1.5 h-1.5 bg-[#1769ed] rounded-full flex-shrink-0" />}
                          <span className="ml-auto text-[11px] text-[#687e9e] whitespace-nowrap">
                            {isCt ? fmtListTime(c.date) : fmtListTime(last?.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center mt-[5px]">
                          <span className="flex-1 min-w-0 overflow-hidden text-xs text-[#607594] truncate">
                            {isCt ? (
                              <>
                                {isNew && <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full mr-1.5 ${WORKFLOW_META.New.cls}`}>New</span>}
                                {c.subject || c.message}
                              </>
                            ) : (
                              <>
                                {last?.direction === 'sent' ? 'You: ' : ''}{last?.subject ? `${last.subject} — ` : ''}{last?.message}
                              </>
                            )}
                          </span>
                          {unread > 0 && (
                            <span className="w-[22px] h-[22px] flex-shrink-0 grid place-items-center rounded-full bg-[#1769ed] text-white text-[11px] font-extrabold">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="h-[70px] px-4 border-t border-[#e5ebf3] flex items-center justify-between text-xs text-[#647996]">
              <span>{sourceRows.length === 0 ? '0' : `${rangeStart} - ${rangeEnd}`} of {sourceRows.length} conversations</span>
              {totalPages > 1 && (
                <div className="flex gap-1.5">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                    className="w-9 h-9 grid place-items-center rounded-[8px] border border-[#d9e3f1] bg-white text-[#49617f] cursor-pointer disabled:opacity-40">‹</button>
                  {pageButtons.map((n, i) => n === '…' ? (
                    <span key={'e' + i} className="w-9 h-9 grid place-items-center text-[#9CA3AF]">…</span>
                  ) : (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-9 h-9 grid place-items-center rounded-[8px] border cursor-pointer ${
                        n === safePage ? 'border-[#1769ed] bg-[#1769ed] text-white' : 'border-[#d9e3f1] bg-white text-[#49617f] hover:bg-[#f5f8fc]'
                      }`}>{n}</button>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                    className="w-9 h-9 grid place-items-center rounded-[8px] border border-[#d9e3f1] bg-white text-[#49617f] cursor-pointer disabled:opacity-40">›</button>
                </div>
              )}
            </div>
          </aside>

          {/* ================= CHAT PANEL ================= */}
          <section className={`min-w-0 min-h-0 flex-col bg-white ${(selectedId || selectedContact) ? 'flex h-[calc(100dvh-250px)] min-h-[480px] lg:h-auto' : 'hidden lg:flex'}`}>
            {(selectedContact || selectedConversation) ? (
              <>
                {/* Chat header */}
                <div className="min-h-[112px] border-b border-[#e1e8f1] flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => { setSelectedId(null); setSelectedContact(null); }}
                      aria-label="Back to conversations"
                      className="lg:hidden w-11 h-11 rounded-xl border border-[#dce5f0] bg-white text-[#425676] grid place-items-center flex-shrink-0 cursor-pointer hover:bg-[#f5f8fc] transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="relative w-12 h-12 flex-shrink-0 grid place-items-center rounded-full text-white font-extrabold"
                      style={{ background: selectedContact ? '#24b8c8' : avatarColor(selectedConversation.role) }}>
                      {initialsOf(selectedContact ? selectedContact.name : selectedConversation.name)}
                      {(() => {
                        const targetId = selectedContact ? selectedContact.user_id : selectedConversation.id;
                        const isOnline = targetId ? onlineIds.has(Number(targetId)) : false;
                        return (
                          <span className={`absolute -right-px bottom-0.5 w-[11px] h-[11px] border-2 border-white rounded-full ${isOnline ? 'bg-[#20b86b]' : 'bg-[#AEB9C8]'}`} />
                        );
                      })()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-[9px]">
                        <h2 className="text-base font-bold text-[#122644] truncate m-0">
                          {selectedContact ? (selectedContact.name || 'Anonymous') : selectedConversation.name}
                        </h2>
                        {selectedContact && (
                          <span className="px-[7px] py-[3px] rounded-[5px] bg-[#edf4ff] text-[#1769ed] text-[10px] font-bold whitespace-nowrap">Public Contact</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-[5px] text-xs text-[#657b9a] truncate">
                        <span className="truncate">
                          {selectedContact
                            ? [selectedContact.email, selectedContact.phone].filter(Boolean).join(' · ')
                            : selectedConversation.role}
                        </span>
                        <span>•</span>
                        <span className="whitespace-nowrap">ID: #{selectedContact ? selectedContact.id : selectedConversation.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {!selectedContact && (
                      <button onClick={viewProfile} title="View profile"
                        className="w-10 h-10 grid place-items-center rounded-[8px] border border-[#dce5f0] bg-white text-[#526986] hover:bg-[#f5f8fc] transition-colors cursor-pointer">♙</button>
                    )}
                    <div className="relative">
                      <button onClick={() => setMoreOpen((v) => !v)} title="More actions"
                        className="w-10 h-10 grid place-items-center rounded-[8px] border border-[#dce5f0] bg-white text-[#526986] hover:bg-[#f5f8fc] transition-colors cursor-pointer">⋮</button>
                      {moreOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                          <div className="absolute right-0 top-[46px] w-[190px] bg-white border border-[#dce5f3] rounded-[10px] shadow-[0_15px_40px_rgba(23,45,85,0.15)] p-1.5 z-20 flex flex-col">
                            {selectedConversation && (
                              <button onClick={markConversationUnread}
                                className="w-full text-left px-3 py-2.5 rounded-[7px] border-0 bg-transparent text-xs font-semibold text-[#425676] hover:bg-[#f3f6fb] transition-colors cursor-pointer">
                                Mark as unread
                              </button>
                            )}
                            {selectedConversation?.role === 'Resident' && (
                              <button onClick={() => { setMoreOpen(false); onNavigate && onNavigate('residents'); }}
                                className="w-full text-left px-3 py-2.5 rounded-[7px] border-0 bg-transparent text-xs font-semibold text-[#425676] hover:bg-[#f3f6fb] transition-colors cursor-pointer">
                                View resident profile
                              </button>
                            )}
                            {selectedContact && (
                              <button onClick={() => { setMoreOpen(false); onNavigate && onNavigate('residents'); }}
                                className="w-full text-left px-3 py-2.5 rounded-[7px] border-0 bg-transparent text-xs font-semibold text-[#425676] hover:bg-[#f3f6fb] transition-colors cursor-pointer">
                                Open Residents Directory
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chat body */}
                <div ref={chatBodyRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto overflow-x-hidden px-[22px] py-6 relative">
                  {selectedContact ? (
                    <>
                      <div className="flex items-center gap-3.5 mb-[30px] text-xs font-semibold text-[#627794]">
                        <span className="h-px flex-1 bg-[#e6ebf2]" />{dayLabel(selectedContact.date)}<span className="h-px flex-1 bg-[#e6ebf2]" />
                      </div>
                      {/* Original Contact Support submission */}
                      <div className="flex items-end gap-2.5 mb-6">
                        <span className="w-[34px] h-[34px] flex-shrink-0 grid place-items-center rounded-full text-white text-[10px] font-extrabold" style={{ background: '#24b8c8' }}>
                          {(selectedContact.name || '?').charAt(0).toUpperCase()}
                        </span>
                        <div className="max-w-[min(70%,700px)] px-[17px] py-[15px] rounded-[12px] rounded-bl-[4px] border border-[#e0e7f0] bg-[#f5f7fa] box-border">
                          {selectedContact.subject && (
                            <div className="text-[11px] font-bold text-[#1769ed] mb-1">
                              {selectedContact.subject}{selectedContact.category ? ` · ${selectedContact.category}` : ''}
                            </div>
                          )}
                          <p className="m-0 text-[13px] leading-[1.55] text-[#172b4d] whitespace-normal break-word max-w-full box-border" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedContact.message}</p>
                          <div className="flex justify-end mt-2 text-[10px] text-[#7890ad]">{fmtBubbleTime(selectedContact.date)}</div>
                        </div>
                      </div>
                      {/* Real conversation thread: staff replies + resident replies */}
                      {(contactThread?.messages || []).map((m) => {
                        const mine = m.direction === 'sent';
                        return (
                          <div key={'tm' + m.id} className={`flex items-end gap-2.5 mb-6 ${mine ? 'justify-end' : ''}`}>
                            {!mine && (
                              <span className="w-[34px] h-[34px] flex-shrink-0 grid place-items-center rounded-full text-white text-[10px] font-extrabold bg-[#24b8c8]">
                                {initialsOf(m.sender_name)}
                              </span>
                            )}
                            <div className="max-w-[min(70%,700px)] px-[17px] py-[15px] rounded-[12px] bg-[#f5f7fa] box-border"
                              style={mine ? { background: '#eaf2ff', borderBottomRightRadius: '4px' } : { border: '1px solid #e0e7f0', borderBottomLeftRadius: '4px' }}>
                              <p className="m-0 text-[13px] leading-[1.55] text-[#172b4d] whitespace-normal break-word max-w-full box-border" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{m.message}</p>
                              <div className={`flex items-center justify-end gap-[5px] mt-2 text-[10px] text-[#7890ad] ${mine ? '' : ''}`}>
                                {fmtBubbleTime(m.created_at)}
                                {mine && <span className="text-[#1769ed]">{m.read_at ? '✓✓' : '✓'}</span>}
                              </div>
                            </div>
                            {mine && (
                              <span className="w-[34px] h-[34px] flex-shrink-0 grid place-items-center rounded-full text-white text-[10px] font-extrabold bg-xevera-600">
                                {initialsOf(m.sender_name)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {[...selectedConversation.messages]
                        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
                        .map((m, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showDivider = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                        const mine = m.direction === 'sent';
                        return (
                          <div key={m.id}>
                            {showDivider && (
                              <div className="flex items-center gap-3.5 mb-[30px] text-xs font-semibold text-[#627794]">
                                <span className="h-px flex-1 bg-[#e6ebf2]" />{dayLabel(m.created_at)}<span className="h-px flex-1 bg-[#e6ebf2]" />
                              </div>
                            )}
                            <div className={`flex items-end gap-2.5 mb-6 ${mine ? 'justify-end' : ''}`}>
                              {!mine && (
                                <span className="w-[34px] h-[34px] flex-shrink-0 grid place-items-center rounded-full text-white text-[10px] font-extrabold"
                                  style={{ background: avatarColor(m.other_role) }}>
                                  {initialsOf(m.other_name)}
                                </span>
                              )}
                              <div className="max-w-[min(70%,700px)] px-[17px] py-[15px] rounded-[12px] bg-[#f5f7fa] box-border"
                                style={mine
                                  ? { background: '#eaf2ff', borderBottomRightRadius: '4px' }
                                  : { border: '1px solid #e0e7f0', borderBottomLeftRadius: '4px' }}>
                                {m.subject && <div className="text-[11px] font-bold text-[#1769ed] mb-1">{m.subject}</div>}
                                {m.report_id && (
                                  <button onClick={() => onViewReport && onViewReport(m.report_id)}
                                    className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border-0 bg-white text-xevera-700">
                                    <Icon name="file" size={11} /> Report #{m.report_id}
                                  </button>
                                )}
                                <p className="m-0 text-[13px] leading-[1.55] text-[#172b4d] whitespace-normal break-word max-w-full box-border" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{m.message}</p>
                                <div className="flex items-center justify-end gap-[5px] mt-2 text-[10px] text-[#7890ad]">
                                  {fmtBubbleTime(m.created_at)}
                                {mine && <span className="text-[#1769ed]">{m.read_at ? '✓✓' : '✓'}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                       })}
                     </>
                   )}
                   {newBelow && (
                     <button onClick={scrollToBottom}
                       className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1769ed] text-white text-xs font-bold border-0 shadow-[0_6px_16px_rgba(23,105,237,0.3)] cursor-pointer hover:bg-[#0959d6] transition-colors">
                       ↓ New messages
                     </button>
                   )}
                 </div>

                 {/* Reply box */}
                <form onSubmit={sendReply} className="flex-shrink-0 border-t border-[#d9e3f0] px-4 sm:px-[22px] pt-4 pb-[max(18px,env(safe-area-inset-bottom))] bg-white">
                  <div className="mb-3 text-sm font-bold text-[#162a4a]">
                    Reply to <span>{replyTargetName}</span>
                  </div>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                    placeholder="Type your message..."
                    rows={3}
                    className="w-full min-h-[90px] max-h-[160px] overflow-y-auto resize-none p-[14px] rounded-[9px] border border-[#d9e3f0] outline-none text-[13px] text-[#172b4d] bg-white focus:border-[#1769ed] focus:ring-[3px] focus:ring-[#1769ff]/10 placeholder:text-[#8ca0bb]" />
                  <div className="flex items-center justify-end mt-2.5">
                    <button type="submit" disabled={sending || !reply.trim()}
                      className="inline-flex items-center gap-2 px-[18px] py-[11px] rounded-[8px] bg-[#1769ed] text-white text-[13px] font-bold border-0 hover:bg-[#0959d6] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer">
                      <span>➤</span> {sending ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center flex flex-col items-center gap-3 text-[#7c8ba4]">
                  <div className="w-[55px] h-[55px] rounded-full bg-[#f1f5fb] grid place-items-center text-2xl">
                    <Icon name="letter" size={22} />
                  </div>
                  <strong className="text-[#374151] text-sm">No conversation selected</strong>
                  <span className="text-[#9CA3AF] text-xs">Choose a conversation on the left to view and reply.</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ================= NEW MESSAGE MODAL ================= */}
      {composeOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-[rgba(12,29,58,0.42)] backdrop-blur-[2px]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setComposeOpen(false); }}>
          <form onSubmit={submitCompose} className="w-full max-w-[540px] overflow-hidden rounded-[14px] bg-white shadow-[0_25px_70px_rgba(0,0,0,0.2)]">
            <div className="px-6 py-[22px] border-b border-[#dce5f3] flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[#12254d] m-0">New Message</h2>
              <button type="button" aria-label="Close" onClick={() => setComposeOpen(false)}
                className="border-0 bg-transparent text-2xl text-[#647593] cursor-pointer leading-none">×</button>
            </div>

            <div className="p-6 space-y-[17px]">
              <label className="block">
                <span className="block text-[13px] font-bold mb-[7px] text-[#26364B]">Recipient</span>
                <select value={composeTo} onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full h-11 px-3 rounded-[9px] border border-[#d5dfed] text-sm bg-white text-[#111827] outline-none focus:border-[#1769ed] cursor-pointer">
                  <option value="">Select recipient</option>
                  {['Super Admin', 'Admin', 'Staff', 'Resident'].map((role) => {
                    const group = recipients.filter((u) => u.role === role);
                    if (group.length === 0) return null;
                    return (
                      <optgroup key={role} label={role}>
                        {group.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>

              <label className="block">
                <span className="block text-[13px] font-bold mb-[7px] text-[#26364B]">Subject</span>
                <input type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Enter subject"
                  className="w-full h-11 px-3.5 rounded-[9px] border border-[#d5dfed] text-sm text-[#111827] outline-none focus:border-[#1769ed] placeholder:text-[#94A3B8]" />
              </label>

              <label className="block">
                <span className="block text-[13px] font-bold mb-[7px] text-[#26364B]">Message</span>
                <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your message..." rows={5}
                  className="w-full p-3.5 rounded-[9px] border border-[#d5dfed] text-sm resize-y text-[#111827] outline-none focus:border-[#1769ed] placeholder:text-[#94A3B8]" />
              </label>
            </div>

            <div className="px-6 py-4 border-t border-[#dce5f3] flex justify-end gap-2.5 bg-[#FAFBFC]">
              <button type="button" onClick={() => setComposeOpen(false)}
                className="h-[42px] px-[18px] rounded-[9px] border border-[#cbdcff] bg-white text-[#1769ed] text-sm font-bold hover:bg-[#F1F6FF] cursor-pointer">Cancel</button>
              <button type="submit" disabled={composing}
                className="h-[42px] px-[18px] rounded-[9px] bg-[#1769ed] border-0 text-white text-sm font-bold hover:bg-[#0959d6] disabled:opacity-60 transition-colors cursor-pointer shadow-[0_6px_16px_rgba(23,105,237,0.2)]">
                <span className="mr-1.5">＋</span>{composing ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
