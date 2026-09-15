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

/* Avatar initial class for mockup matching */
const AVATAR_COLORS = ['avatar-h', 'avatar-m', 'avatar-j', 'avatar-a', 'avatar-t', 'avatar-p', 'avatar-l', 'avatar-blue'];
function avatarInitialClass(name) {
  const first = String(name || '').charAt(0).toLowerCase();
  const map = { h: 'avatar-h', m: 'avatar-m', j: 'avatar-j', a: 'avatar-a', t: 'avatar-t', p: 'avatar-p', l: 'avatar-l' };
  return map[first] || 'avatar-blue';
}

/* Category tag styling */
const CATEGORY_TAGS = {
  maintenance: { cls: 'tag-maintenance', label: 'Maintenance' },
  emergency: { cls: 'tag-emergency', label: 'Emergency Contact' },
  general: { cls: 'tag-general', label: 'General Inquiry' },
  report: { cls: 'tag-report', label: 'Report Concern' },
  other: { cls: 'tag-other', label: 'Other' },
};

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
    MANAGER_FILTERS.includes(initialFilter) ? initialFilter : 'All'
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

  const chatBodyRef = useRef(null);
  const isContactTab = filter === 'Contact';
  const [contactStatus, setContactStatus] = useState('All');
  const [subjectCategory, setSubjectCategory] = useState(null);

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
  }, [contactItems, showToast]);

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

  useEffect(() => { setPage(1); setSubjectCategory(null); }, [filter, search]);

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
    .filter((c) => !subjectCategory || mapStoredCategory(c.category) === subjectCategory || inferCategory(c.subject, c.message) === subjectCategory)
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
    if (filter === 'Residents' || filter === 'Staff' || filter === 'Admin') return dmRows;
    return [...dmRows, ...ctRows].sort((a, b) => b.sortTime.localeCompare(a.sortTime));
  }, [isContactTab, filter, dmRows, ctRows]);

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
  if (cat.includes('account')) return 'account';
  if (cat.includes('technical') || cat.includes('issue')) return 'maintenance';
  if (cat.includes('other')) return 'other';
  return null;
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
      `}</style>

      <div className="page-header flex items-center justify-between mb-4">
        <div>
          <div className="text-[#076ee0] font-bold text-[13px] tracking-[0.7px] mb-[3px] flex items-center gap-2">
            <span className="inline-block w-[7px] h-[7px] rounded-full bg-[#0877e5]" />
            COMMUNICATIONS
          </div>
          <h1 className="text-[29px] leading-none text-[#112c4c] font-bold m-0">Message Box</h1>
          <p className="text-[13px] text-[#415875] mt-[2px]">
            Direct messages with admins, staff, residents, or the public contact form.
          </p>
        </div>
        <button
          onClick={openCompose}
          className="inline-flex items-center gap-2 h-[38px] px-[18px] rounded-[7px] bg-gradient-to-r from-[#0b72df] to-[#0865d5] text-white text-[13px] font-semibold border-0 shadow-[0_4px_10px_rgba(0,105,220,0.18)] hover:from-[#075fc4] hover:to-[#075fc4] transition-all cursor-pointer"
        >
          + &nbsp; New Message
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[566px_minmax(500px,1fr)] gap-[9px] bg-white border border-[#e0e8f1] rounded-[8px] overflow-hidden">
        {/* ================= CONVERSATIONS PANEL ================= */}
        <aside className={`flex flex-col min-h-0 min-w-0 bg-white ${(selectedId || selectedContact) ? 'hidden lg:flex' : 'flex'}`}>
          {/* Category Filters */}
          <div className="category-area px-4 pt-4 pb-2">
            {/* Row 1: Role filters */}
            <div className="category-row flex flex-wrap gap-[7px] mb-2">
              {[
                { key: 'All', count: allCount },
                { key: 'Unread', count: unreadCount },
                { key: 'Residents', count: residentsCount },
                ...(isStaffUser
                  ? [{ key: 'Staff', count: staffTabCount }, { key: 'Admin', count: adminCount }, { key: 'Super Admin', count: superAdminCount }]
                  : [{ key: 'Staff', count: staffTabCount }, { key: 'Admin', count: adminCount }, { key: 'Super Admin', count: superAdminCount }, { key: 'Contact', count: contactCount }]
                ),
              ].map(({ key, count }) => (
                <button key={key}
                  onClick={() => { setFilter(key); setSelectedId(null); setSelectedContact(null); }}
                  className={`h-[35px] px-[14px] rounded-[7px] text-[12px] font-medium whitespace-nowrap border cursor-pointer transition-all ${
                    filter === key
                      ? 'bg-[#0874e5] text-white border-[#0874e5] shadow-[0_2px_5px_rgba(0,100,220,0.16)]'
                      : 'bg-white text-[#183454] border-[#dce6f2] hover:border-[#99c4f3]'
                  }`}>
                  {key}
                  <span className={`ml-[3px] px-[6px] py-[2px] rounded-[8px] text-[11px] ${
                    filter === key ? 'bg-[rgba(255,255,255,0.18)] text-white' : 'bg-[#edf5ff] text-[#0873e3]'
                  }`}>{count}</span>
                </button>
              ))}
            </div>

            {/* Row 2: Subject categories - compact style */}
            <div className="category-row flex flex-wrap gap-[6px]">
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
                    className={`h-[30px] px-[11px] rounded-[6px] text-[11px] font-medium whitespace-nowrap border cursor-pointer transition-all ${
                      subjectCategory === cat
                        ? 'border-[#0874e5] bg-[#edf5ff] text-[#0874e5]'
                        : 'border-[#e8edf3] bg-[#f8fafc] text-[#5a6b82] hover:border-[#b8cce2] hover:bg-white'
                    }`}>
                    {label}
                    <span className={`ml-[3px] px-[5px] py-[1px] rounded-[6px] text-[10px] ${
                      subjectCategory === cat ? 'bg-[#0874e5] text-white' : 'bg-[#edf5ff] text-[#0873e3]'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center h-[37px] mx-4 mb-2 border border-[#dce5ef] rounded-[7px] overflow-hidden bg-white">
            <span className="pl-3 text-[#627994] text-[19px]">⌕</span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 h-full px-[9px] border-0 outline-none text-[12px] text-[#172b4d] bg-transparent placeholder:text-[#8ca0bc]" />
            <div className="w-[42px] h-full border-l border-[#dce5ef] flex items-center justify-center text-[#55708f] cursor-pointer"
              onClick={() => setFilter('All')}>☷</div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
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
                return (
                  <div
                    key={row.key}
                    onClick={() => (isCt ? openContact(c) : openConversation(c))}
                    className={`flex items-center gap-[11px] px-4 py-[6px] cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#edf6ff]'
                        : 'hover:bg-[#f6faff] border-t border-[#edf1f5]'
                    }`}
                    style={{ minHeight: '59px' }}
                  >
                    <div className={`relative w-[42px] h-[42px] flex-shrink-0 rounded-full flex items-center justify-center text-white text-[16px] font-semibold ${avatarBg}`}>
                      {isCt ? (c.name || '?').charAt(0).toUpperCase() : initialsOf(c.name)}
                      {!isCt && (
                        <span className={`absolute -right-px bottom-px w-[9px] h-[9px] border-[1.5px] border-white rounded-full ${onlineIds.has(Number(c.id)) ? 'bg-[#20b86b]' : 'bg-[#AEB9C8]'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[8px] mb-[3px]">
                        <span className="text-[12px] font-bold text-[#142b49] truncate">{c.name || 'Anonymous'}</span>
                        <span className={`inline-flex items-center px-[9px] py-[4px] rounded-[5px] text-[10px] font-semibold ${tag.cls}`}>
                          {tag.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#506784] truncate">{previewText}</div>
                    </div>
                    <div className="w-[74px] text-right self-start pt-1 flex-shrink-0">
                      <div className="text-[11px] text-[#5f7694] leading-[1.5]">
                        {isCt ? fmtListDate(c.date || c.created_at) : fmtListDate(last?.created_at)}<br />
                        {isCt ? fmtListTime(c.date || c.created_at) : fmtListTime(last?.created_at)}
                      </div>
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#1476e5] text-white text-[11px] font-bold mt-1">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer / Pagination */}
          <div className="h-[43px] border-t border-[#e4ebf2] flex items-center justify-between px-4 text-[12px] text-[#435b79]">
            <span>
              {sourceRows.length === 0 ? '0' : `${rangeStart} - ${rangeEnd}`} of {sourceRows.length} conversations
            </span>
            {totalPages > 1 && (
              <div className="flex gap-[5px]">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="w-[31px] h-[31px] grid place-items-center rounded-[6px] border border-[#dce5ef] bg-white text-[#46607e] text-[12px] cursor-pointer disabled:opacity-40">‹</button>
                {pageButtons.map((n, i) => n === '...' ? (
                  <span key={'e' + i} className="w-[31px] h-[31px] grid place-items-center text-[#9CA3AF]">...</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)}
                    className={`w-[31px] h-[31px] grid place-items-center rounded-[6px] border text-[12px] cursor-pointer ${
                      n === safePage ? 'border-[#0874e5] bg-[#0874e5] text-white' : 'border-[#dce5ef] bg-white text-[#46607e]'
                    }`}>{n}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="w-[31px] h-[31px] grid place-items-center rounded-[6px] border border-[#dce5ef] bg-white text-[#46607e] text-[12px] cursor-pointer disabled:opacity-40">›</button>
              </div>
            )}
          </div>
        </aside>

        {/* ================= CHAT PANEL ================= */}
        <section className={`min-w-0 min-h-0 flex-col bg-white ${(selectedId || selectedContact) ? 'flex' : 'hidden lg:flex'}`}>
          {(selectedContact || selectedConversation) ? (
            <>
              {/* Chat Header */}
              <div className="h-[69px] border-b border-[#e4eaf1] flex items-center px-[18px] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => { setSelectedId(null); setSelectedContact(null); }}
                  aria-label="Back to conversations"
                  className="lg:hidden w-11 h-11 rounded-xl border border-[#dce5f0] bg-white text-[#425676] grid place-items-center flex-shrink-0 cursor-pointer hover:bg-[#f5f8fc] transition-colors mr-3"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                </button>
                <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center text-white text-[17px] mr-3 flex-shrink-0 ${
                  selectedContact ? 'avatar-t' : avatarInitialClass(selectedConversation.name)
                }`}>
                  {initialsOf(selectedContact ? selectedContact.name : selectedConversation.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-bold text-[#162d4c] truncate">
                    {selectedContact ? (selectedContact.name || 'Anonymous') : selectedConversation.name}
                  </div>
                  <div className="text-[12px] text-[#68809e] mt-[2px]">
                    {selectedContact
                      ? [selectedContact.email, selectedContact.phone].filter(Boolean).join(' · ')
                      : selectedConversation.role}
                  </div>
                </div>
                <span className="px-[13px] py-[7px] rounded-[6px] bg-[#e9f4ff] text-[#1270d6] text-[11px] font-semibold mr-5 flex-shrink-0">
                  {selectedContact
                    ? (getContactTag(selectedContact).label)
                    : (getConvoTag(selectedConversation).label)}
                </span>
                <div className="relative flex-shrink-0">
                  <button onClick={() => setMoreOpen((v) => !v)} title="More actions"
                    className="text-[21px] text-[#173958] bg-transparent border-0 cursor-pointer">⋮</button>
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

              {/* Chat Body */}
              <div ref={chatBodyRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto overflow-x-hidden px-[18px] py-4 relative">
                {selectedContact ? (
                  <>
                    <div className="flex items-center gap-3.5 mb-[30px] text-[12px] font-semibold text-[#627794]">
                      <span className="h-px flex-1 bg-[#e6ebf2]" />{dayLabel(selectedContact.date)}<span className="h-px flex-1 bg-[#e6ebf2]" />
                    </div>
                    <div className="flex items-end gap-[14px] mb-[15px] max-w-[80%]">
                      <div className="w-[38px] h-[38px] flex-shrink-0 rounded-full flex items-center justify-center text-white text-[15px] bg-[#10b5bb]">
                        {(selectedContact.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-[14px]">
                        <div className="px-[15px] py-[11px] rounded-[8px] bg-[#f0f6fc] text-[#213b5b] text-[13px] leading-[1.55] max-w-[375px]">
                          {selectedContact.subject && (
                            <div className="text-[11px] font-bold text-[#1769ed] mb-1">
                              {selectedContact.subject}{selectedContact.category ? ` · ${selectedContact.category}` : ''}
                            </div>
                          )}
                          <p className="m-0 whitespace-normal break-word" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedContact.message}</p>
                        </div>
                        <div className="text-[11px] text-[#8295ae] mt-[5px]">{fmtBubbleTime(selectedContact.date)}</div>
                      </div>
                    </div>
                    {(contactThread?.messages || []).map((m) => {
                      const mine = m.direction === 'sent';
                      return (
                        <div key={'tm' + m.id} className={`flex items-end mb-[15px] max-w-[80%] ${mine ? 'justify-end' : ''}`}>
                          {!mine && (
                            <div className="w-[38px] h-[38px] flex-shrink-0 rounded-full flex items-center justify-center text-white text-[15px] bg-[#10b5bb]">
                              {initialsOf(m.sender_name)}
                            </div>
                          )}
                          <div className={mine ? '' : 'ml-[14px]'}>
                            <div className={`px-[15px] py-[11px] rounded-[8px] text-[13px] leading-[1.55] max-w-[375px] ${
                              mine
                                ? 'bg-gradient-to-br from-[#0879ec] to-[#0569df] text-white rounded-[8px_8px_4px_8px]'
                                : 'bg-[#f0f6fc] text-[#213b5b]'
                            }`}>
                              <p className="m-0 whitespace-normal break-word" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{m.message}</p>
                            </div>
                            <div className={`flex items-center gap-[5px] mt-[5px] text-[11px] text-[#8295ae] ${mine ? 'justify-end' : ''}`}>
                              {fmtBubbleTime(m.created_at)}
                              {mine && <span className="text-[#1769ed]">{m.read_at ? '✓✓' : '✓'}</span>}
                            </div>
                          </div>
                          {mine && (
                            <div className="w-[38px] h-[38px] flex-shrink-0 rounded-full flex items-center justify-center text-white text-[15px] bg-[#0875e5] ml-[10px]">
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
                            <div className="flex items-center gap-3.5 mb-[30px] text-[12px] font-semibold text-[#627794]">
                              <span className="h-px flex-1 bg-[#e6ebf2]" />{dayLabel(m.created_at)}<span className="h-px flex-1 bg-[#e6ebf2]" />
                            </div>
                          )}
                          <div className={`flex items-end mb-[15px] max-w-[80%] ${mine ? 'justify-end' : ''}`}>
                            {!mine && (
                              <div className="w-[38px] h-[38px] flex-shrink-0 rounded-full flex items-center justify-center text-white text-[15px]"
                                style={{ background: avatarColor(m.other_role) }}>
                                {initialsOf(m.other_name)}
                              </div>
                            )}
                            <div className={mine ? '' : 'ml-[14px]'}>
                              <div className={`px-[15px] py-[11px] rounded-[8px] text-[13px] leading-[1.55] max-w-[375px] ${
                                mine
                                  ? 'bg-gradient-to-br from-[#0879ec] to-[#0569df] text-white rounded-[8px_8px_4px_8px]'
                                  : 'bg-[#f0f6fc] text-[#213b5b]'
                              }`}>
                                {m.subject && <div className="text-[11px] font-bold mb-1" style={{ color: mine ? 'rgba(255,255,255,0.8)' : '#1670d5' }}>{m.subject}</div>}
                                {m.report_id && (
                                  <button onClick={() => onViewReport && onViewReport(m.report_id)}
                                    className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border-0 bg-white/20 text-white">
                                    <Icon name="file" size={11} /> Report #{m.report_id}
                                  </button>
                                )}
                                <p className="m-0 whitespace-normal break-word" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{m.message}</p>
                              </div>
                              <div className={`flex items-center gap-[5px] mt-[5px] text-[11px] text-[#8295ae] ${mine ? 'justify-end' : ''}`}>
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

              {/* Chat Input */}
              <div className="px-[18px] pt-[10px] pb-[18px] flex-shrink-0">
                <div className="min-h-[78px] border border-[#dce6f1] rounded-[8px] flex items-end p-[9px] shadow-[0_1px_4px_rgba(30,70,110,0.03)]">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                    placeholder="Type a reply..."
                    rows={2}
                    className="flex-1 h-[48px] border-0 outline-none resize-none p-[5px] text-[12px] text-[#28415f] placeholder:text-[#8295ad]" />
                  <div className="flex items-center gap-[17px] pb-[6px] mr-[10px] text-[#55708f] text-[20px] flex-shrink-0">
                    <span title="Attach file" className="cursor-pointer hover:text-[#0874e5] transition-colors">♧</span>
                    <span title="Emoji" className="cursor-pointer hover:text-[#0874e5] transition-colors"
                      onClick={() => { setReply((r) => r + ' 🙂'); }}>☺</span>
                  </div>
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="h-[44px] min-w-[112px] border-0 rounded-[7px] bg-gradient-to-r from-[#0874e5] to-[#0969dc] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed hover:from-[#075fc5] hover:to-[#075fc5] transition-colors flex-shrink-0"
                  >
                    {sending ? 'Sending...' : 'Send  ➤'}
                  </button>
                </div>
              </div>
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
                <span className="mr-1.5">+</span>{composing ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
