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
const PAGE_SIZE = 5;

/* Role -> avatar colour */
function avatarColor(role) {
  if (role === 'Contact') return '#1769ed';
  if (role === 'Resident') return '#1769ed';
  if (role === 'Staff') return '#67c96c';
  if (role === 'Admin' || role === 'Super Admin') return '#8456db';
  return '#526582';
}

/* Avatar initial class for mockup matching */
const AVATAR_COLORS = ['avatar-h', 'avatar-m', 'avatar-j', 'avatar-a', 'avatar-t', 'avatar-p', 'avatar-l', 'avatar-blue'];
function avatarInitialClass(name) {
  const first = String(name || '').charAt(0).toLowerCase();
  const map = { h: 'avatar-h', m: 'avatar-m', j: 'avatar-j', a: 'avatar-a', t: 'avatar-t', p: 'avatar-p', l: 'avatar-l' };
  return map[first] || 'avatar-blue';
}

/* Manager palette: deterministic solid avatar color per name */
const AV_PALETTE = ['av-blue', 'av-green', 'av-purple', 'av-orange', 'av-pink', 'av-teal'];
function avatarPalette(name) {
  const s = String(name || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV_PALETTE[h % AV_PALETTE.length];
}

/* Category tag styling */
const CATEGORY_TAGS = {
  maintenance: { cls: 'tag-maintenance', label: 'Maintenance' },
  emergency: { cls: 'tag-emergency', label: 'Emergency Contact' },
  general: { cls: 'tag-general', label: 'General Inquiry' },
  report: { cls: 'tag-report', label: 'Report Concern' },
  other: { cls: 'tag-other', label: 'Other' },
};

/* Colored tag per resident-submitted category (manager list rows) */
const MGR_TAG_CLS = {
  general: 'bg-[#e7f8ed] text-[#15934b]',
  report: 'bg-[#fff0e7] text-[#f36b2b]',
  account: 'bg-[#e6f2ff] text-[#1670d5]',
  maintenance: 'bg-[#ffe8e8] text-[#ee3636]',
  other: 'bg-[#eee8ff] text-[#7650d7]',
};
function managerTagClass(bucket) {
  return MGR_TAG_CLS[bucket] || MGR_TAG_CLS.other;
}

/* Map contact subjects to categories */
function inferCategory(subject, message) {
  const text = ((subject || '') + ' ' + (message || '')).toLowerCase();
  if (/street|light|water|plumb|mainten|repair|road|drain/.test(text)) return 'maintenance';
  if (/emergen|fire|flood|accident|urgent|immediate/.test(text)) return 'emergency';
  if (/report|complaint|violat|illegal/.test(text)) return 'report';
  if (/request|document|form|permit|certif|id|record/.test(text)) return 'documents';
  if (/account|password|login|otp|verify|reset|security/.test(text)) return 'account';
  if (/schedule|garbage|policy|info|ask|question|general/.test(text)) return 'general';
  return 'other';
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
function fmtListDate(created) {
  const d = parseManila(created);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { timeZone: MANILA_TZ, month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtListTime(created) {
  const d = parseManila(created);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { timeZone: MANILA_TZ, hour: 'numeric', minute: '2-digit' });
}

function fmtBubbleTime(created) {
  const d = parseManila(created);
  if (!d) return '';
  return d.toLocaleString('en-US', { timeZone: MANILA_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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

export default function MessagesPage({ onNavigate, onViewReport, initialFilter }) {
  const showToast = useToast();
  const { user } = useAuth();
  const isStaffUser = (user?.role || '') === 'Staff';
  const filters = isStaffUser ? STAFF_FILTERS : MANAGER_FILTERS;
  const onlineIds = useOnlineUsers();

  const [items, setItems] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [contactItems, setContactItems] = useState(null);
  const [contactThread, setContactThread] = useState(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(
    (isStaffUser ? STAFF_FILTERS : MANAGER_FILTERS).includes(initialFilter) ? initialFilter : 'All'
  );
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composing, setComposing] = useState(false);

  const [moreOpen, setMoreOpen] = useState(false);
  const [rowMenuKey, setRowMenuKey] = useState(null);

  const chatBodyRef = useRef(null);
  const isContactTab = filter === 'Contact';
  const [contactStatus, setContactStatus] = useState('All');
  const [subjectCategory, setSubjectCategory] = useState(null);
  const [recipientOpen, setRecipientOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await apiFetch('direct_messages/list.php?limit=100');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
      setError(true);
    }
    if (isStaffUser) {
      setContactItems([]);
    } else {
      try {
        const data = await apiFetch('contact/list.php?limit=100');
        setContactItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setContactItems([]);
      }
    }
  }, [isStaffUser]);

  useEffect(() => { load(); }, [load]);

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
        if (!isStaffUser && typeof cu === 'number') {
          if (lastContactUnreadRef.current !== null && cu > lastContactUnreadRef.current) {
            load();
          }
          lastContactUnreadRef.current = cu;
        }
      } catch {}
    };
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selectedContact) return undefined;
    const fetchThread = async () => {
      try {
        const d = await apiFetch(`contact/thread.php?id=${selectedContact.id}`);
        setContactThread(d?.messages ? d : { messages: [] });
      } catch {}
    };
    fetchThread();
    const t = setInterval(fetchThread, 2500);
    return () => clearInterval(t);
  }, [selectedContact?.id]);

  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const lastSeenContactRef = useRef(null);
  const isInitialContactLoad = useRef(true);
  useEffect(() => {
    if (isStaffUser) return;
    if (!contactItems) return;
    const newest = contactItems.reduce((a, b) => (Number(b.id) > Number(a?.id ?? -1) ? b : a), null);
    if (newest) {
      const newestId = Number(newest.id);
      if (lastSeenContactRef.current !== null && newestId > Number(lastSeenContactRef.current) && !isInitialContactLoad.current) {
        showToast(`New contact support message from ${newest.name || 'a resident'}`);
      }
      lastSeenContactRef.current = Math.max(Number(lastSeenContactRef.current ?? 0), newestId);
    }
    isInitialContactLoad.current = false;
  }, [contactItems, showToast, isStaffUser]);

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
    const list = [...map.values()].reverse();
    setConversations(list);
  }, [items]);

  useEffect(() => { setPage(1); setSubjectCategory(null); setRowMenuKey(null); }, [filter, search]);

  useEffect(() => {
    if (isStaffUser && !STAFF_FILTERS.includes(filter)) setFilter('All');
  }, [isStaffUser, filter]);

  const selectedConversation = conversations.find((c) => String(c.id) === String(selectedId)) || null;

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
  }, [threadLength, selectedId, selectedContact?.id, (contactThread?.messages || []).length]);

  useEffect(() => {
    if (chatBodyRef.current && atBottom) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [reply, atBottom]);

  async function openConversation(convo) {
    setSelectedContact(null);
    setSelectedId(convo.id);
    setRowMenuKey(null);
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
      } catch {}
    }
  }

  async function openContact(c) {
    setSelectedId(null);
    setSelectedContact(c);
    setRowMenuKey(null);
    setContactThread(null);
    setReply('');
    setAtBottom(true);
    setNewBelow(false);
    if (c.status === 'new' || (c.unread_replies || 0) > 0) {
      try { await apiFetch('contact/read.php', { method: 'POST', body: { id: c.id } }); } catch {}
      load();
    }
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
        } catch {}
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

  async function deleteRow(row) {
    const isCt = row.kind === 'ct';
    const c = row.c;
    const label = c.name || 'Anonymous';
    const ok = window.confirm(
      isCt
        ? `Delete this contact submission from ${label}? This cannot be undone.`
        : `Delete your conversation with ${label}? All messages between you two will be removed. This cannot be undone.`
    );
    if (!ok) return;
    try {
      if (isCt) {
        await apiFetch('contact/delete.php', { method: 'POST', body: { id: c.id } });
        if (selectedContact?.id === c.id) {
          setSelectedContact(null);
          setContactThread(null);
        }
        showToast('Contact submission deleted.', 'success', { priority: 1 });
      } else {
        await apiFetch('direct_messages/delete.php', { method: 'POST', body: { other_id: c.id } });
        if (String(selectedId) === String(c.id)) setSelectedId(null);
        showToast('Conversation deleted.', 'success', { priority: 1 });
      }
      load();
    } catch (err) {
      showToast(err.message || 'Could not delete.', 'error', { priority: 1 });
    }
  }

  function rowMenu(row) {
    const open = rowMenuKey === row.key;
    return (
      <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Conversation options"
          onClick={(e) => { e.stopPropagation(); setRowMenuKey(open ? null : row.key); }}
          className={`grid place-items-center border-0 bg-transparent font-bold leading-none cursor-pointer transition-colors ${
            isStaffUser
              ? 'w-6 h-6 rounded-[6px] text-[#5b6f89] text-[15px] hover:bg-[#eef3f9] hover:text-[#0878ed]'
              : 'w-6 h-6 rounded-[6px] text-[#1660ad] text-[19px] hover:bg-[#eef3f9] hover:text-[#0878ed]'
          }`}
        >
          ⋮
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-30 cursor-default" onClick={(e) => { e.stopPropagation(); setRowMenuKey(null); }} />
            <div className="absolute right-0 top-[26px] z-40 w-[150px] bg-white border border-[#dce5f3] rounded-[10px] shadow-[0_15px_40px_rgba(23,45,85,0.15)] p-1.5 flex flex-col">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRowMenuKey(null); deleteRow(row); }}
                className="w-full text-left px-3 py-2.5 rounded-[7px] border-0 bg-transparent text-xs font-semibold text-[#E65050] hover:bg-[#FFF4F4] transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

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

  const q = search.toLowerCase().trim();

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

  const visibleContacts = useMemo(() => (isStaffUser ? [] : (contactItems || []))
    .filter((c) => filter !== 'Unread' || c.status === 'new')
    .filter((c) => contactStatus === 'All' || (c.workflow_status || 'New') === contactStatus)
    .filter((c) => !subjectCategory || contactBucket(c) === subjectCategory)
    .filter((c) =>
      !q || ((c.name || '') + ' ' + (c.subject || '') + ' ' + (c.message || '')).toLowerCase().includes(q)
    ), [contactItems, filter, q, contactStatus, isStaffUser, subjectCategory]);

  const dmRows = useMemo(() => visibleConversations.map((c) => {
    const last = c.messages[c.messages.length - 1];
    return { key: 'dm' + c.id, kind: 'dm', c, sortTime: String(last?.created_at || '') };
  }), [visibleConversations]);

  const ctRows = useMemo(() => visibleContacts.map((c) => ({
    key: 'ct' + c.id, kind: 'ct', c, sortTime: String(c.date || c.created_at || ''),
  })), [visibleContacts]);

  const sourceRows = useMemo(() => {
    if (isContactTab) return ctRows;
    if (isStaffUser) return dmRows;
    if (filter === 'Residents' || filter === 'Staff' || filter === 'Admin' || filter === 'Super Admin') return dmRows;
    return [...dmRows, ...ctRows].sort((a, b) => b.sortTime.localeCompare(a.sortTime));
  }, [isContactTab, filter, dmRows, ctRows, isStaffUser]);

  const totalPages = Math.max(1, Math.ceil(sourceRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sourceRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = sourceRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (safePage - 1) * PAGE_SIZE + paged.length;

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

  const pageButtons = useMemo(() => {
    const t = totalPages;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, t - 1, t]);
    const nums = [...set].filter((n) => n >= 1 && n <= t).sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('...');
      out.push(n);
    });
    return out;
  }, [totalPages, safePage]);

  const replyTargetName = selectedContact
    ? (selectedContact.name || 'Anonymous')
    : selectedConversation?.name;

  /* Chat body + bubble sizing: managers follow the mockup proportions,
   * staff keep the compact layout. */
  const chatBodyPad = isStaffUser ? 'px-[18px] py-4' : 'px-[23px] py-5';
  const bubbleBase = isStaffUser
    ? 'px-[15px] py-[11px] text-[13px] leading-[1.55] max-w-[420px]'
    : 'px-[18px] py-[14px] text-[15px] leading-[1.5] max-w-[min(62%,520px)]';
  const msgGap = isStaffUser ? 'mb-[15px]' : 'mb-7';
  const msgAvatar = isStaffUser
    ? 'w-[38px] h-[38px] text-[15px]'
    : 'w-[50px] h-[50px] text-[18px]';
  const bubbleIn = isStaffUser ? 'bg-[#f0f6fc] text-[#213b5b]' : 'bg-[#eef5fc] text-[#082a5d]';
  const bubbleOut = isStaffUser
    ? 'bg-gradient-to-br from-[#0879ec] to-[#0569df] text-white'
    : 'bg-[#1288ef] text-white';
  const inAvatarBg = isStaffUser ? 'bg-[#10b5bb]' : 'bg-[#e7f3ff] text-[#087cf0]';

  /* Get the tag info for a conversation */
  function getConvoTag(c) {
    const last = c.messages[c.messages.length - 1];
    const cat = inferCategory(last?.subject, last?.message);
    return CATEGORY_TAGS[cat] || CATEGORY_TAGS.other;
  }

/* Map stored category to CATEGORY_TAGS key */
function mapStoredCategory(storedCategory) {
  if (!storedCategory) return null;
  const cat = String(storedCategory).toLowerCase();
  if (cat.includes('general')) return 'general';
  if (cat.includes('report')) return 'report';
  if (cat.includes('account') || cat.includes('support')) return 'account';
  if (cat.includes('technical') || cat.includes('issue')) return 'maintenance';
  if (cat.includes('other')) return 'other';
  return null;
}

/* Every contact must land in one of the 5 filterable buckets.
 * Stored value wins (incl. legacy "Support" -> Account Support);
 * inference leftovers without a button (emergency/documents)
 * fall into the Other catch-all so nothing is unfilterable. */
function contactBucket(c) {
  const stored = mapStoredCategory(c.category);
  if (stored) return stored;
  const inf = inferCategory(c.subject, c.message);
  if (inf === 'emergency' || inf === 'documents') return 'other';
  return inf;
}

/* Get the tag info for a contact item */
function getContactTag(c) {
  const storedCat = mapStoredCategory(c.category);
  const cat = storedCat || inferCategory(c.subject, c.message);
  return CATEGORY_TAGS[cat] || CATEGORY_TAGS.other;
}

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <style>{`
        .tag-maintenance { background: #e6f2ff; color: #1670d5; }
        .tag-emergency { background: #ffe8e8; color: #ee3636; }
        .tag-general { background: #e7f8ed; color: #15934b; }
        .tag-report { background: #fff0e7; color: #f36b2b; }
        .tag-other { background: #eee8ff; color: #7650d7; }
        .avatar-h { background: #0db6bd; }
        .avatar-m { background: #8752e6; }
        .avatar-j { background: #16ae61; }
        .avatar-a { background: #ff7210; }
        .avatar-t { background: #2b9de1; }
        .avatar-p { background: #15b8bd; }
        .avatar-l { background: #f02768; }
        .avatar-blue { background: #2478e8; }
        .av-blue { background: #1e9bdc; }
        .av-green { background: #10b76b; }
        .av-purple { background: #7b46e4; }
        .av-orange { background: #d87518; }
        .av-pink { background: #e83d91; }
        .av-teal { background: #18b7c5; }
        .chat-scroll { scrollbar-width: thin; scrollbar-color: #a5b4c4 #f1f6fb; }
        .chat-scroll::-webkit-scrollbar { width: 9px; }
        .chat-scroll::-webkit-scrollbar-track { background: #f1f6fb; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #a5b4c4; border-radius: 8px; border: 2px solid #f1f6fb; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: #7e92a8; }
      `}</style>

      <div className={isStaffUser
        ? "flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)] gap-0 bg-white border border-[#e0e8f1] rounded-[12px] overflow-hidden lg:flex-none lg:h-[calc(100dvh-150px)] lg:min-h-[600px]"
        : "flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-[10px] overflow-hidden items-stretch lg:flex-none lg:h-[calc(100vh-120px)] lg:min-h-0"
      }>
        {/* ================= CONVERSATIONS PANEL ================= */}
        <aside className={isStaffUser
          ? `flex-col min-h-0 min-w-0 max-h-[55vh] lg:max-h-none bg-white border-b lg:border-b-0 lg:border-r border-[#e4eaf1] ${(selectedId || selectedContact) ? 'hidden lg:flex' : 'flex'}`
          : `flex-col min-h-0 min-w-0 max-h-[55vh] lg:max-h-none gap-[9px] bg-transparent overflow-hidden lg:h-full ${(selectedId || selectedContact) ? 'hidden lg:flex' : 'flex'}`
        }>
          {/* Category Filters */}
          {isStaffUser ? (
          <>
          <div className="category-area px-4 pt-4 pb-2 shrink-0">
            {/* Row 1: Role filters */}
            <div className="category-row flex flex-wrap gap-[7px] mb-2">
              {[
                { key: 'All', count: allCount },
                { key: 'Unread', count: unreadCount },
                ...(isStaffUser
                  ? [{ key: 'Admin', count: adminCount }, { key: 'Super Admin', count: superAdminCount }]
                  : [{ key: 'Residents', count: residentsCount }, { key: 'Staff', count: staffTabCount }, { key: 'Admin', count: adminCount }, { key: 'Super Admin', count: superAdminCount }, { key: 'Contact', count: contactCount }]
                ),
              ].map(({ key, count }) => (
                <button key={key}
                  onClick={() => { setFilter(key); setSelectedId(null); setSelectedContact(null); }}
                  className={`h-[36px] px-4 rounded-[8px] text-[12px] font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                    filter === key
                      ? 'bg-[#0874e5] text-white border-[#0874e5] shadow-[0_2px_6px_rgba(8,116,229,0.18)]'
                      : 'bg-white text-[#1e3a5f] border-[#d0dceb] hover:border-[#8ab4f8] hover:bg-[#f8faff]'
                  }`}>
                  {key}
                  <span className={`ml-2 px-[7px] py-[1px] rounded-[10px] text-[10px] font-bold ${
                    filter === key ? 'bg-[rgba(255,255,255,0.2)] text-white' : 'bg-[#eef4fb] text-[#0874e5]'
                  }`}>{count}</span>
                </button>
              ))}
            </div>

            {/* Row 2: Subject categories (contact submissions only - managers) */}
            {!isStaffUser && (
            <div className="category-row flex flex-wrap gap-2">
              {[
                { label: 'General Inquiry', cat: 'general' },
                { label: 'Report Assistance', cat: 'report' },
                { label: 'Account Support', cat: 'account' },
                { label: 'Technical Issue', cat: 'maintenance' },
                { label: 'Other', cat: 'other' },
              ].map(({ label, cat }) => {
                const count = (contactItems || []).filter((c) => mapStoredCategory(c.category) === cat || inferCategory(c.subject, c.message) === cat).length;
                return (
                  <button key={label}
                    onClick={() => {
                      const next = subjectCategory === cat ? null : cat;
                      setSubjectCategory(next);
                      setPage(1);
                    }}
                    className={`h-[32px] px-3 rounded-[8px] text-[11px] font-medium whitespace-nowrap border cursor-pointer transition-all ${
                      subjectCategory === cat
                        ? 'border-[#0874e5] bg-[#edf5ff] text-[#0874e5]'
                        : 'border-[#e4ebf3] bg-white text-[#4a5f7a] hover:border-[#a8c8ec] hover:bg-[#f8faff]'
                    }`}>
                    {label}
                    <span className={`ml-2 px-[6px] py-[0.5px] rounded-[10px] text-[10px] font-bold ${
                      subjectCategory === cat ? 'bg-[#0874e5] text-white' : 'bg-[#eef4fb] text-[#0874e5]'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* Search */}
            <div className="flex items-center gap-2 mx-4 mb-3 flex-shrink-0">
              <div className="flex flex-1 min-w-0 items-center h-[40px] border border-[#d0dceb] rounded-[8px] overflow-hidden bg-white">
                <span className="pl-3 text-[#8ca0bc] text-[18px] leading-none">⌕</span>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="flex-1 h-full px-3 border-0 outline-none text-[12px] text-[#1e3a5f] bg-transparent placeholder:text-[#94a3b8]" />
              </div>
              <button
                onClick={openCompose}
                className="h-[40px] px-3 flex-shrink-0 rounded-[8px] bg-[#0878ed] text-white text-[12px] font-semibold border-0 shadow-[0_5px_12px_rgba(8,120,237,0.18)] hover:bg-[#066bd5] transition-all cursor-pointer whitespace-nowrap"
              >
                ＋ New Message
              </button>
            </div>
          </>
          ) : (
          <>
            {/* RECIPIENT FILTERS (managers) */}
            <section className="bg-white border border-[#d8e5f2] rounded-[11px] overflow-hidden flex-shrink-0">
              <div className="h-[52px] px-[17px] flex items-center justify-between">
                <strong className="text-[14px] font-extrabold text-[#092858]">Recipient Filters</strong>
                <button onClick={() => setRecipientOpen((v) => !v)} aria-label="Toggle recipient filters"
                  className="border-0 bg-none text-[#153c70] text-[18px] leading-none cursor-pointer">{recipientOpen ? '⌃' : '⌄'}</button>
              </div>
              {recipientOpen && (
              <div className="px-4 pb-3 grid grid-cols-2 gap-x-[9px] gap-y-[7px]">
                {[
                  { key: 'All', count: allCount },
                  { key: 'Unread', count: unreadCount },
                  { key: 'Residents', count: residentsCount },
                  { key: 'Staff', count: staffTabCount },
                  { key: 'Admin', count: adminCount },
                  { key: 'Super Admin', count: superAdminCount },
                  { key: 'Contact', count: contactCount },
                ].map(({ key, count }) => (
                  <button key={key}
                    onClick={() => { setFilter(key); setSelectedId(null); setSelectedContact(null); }}
                    className={`h-[39px] flex items-center justify-between px-3 rounded-[10px] text-[12px] font-bold whitespace-nowrap border cursor-pointer transition-all ${
                      filter === key
                        ? 'bg-[#f3f9ff] text-[#0874dd] border-[#087cf0]'
                        : 'bg-white text-[#092858] border-[#d4e2f1] hover:border-[#087cf0]'
                    }`}>
                    <span className="truncate">{key}</span>
                    <b className="min-w-[25px] h-[25px] rounded-[14px] bg-[#edf3f9] grid place-items-center text-[10px] font-bold text-center flex-shrink-0">{count}</b>
                  </button>
                ))}
              </div>
              )}
            </section>

            {/* MESSAGE CATEGORIES (managers) */}
            <section className="bg-white border border-[#d8e5f2] rounded-[11px] overflow-hidden flex-shrink-0">
              <div className="h-[52px] px-[17px] flex items-center justify-between">
                <strong className="text-[14px] font-extrabold text-[#092858]">Message Categories</strong>
                <button onClick={() => setCategoriesOpen((v) => !v)} aria-label="Toggle message categories"
                  className="border-0 bg-none text-[#153c70] text-[18px] leading-none cursor-pointer">{categoriesOpen ? '⌃' : '⌄'}</button>
              </div>
              {categoriesOpen && (
              <div className="px-4 pb-3 grid grid-cols-2 gap-x-[9px] gap-y-[7px]">
                {[
                  { label: 'General Inquiry', cat: 'general' },
                  { label: 'Report Assistance', cat: 'report' },
                  { label: 'Account Support', cat: 'account' },
                  { label: 'Technical Issue', cat: 'maintenance' },
                  { label: 'Other', cat: 'other' },
                ].map(({ label, cat }) => {
                const count = (contactItems || []).filter((c) => contactBucket(c) === cat).length;
                  return (
                    <button key={label}
                      onClick={() => {
                        const next = subjectCategory === cat ? null : cat;
                        setSubjectCategory(next);
                        setPage(1);
                      }}
                      className={`h-[39px] flex items-center justify-between px-3 rounded-[10px] text-[12px] font-bold whitespace-nowrap border cursor-pointer transition-all ${
                        subjectCategory === cat
                          ? 'bg-[#f3f9ff] text-[#0874dd] border-[#087cf0]'
                          : 'bg-white text-[#092858] border-[#d4e2f1] hover:border-[#087cf0]'
                      }`}>
                      <span className="truncate">{label}</span>
                      <b className="min-w-[25px] h-[25px] rounded-[14px] bg-[#edf3f9] grid place-items-center text-[10px] font-bold text-center flex-shrink-0">{count}</b>
                    </button>
                  );
                })}
              </div>
              )}
            </section>

            {/* SEARCH + NEW MESSAGE (managers) */}
            <div className="h-[48px] flex gap-2 flex-shrink-0">
              <div className="flex-1 min-w-0 border border-[#cfdeef] rounded-[10px] bg-white flex items-center px-[11px]">
                <span className="text-[20px] mr-[7px] text-[#587aa2] leading-none">⌕</span>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full border-0 outline-none bg-transparent text-[12px] text-[#092858] placeholder:text-[#8096ad]" />
              </div>
              <button
                onClick={openCompose}
                className="w-[140px] flex-shrink-0 border-0 rounded-[10px] bg-[#087cf0] text-white font-extrabold text-[12px] hover:bg-[#066bd5] transition-all cursor-pointer whitespace-nowrap"
              >
                ＋ New Message
              </button>
            </div>
          </>
          )}

          {/* Conversation List - visible scroll box */}
          <div className={isStaffUser
            ? "chat-scroll flex-1 min-h-0 overflow-y-auto border border-[#d8e5f2] rounded-[10px] bg-white"
            : "chat-scroll flex-1 min-h-0 overflow-y-auto bg-white border border-[#d8e5f2] rounded-[10px]"
          }>
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
                const tag = isCt ? getContactTag(c) : getConvoTag(c);
                const avatarBg = isCt ? 'avatar-t' : avatarInitialClass(c.name);
                const previewText = isCt
                  ? (c.subject || c.message)
                  : (last?.direction === 'sent' ? 'You: ' : '') + (last?.subject ? `${last.subject} — ` : '') + (last?.message || '');
                const dateStr = isCt ? (c.date || c.created_at) : (last?.created_at);
                const mgrCategory = isCt ? (c.category || tag.label) : tag.label;
                const mgrBucket = isCt ? contactBucket(c) : (Object.keys(CATEGORY_TAGS).find((k) => CATEGORY_TAGS[k] === tag) || 'other');
                const openRow = () => (isCt ? openContact(c) : openConversation(c));
                if (!isStaffUser) {
                  return (
                    <div
                      key={row.key}
                      role="button"
                      tabIndex={0}
                      onClick={openRow}
                      onKeyDown={(e) => { if (e.key === 'Enter') openRow(); }}
                      data-name={c.name || ''}
                      data-category={mgrCategory}
                      data-preview={previewText}
                      data-email={isCt ? (c.email || '') : ''}
                      className={`w-full flex items-center gap-[11px] px-3 py-[9px] border-0 border-b border-[#e6eef6] text-left cursor-pointer transition-colors outline-none ${
                        selected ? 'bg-[#edf7ff]' : 'bg-white hover:bg-[#f7fbff]'
                      }`}
                      style={{ minHeight: '68px' }}
                    >
                      <div className={`relative w-[38px] h-[38px] flex-shrink-0 rounded-full flex items-center justify-center text-white text-[14px] font-extrabold ${avatarPalette(c.name)}`}>
                        {isCt ? initialsOf(c.name) : initialsOf(c.name)}
                        {!isCt && (
                          <span className={`absolute -right-px bottom-px w-[9px] h-[9px] border-[1.5px] border-white rounded-full ${onlineIds.has(Number(c.id)) ? 'bg-[#16b861]' : 'bg-[#AEB9C8]'}`} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-[7px] min-w-0">
                          <span className="text-[13px] font-extrabold text-[#092858] whitespace-nowrap overflow-hidden text-ellipsis">{c.name || 'Anonymous'}</span>
                          <span className={`flex-shrink-0 text-[10px] font-bold rounded-[10px] px-[7px] py-[3px] whitespace-nowrap ${managerTagClass(mgrBucket)}`}>{mgrCategory}</span>
                        </div>
                        <div className="text-[12px] mt-[5px] whitespace-nowrap overflow-hidden text-ellipsis text-[#526f8b]">{previewText}</div>
                      </div>
                      <div className="flex flex-col items-end text-[10px] leading-[1.4] text-[#6681a5] whitespace-nowrap flex-shrink-0">
                        <span>{fmtListDate(dateStr)}</span>
                        <span>{fmtListTime(dateStr)}</span>
                        {unread > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-[#087cf0] text-white text-[10px] font-bold mt-1">
                            {unread}
                          </span>
                        )}
                      </div>
                      {rowMenu(row)}
                    </div>
                  );
                }
                return (
                  <div
                    key={row.key}
                    onClick={openRow}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#e8f3ff]'
                        : 'hover:bg-[#f5fbff] border-t border-[#edf3f8]'
                    }`}
                    style={{ minHeight: '64px' }}
                  >
                    <div className={`relative w-[40px] h-[40px] flex-shrink-0 rounded-full flex items-center justify-center text-white text-[14px] font-semibold ${avatarBg} mt-0.5`}>
                      {isCt ? (c.name || '?').charAt(0).toUpperCase() : initialsOf(c.name)}
                      {!isCt && (
                        <span className={`absolute -right-0.5 bottom-0.5 w-[8px] h-[8px] border-[1.5px] border-white rounded-full ${onlineIds.has(Number(c.id)) ? 'bg-[#16b861]' : 'bg-[#AEB9C8]'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-bold text-[#142b49] truncate">{c.name || 'Anonymous'}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[9px] font-semibold ${tag.cls}`}>
                          {tag.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5d738e] truncate">{previewText}</div>
                    </div>
                    <div className="w-[70px] text-right self-start flex-shrink-0 pt-0.5">
                      <div className="text-[10px] text-[#6d829c] leading-[1.5]">
                        {fmtListDate(dateStr)}<br />
                        {fmtListTime(dateStr)}
                      </div>
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center w-[20px] h-[20px] rounded-full bg-[#0874e5] text-white text-[10px] font-bold mt-1">
                          {unread}
                        </span>
                      )}
                    </div>
                    {rowMenu(row)}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer / Pagination */}
          <div className={isStaffUser
            ? "h-[43px] shrink-0 border-t border-[#e4ebf2] flex items-center justify-between px-4 text-[12px] text-[#435b79]"
            : "h-[55px] shrink-0 bg-white border border-[#d8e5f2] rounded-[10px] flex items-center px-[10px] text-[12px] text-[#092858]"
          }>
            <span>
              {sourceRows.length === 0 ? '0' : `${rangeStart} - ${rangeEnd}`} of {sourceRows.length} conversations
            </span>
            {totalPages > 1 && (
              <div className="ml-auto flex gap-[7px]">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="w-[37px] h-[36px] grid place-items-center rounded-[9px] border border-[#d6e3f1] bg-white text-[#204576] text-[12px] cursor-pointer disabled:opacity-40">‹</button>
                {pageButtons.map((n, i) => n === '...' ? (
                  <span key={'e' + i} className="w-[37px] h-[36px] grid place-items-center text-[#9CA3AF]">...</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)}
                    className={`w-[37px] h-[36px] grid place-items-center rounded-[9px] border text-[12px] cursor-pointer ${
                      n === safePage ? 'border-[#087cf0] bg-[#087cf0] text-white' : 'border-[#d6e3f1] bg-white text-[#204576]'
                    }`}>{n}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="w-[37px] h-[36px] grid place-items-center rounded-[9px] border border-[#d6e3f1] bg-white text-[#204576] text-[12px] cursor-pointer disabled:opacity-40">›</button>
              </div>
            )}
          </div>
        </aside>

        {/* ================= CHAT PANEL ================= */}
        <section className={isStaffUser
          ? `min-w-0 min-h-0 h-[calc(100dvh-260px)] min-h-[520px] lg:h-full flex-col bg-white ${(selectedId || selectedContact) ? 'flex' : 'hidden lg:flex'}`
          : `min-w-0 min-h-0 h-[calc(100dvh-260px)] min-h-[520px] lg:h-full flex-col bg-white border border-[#d8e5f2] rounded-[11px] overflow-hidden ${(selectedId || selectedContact) ? 'flex' : 'hidden lg:flex'}`
        }>
          {(selectedContact || selectedConversation) ? (
            <>
              {/* Chat Header */}
              <div className={isStaffUser
                ? "h-[69px] shrink-0 border-b border-[#e4eaf1] flex items-center px-[18px]"
                : "h-[82px] shrink-0 border-b border-[#d8e5f2] flex items-center px-[21px]"
              }>
                <button
                  type="button"
                  onClick={() => { setSelectedId(null); setSelectedContact(null); }}
                  aria-label="Back to conversations"
                  className="lg:hidden w-11 h-11 rounded-xl border border-[#dce5f0] bg-white text-[#425676] grid place-items-center flex-shrink-0 cursor-pointer hover:bg-[#f5f8fc] transition-colors mr-3"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                </button>
                <div className={isStaffUser
                  ? `w-[44px] h-[44px] rounded-full flex items-center justify-center text-white text-[17px] mr-3 flex-shrink-0 ${selectedContact ? 'avatar-t' : avatarInitialClass(selectedConversation.name)}`
                  : `w-[57px] h-[57px] rounded-full flex items-center justify-center text-white text-[20px] font-extrabold mr-4 flex-shrink-0 ${avatarPalette(selectedContact ? selectedContact.name : selectedConversation.name)}`
                }>
                  {initialsOf(selectedContact ? selectedContact.name : selectedConversation.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={isStaffUser ? "text-[16px] font-bold text-[#162d4c] truncate" : "text-[20px] font-extrabold text-[#092858] truncate"}>
                    {selectedContact ? (selectedContact.name || 'Anonymous') : selectedConversation.name}
                  </div>
                  <div className={isStaffUser ? "text-[12px] text-[#68809e] mt-[2px]" : "text-[14px] text-[#6682a8] mt-[4px] truncate"}>
                    {selectedContact
                      ? [selectedContact.email, selectedContact.phone].filter(Boolean).join(' · ')
                      : selectedConversation.role}
                  </div>
                </div>
                {isStaffUser && (
                <span className="px-[13px] py-[7px] rounded-[6px] bg-[#e9f4ff] text-[#1270d6] text-[11px] font-semibold mr-5 flex-shrink-0">
                  {selectedContact
                    ? (getContactTag(selectedContact).label)
                    : (getConvoTag(selectedConversation).label)}
                </span>
                )}
                <div className="relative flex-shrink-0">
                  <button onClick={() => setMoreOpen((v) => !v)} title="More actions"
                    className={isStaffUser
                      ? "text-[21px] text-[#173958] bg-transparent border-0 cursor-pointer"
                      : "border-0 bg-transparent text-[#173b60] text-[23px] leading-none cursor-pointer hover:text-[#0878ed]"
                    }>⋮</button>
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

              {/* Chat Body - the ONLY scrolling region, scrollbar always visible */}
              <div ref={chatBodyRef} onScroll={handleChatScroll} className={`chat-scroll flex-1 min-h-0 min-w-0 overflow-y-scroll overflow-x-hidden ${chatBodyPad} relative`}>
                {selectedContact ? (
                  <>
                    <div className="flex items-center gap-3.5 mb-5 text-[12px] font-semibold text-[#627794]">
                      <span className="h-px flex-1 bg-[#e6ebf2]" />{dayLabel(selectedContact.date)}<span className="h-px flex-1 bg-[#e6ebf2]" />
                    </div>
                    <div className={`flex items-start gap-[15px] ${msgGap}`}>
                      <div className={`${msgAvatar} ${inAvatarBg} flex-shrink-0 rounded-full flex items-center justify-center font-extrabold`}>
                        {initialsOf(selectedContact.name)}
                      </div>
                      <div className="flex min-w-0 flex-col items-start">
                        <div className={`w-fit rounded-[10px] ${bubbleBase} ${bubbleIn}`}>
                          {selectedContact.subject && (
                            <div className={`font-extrabold text-[14px] mb-[5px] ${isStaffUser ? 'text-[#1769ed] text-[11px]' : 'text-[#0874dd]'}`}>
                              {selectedContact.subject}{selectedContact.category ? ` - ${selectedContact.category}` : ''}
                            </div>
                          )}
                          <p className="m-0 whitespace-normal break-word" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedContact.message}</p>
                        </div>
                        <div className={`text-[11px] text-[#8295ae] mt-[5px] ${isStaffUser ? '' : 'text-[12px] text-[#6983a6] mt-[7px]'}`}>{fmtBubbleTime(selectedContact.date)}</div>
                      </div>
                    </div>
                    {(contactThread?.messages || []).map((m) => {
                      const mine = m.direction === 'sent';
                      return (
                        <div key={'tm' + m.id} className={`flex items-start ${mine ? 'justify-end' : ''} ${msgGap}`}>
                          {!mine && (
                            <div className={`${msgAvatar} ${inAvatarBg} flex-shrink-0 rounded-full flex items-center justify-center mr-[15px] font-extrabold`}>
                              {initialsOf(m.sender_name)}
                            </div>
                          )}
                          <div className={mine ? 'flex min-w-0 flex-col items-end' : 'flex min-w-0 flex-col items-start'}>
                            <div className={`w-fit rounded-[10px] ${bubbleBase} ${mine ? bubbleOut : bubbleIn}`}>
                              <p className="m-0 whitespace-normal break-word" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{m.message}</p>
                            </div>
                            <div className={`flex items-center gap-[5px] mt-[5px] text-[11px] text-[#8295ae] ${mine ? 'justify-end' : ''} ${isStaffUser ? '' : 'text-[12px] text-[#6983a6] mt-[7px]'}`}>
                              {fmtBubbleTime(m.created_at)}
                              {mine && <span className={isStaffUser ? 'text-[#1769ed]' : 'text-[#087cf0] font-extrabold'}>{m.read_at ? '✓✓' : '✓'}</span>}
                            </div>
                          </div>
                          {mine && (
                            <div className={`${msgAvatar} ml-[15px] flex-shrink-0 rounded-full flex items-center justify-center font-extrabold ${isStaffUser ? 'bg-[#0875e5] text-white' : 'bg-[#e7f3ff] text-[#087cf0]'}`}>
                              {initialsOf(m.sender_name)}
                            </div>
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
                            <div className={isStaffUser
                              ? "flex items-center gap-3.5 mb-5 text-[12px] font-semibold text-[#627794]"
                              : "flex items-center gap-4 text-[13px] text-[#6782a6] mb-7 mt-[5px]"
                            }>
                              <span className="h-px flex-1 bg-[#e6ebf2]" />{dayLabel(m.created_at)}<span className="h-px flex-1 bg-[#e6ebf2]" />
                            </div>
                          )}
                          <div className={`flex items-start ${mine ? 'justify-end' : ''} ${msgGap}`}>
                            {!mine && (
                              <div className={`${msgAvatar} mr-[15px] flex-shrink-0 rounded-full flex items-center justify-center font-extrabold ${isStaffUser ? 'text-white' : 'bg-[#e7f3ff] text-[#087cf0]'}`}
                                style={isStaffUser ? { background: avatarColor(m.other_role) } : undefined}>
                                {initialsOf(m.other_name)}
                              </div>
                            )}
                            <div className={mine ? 'flex min-w-0 flex-col items-end' : 'flex min-w-0 flex-col items-start'}>
                              <div className={`w-fit rounded-[10px] ${bubbleBase} ${mine ? bubbleOut : bubbleIn}`}>
                                {m.subject && <div className={`font-extrabold mb-[5px] ${isStaffUser ? 'text-[11px]' : 'text-[14px]'}`} style={{ color: mine ? 'rgba(255,255,255,0.95)' : '#0874dd' }}>{m.subject}</div>}
                                {m.report_id && (
                                  <button onClick={() => onViewReport && onViewReport(m.report_id)}
                                    className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border-0 bg-white/20 text-white">
                                    <Icon name="file" size={11} /> Report #{m.report_id}
                                  </button>
                                )}
                                <p className="m-0 whitespace-normal break-word" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{m.message}</p>
                              </div>
                              <div className={`flex items-center gap-[5px] mt-[5px] text-[11px] text-[#8295ae] ${mine ? 'justify-end' : ''} ${isStaffUser ? '' : 'text-[12px] text-[#6983a6] mt-[7px]'}`}>
                                {fmtBubbleTime(m.created_at)}
                                {mine && <span className={isStaffUser ? 'text-[#1769ed]' : 'text-[#087cf0] font-extrabold'}>{m.read_at ? '✓✓' : '✓'}</span>}
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

              {isStaffUser ? (
              /* Chat Composer - sticky bottom, always visible (staff) */
              <div className="px-4 py-3 flex-shrink-0 bg-white border-t border-[#e4eaf1] sticky bottom-0 z-10">
                <form
                  onSubmit={sendReply}
                  className="h-[64px] border border-[#d0dceb] rounded-[10px] flex items-center gap-2 pl-4 pr-2 bg-white"
                >
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type a reply..."
                    className="flex-1 min-w-0 h-full border-0 outline-none bg-transparent text-[13px] text-[#1e3a5f] placeholder:text-[#94a3b8]"
                  />
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    className="h-[44px] min-w-[110px] px-4 border-0 rounded-[8px] bg-[#0874e5] text-white text-[13px] font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[#0669d1] transition-colors flex-shrink-0"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
              ) : (
              /* Reply area (managers) - fixed 77px, always visible */
              <form
                onSubmit={sendReply}
                className="flex items-center gap-[10px] px-[17px] py-[10px] border-t border-[#d8e5f2] bg-white flex-shrink-0 sticky bottom-0 z-10"
                style={{ flex: '0 0 77px', minHeight: '77px', maxHeight: '77px' }}
              >
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply..."
                  className="flex-1 h-[58px] px-[14px] outline-none border border-[#cdddec] rounded-[10px] text-[14px] text-[#092858] placeholder:text-[#8096ad] bg-white"
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="w-[118px] h-[58px] border-0 rounded-[10px] bg-[#087cf0] text-white text-[14px] font-extrabold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed hover:bg-[#066bd5] transition-colors flex-shrink-0"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
              )}
            </>
          ) : (
            <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-hidden">
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
                  {(isStaffUser ? ['Super Admin', 'Admin'] : ['Super Admin', 'Admin', 'Staff', 'Resident']).map((role) => {
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
                <span className="mr-1.5">+</span>{composing ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
