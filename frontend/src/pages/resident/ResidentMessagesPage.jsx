import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import ImageLightbox from '../../components/ImageLightbox';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import Modal from '../../components/Modal';
import { useOnlineUsers } from '../../hooks/usePresence';

function initialsOf(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

const PAGE_SIZE = 9;
const MAX_REPLY_LEN = 1000;

const AVATAR_PALETTE = ['#1769ff', '#18b77a', '#f5b719', '#8d4de8', '#16a69a', '#ff8c2a', '#e74f79'];
function avatarColor(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
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

const MENU_ITEM_CLS = 'w-full text-left px-4 py-3 text-[13px] font-bold text-[#102D59] hover:bg-[#F5F8FC] bg-transparent border-0 cursor-pointer flex items-center gap-2';

export default function ResidentMessagesPage({ onNavigate }) {
  const showToast = useToast();
  const { user } = useAuth();
  const onlineIds = useOnlineUsers();

  const [items, setItems] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composing, setComposing] = useState(false);

  const chatBodyRef = useRef(null);

  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(false);
  const [prefs, setPrefs] = useState({});

  /* Image attachment for the chat composer (optional, JPG/PNG/WEBP ≤ 5 MB). */
  const [attachFile, setAttachFile] = useState(null);
  const [attachPreview, setAttachPreview] = useState(null);
  const attachInputRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

  function clearAttach() {
    if (attachPreview) { try { URL.revokeObjectURL(attachPreview); } catch {} }
    setAttachFile(null);
    setAttachPreview(null);
    if (attachInputRef.current) attachInputRef.current.value = '';
  }

  function pickAttach() {
    if (attachInputRef.current) attachInputRef.current.click();
  }

  function onAttachPicked(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(f.type);
    if (!okType) { showToast('Only JPG, PNG, or WEBP images are allowed.', 'error'); e.target.value = ''; return; }
    if (f.size > 5 * 1024 * 1024) { showToast('Image is larger than 5MB.', 'error'); e.target.value = ''; return; }
    if (attachPreview) { try { URL.revokeObjectURL(attachPreview); } catch {} }
    setAttachFile(f);
    setAttachPreview(URL.createObjectURL(f));
  }

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await apiFetch('direct_messages/list.php?limit=100');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lastIdRef = useRef(0);
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
      } catch { /* transient - next tick retries */ }
    };
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const loadPrefs = useCallback(async () => {
    try {
      const d = await apiFetch('direct_messages/prefs.php');
      setPrefs(d?.prefs || {});
    } catch { /* keep previous prefs */ }
  }, []);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  useEffect(() => {
    if (!items) { setConversations([]); return; }
    const map = new Map();
    [...items]
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .forEach((m) => {
        const isContactThread = !!m.contact_message_id;
        const key = isContactThread ? `ct-${m.contact_message_id}` : `dm-${m.other_id}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            otherId: isContactThread ? null : m.other_id,
            contactId: isContactThread ? m.contact_message_id : null,
            name: m.other_name,
            role: m.other_role || 'Staff',
            messages: [],
            unreadCount: 0,
          });
        }
        const convo = map.get(key);
        convo.messages.push(m);
        const muted = !!(prefs[key] && prefs[key].muted);
        if (m.direction === 'received' && !m.is_read && !muted) convo.unreadCount += 1;
      });
    setConversations([...map.values()].reverse());
  }, [items, prefs]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const selectedConversation = conversations.find((c) => String(c.id) === String(selectedId)) || null;

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
    else if (threadLength > 0) setNewBelow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadLength, selectedId]);

  /*
   * Mobile chat viewport lock: while a conversation is open on small
   * screens the chat fills exactly 100dvh minus the top bar, so the
   * document itself must not scroll (prevents the blank gap below the
   * composer on Chrome Android with its dynamic bars).
   */
  const [isMobileChat, setIsMobileChat] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobileChat(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!(selectedConversation && isMobileChat)) return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  });

  useEffect(() => {
    if (chatBodyRef.current && atBottom) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [reply, atBottom]);

  async function openConversation(convo) {
    setSelectedId(convo.id);
    setReply('');
    setAtBottom(true);
    setNewBelow(false);
    await markConversationRead(convo);
  }

  async function markConversationRead(convo) {
    if (!convo) return;
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

  function closeConversation() {
    setSelectedId(null);
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!selectedConversation || (!reply.trim() && !attachFile) || sending) return;
    setSending(true);
    try {
      const isContactThread = selectedConversation.contactId != null;
      const text = reply.trim();
      const subject = selectedConversation.messages[selectedConversation.messages.length - 1]?.subject || '';
      let recipientId;
      if (isContactThread) {
        const asc = [...selectedConversation.messages].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        const lastReceived = [...asc].reverse().find((m) => m.direction === 'received');
        recipientId = (lastReceived || asc[asc.length - 1]).other_id;
      } else {
        recipientId = selectedConversation.otherId ?? selectedConversation.messages[0]?.other_id;
      }
      let body;
      if (attachFile) {
        const fd = new FormData();
        fd.append('message', text);
        fd.append('subject', subject);
        fd.append('recipient_id', String(recipientId ?? ''));
        if (isContactThread) fd.append('contact_message_id', String(selectedConversation.contactId));
        fd.append('image', attachFile);
        body = fd;
      } else {
        body = { message: text, subject };
        if (isContactThread) body.contact_message_id = selectedConversation.contactId;
        body.recipient_id = recipientId;
      }
      await apiFetch('direct_messages/send.php', { method: 'POST', body });
      setReply('');
      clearAttach();
      load();
      scrollToBottom();
      showToast('Reply sent successfully.');
    } catch (err) {
      showToast(err.message || 'Could not send message.', 'error');
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
    if (!composeTo) { showToast('Please select a recipient.', 'error'); return; }
    if (!composeBody.trim()) { showToast('Please enter a message.', 'error'); return; }
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
      showToast('Message sent successfully.');
      load();
    } catch (err) {
      showToast(err.message || 'Could not send message.', 'error');
    } finally {
      setComposing(false);
    }
  }

  const q = search.toLowerCase().trim();

  const isArchived = (c) => !!(prefs[c.id] && prefs[c.id].archived);

  const visible = useMemo(() => conversations
    .filter((c) => {
      if (filter === 'Archived') return isArchived(c);
      if (isArchived(c)) return false;
      if (filter === 'Unread') return c.unreadCount > 0;
      return true;
    })
    .filter((c) => {
      if (!q) return true;
      const last = c.messages[c.messages.length - 1];
      return (c.name + ' ' + (last?.subject || '') + ' ' + (last?.message || '')).toLowerCase().includes(q);
    }), [conversations, filter, q, prefs]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = visible.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = (safePage - 1) * PAGE_SIZE + paged.length;

  const allCount = conversations.filter((c) => !isArchived(c)).length;
  const unreadCount = conversations.filter((c) => !isArchived(c) && c.unreadCount > 0).length;
  const archivedCount = conversations.filter((c) => isArchived(c)).length;

  return (
    <ResidentLayout activePage="messages" onNavigate={onNavigate} fullWidth>
      <div className="px-0 sm:px-6 lg:px-8 py-0 sm:py-6 lg:py-8 max-w-[1320px] mx-auto overflow-x-clip">
        <div className="bg-white border border-[#DCE5F2] rounded-none sm:rounded-[16px] sm:shadow-[0_7px_22px_rgba(30,60,100,0.04)] overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)] h-[calc(100dvh-var(--xevera-header-height))] sm:h-[calc(100vh-180px)] lg:h-[640px] lg:max-h-[78vh] min-h-0 sm:min-h-[520px] max-h-none">

            {/* ================= CONVERSATION LIST ================= */}
            <section
              className={`border-b lg:border-b-0 lg:border-r border-[#DCE5F2] flex flex-col min-h-0 min-w-0 bg-white ${
                selectedConversation ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <div className="flex-none flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-5 pb-3">
                <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[#102D59]">Message Box</h1>
                <button
                  onClick={openCompose}
                  className="w-11 h-11 grid place-items-center border border-[#DCE5F2] rounded-[10px] bg-white text-[#1769FF] text-[20px] cursor-pointer hover:border-[#B7CEF5] transition-colors"
                  aria-label="New message"
                >
                  <Icon name="send" size={16} />
                </button>
              </div>

              <div className="flex-none flex gap-2 px-5 sm:px-6">
                {[
                  { key: 'All', label: 'All', count: allCount },
                  { key: 'Unread', label: 'Unread', count: unreadCount },
                  { key: 'Archived', label: 'Archived', count: archivedCount },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setFilter(f.key); setSelectedId(null); }}
                    className={`h-10 px-4 rounded-[10px] text-[13px] font-bold border transition-colors cursor-pointer ${
                      filter === f.key
                        ? 'bg-[#1769FF] border-[#1769FF] text-white'
                        : 'bg-white text-[#102D59] border-[#DCE5F2] hover:border-[#B7CEF5]'
                    }`}
                  >
                    {f.label} {f.count}
                  </button>
                ))}
              </div>

              <div className="flex-none flex items-center h-[53px] mx-5 sm:mx-6 my-4 sm:my-5 px-3.5 gap-2.5 border border-[#D5E0EF] rounded-[12px] bg-white focus-within:border-[#1769FF] focus-within:shadow-[0_0_0_3px_rgba(23,105,255,0.08)]">
                <span className="text-[#6D809D] text-[20px] flex-shrink-0">
                  <Icon name="search" size={18} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full border-0 outline-none text-[14px] text-[#102D59] bg-transparent placeholder:text-[#8190A8]"
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {items === null ? (
                  <div className="px-3.5">
                    <SkeletonRows rows={6} height="h-16" />
                  </div>
                ) : error ? (
                  <div className="p-4 text-center text-xs text-[#B91C1C]">Could not load messages.</div>
                ) : paged.length === 0 ? (
                  <div className="min-h-[240px] flex items-center justify-center text-center px-6">
                    <div>
                      <p className="text-sm font-bold text-[#374151] m-0">No conversations found</p>
                      <p className="text-xs text-[#9CA3AF] mt-1.5">Tap the ↗ button to message the Xevera team.</p>
                    </div>
                  </div>
                ) : (
                  paged.map((c) => {
                    const last = c.messages[c.messages.length - 1];
                    const selected = String(selectedId) === String(c.id);
                    return (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openConversation(c)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openConversation(c); } }}
                        aria-label={`Open conversation with ${c.name}`}
                        className={`w-full min-h-[96px] lg:min-h-[108px] flex items-center gap-3.5 pl-5 sm:pl-6 pr-3 sm:pr-4 py-3.5 sm:py-4 text-left transition-colors cursor-pointer bg-white border-0 border-t border-[#DCE5F2] outline-none focus-visible:bg-[#EDF4FF] ${
                          selected ? 'bg-[#EDF4FF]' : 'hover:bg-[#F5F8FC]'
                        }`}
                      >
                        <span
                          className="relative w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] flex-shrink-0 rounded-full grid place-items-center text-white text-[15px] font-extrabold"
                          style={{ background: avatarColor(c.name) }}
                        >
                          {initialsOf(c.name)}
                          <span className={`absolute -right-px bottom-0.5 w-[11px] h-[11px] border-2 border-white rounded-full ${onlineIds.has(Number(c.id)) ? 'bg-[#20b86b]' : 'bg-[#AEB9C8]'}`} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <strong className="text-[14px] font-extrabold text-[#102D59] truncate">{c.name}</strong>
                            <span className="inline-block px-[7px] py-[3px] rounded-[6px] bg-[#EDF4FF] text-[#1769FF] text-[9px] font-extrabold flex-shrink-0">
                              {c.role}
                            </span>
                            {isArchived(c) && (
                              <span className="inline-block px-[7px] py-[3px] rounded-[6px] bg-[#F1F5F9] text-[#64748B] text-[9px] font-extrabold flex-shrink-0">
                                Archived
                              </span>
                            )}
                            {!!(prefs[c.id] && prefs[c.id].muted) && (
                              <span className="inline-block px-[7px] py-[3px] rounded-[6px] bg-[#F1F5F9] text-[#64748B] text-[9px] font-extrabold flex-shrink-0">
                                Muted
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-[12px] text-[#687B99] truncate">
                            {last?.direction === 'sent' ? 'You: ' : ''}{last?.subject ? `${last.subject} — ` : ''}{last?.message || (last?.image ? '📷 Photo' : '')}
                          </p>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 self-stretch py-0.5">
                          <time className="text-[10px] text-[#526681] whitespace-nowrap">{fmtListTime(last?.created_at)}</time>
                          <div className="flex items-center gap-0.5 mt-auto">
                            {c.unreadCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#1769FF] mr-1" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {visible.length > 0 && (
                <div className="flex-none min-h-[60px] px-5 sm:px-6 border-t border-[#DCE5F2] flex items-center justify-between text-[11px] text-[#657895]">
                  <span>{visible.length === 0 ? '0' : `${rangeStart} - ${rangeEnd}`} of {visible.length} conversations</span>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className="w-11 h-11 rounded-[9px] border border-[#DCE5F2] bg-white cursor-pointer disabled:opacity-40"
                        aria-label="Previous page"
                      >
                        ‹
                      </button>
                      <button className="w-11 h-11 rounded-[9px] border border-[#1769FF] bg-[#1769FF] text-white cursor-pointer">{safePage}</button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        className="w-11 h-11 rounded-[9px] border border-[#DCE5F2] bg-white cursor-pointer disabled:opacity-40"
                        aria-label="Next page"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ================= CHAT ================= */}
            <section
              className={`min-w-0 min-h-0 flex flex-col bg-white ${
                selectedConversation ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {selectedConversation ? (
                <>
                  {/* Chat header */}
                  <div className="flex-none min-h-[72px] sm:min-h-[96px] px-4 sm:px-7 py-3 sm:py-5 border-b border-[#DCE5F2] flex items-center gap-2 sm:gap-4 bg-white">
                    <button
                      onClick={closeConversation}
                      className="lg:hidden w-11 h-11 grid place-items-center border border-[#DCE5F2] rounded-[11px] bg-white text-[#102D59] cursor-pointer hover:bg-[#F5F8FC] flex-shrink-0"
                      aria-label="Back to conversations"
                    >
                      ←
                    </button>
                    <span
                      className="relative w-11 h-11 sm:w-[55px] sm:h-[55px] flex-shrink-0 rounded-full grid place-items-center text-white font-extrabold text-[15px] sm:text-[17px]"
                      style={{ background: avatarColor(selectedConversation.name) }}
                    >
                      {initialsOf(selectedConversation.name)}
                      <span className={`absolute -right-px bottom-0.5 w-[11px] h-[11px] border-2 border-white rounded-full ${onlineIds.has(Number(selectedConversation.id)) ? 'bg-[#20b86b]' : 'bg-[#AEB9C8]'}`} />
                    </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <strong className="text-[15px] sm:text-[16px] font-extrabold text-[#102D59] truncate">{selectedConversation.name}</strong>
                        <span className="inline-block px-2 py-[3px] rounded-[6px] bg-[#EDF4FF] text-[#1769FF] text-[10px] font-extrabold flex-shrink-0">
                          {selectedConversation.role}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#607492] mt-1.5 truncate">
                        Xevera Civic Team · ID: #{selectedConversation.contactId ?? selectedConversation.id}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div
                    ref={chatBodyRef}
                    onScroll={handleChatScroll}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-7 py-6 sm:py-7 relative [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [scroll-padding-bottom:96px]"
                  >
                    {[...selectedConversation.messages]
                      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
                      .map((m, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showDivider = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                        const mine = m.direction === 'sent';
                        return (
                          <div key={m.id}>
                            {showDivider && (
                              <div className="flex items-center gap-3.5 mb-7">
                                <span className="h-px flex-1 bg-[#DCE5F2]" />
                                <strong className="text-[11px] font-bold text-[#657895] uppercase tracking-[0.5px]">{dayLabel(m.created_at)}</strong>
                                <span className="h-px flex-1 bg-[#DCE5F2]" />
                              </div>
                            )}
                            <div className={`flex mb-7 gap-1 sm:gap-3 ${mine ? 'justify-end' : 'items-end'}`}>
                              {!mine && (
                                <span
                                  className="w-[38px] h-[38px] flex-shrink-0 rounded-full grid place-items-center text-white text-[11px] font-extrabold"
                                  style={{ background: avatarColor(m.other_name) }}
                                >
                                  {initialsOf(m.other_name)}
                                </span>
                              )}
                              <div
                                className="max-w-[75%] sm:max-w-[min(70%,700px)] px-4 sm:px-[18px] py-3 sm:py-[15px] box-border"
                                style={mine
                                  ? { background: '#E8F1FF', borderRadius: '16px 16px 5px 16px' }
                                  : { background: '#F1F4F8', borderRadius: '5px 16px 16px 16px' }}
                              >
                                {m.subject && (
                                  <strong className="block text-[13px] font-extrabold text-[#1769FF] mb-2.5">{m.subject}</strong>
                                )}
                                {m.report_id && (
                                  <button
                                    onClick={() => { if (onNavigate) onNavigate('my-reports'); }}
                                    className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border-0 bg-white text-[#1769FF]"
                                  >
                                    Report #{m.report_id}
                                  </button>
                                )}
                                {m.image && (
                                  <button
                                    type="button"
                                    onClick={() => setLightbox(m.image)}
                                    className="block p-0 border-0 bg-transparent cursor-pointer"
                                    aria-label="View attached photo"
                                  >
                                    <img src={uploadUrl(m.image)} alt="Attached photo" loading="lazy" className="block max-w-full h-auto max-h-[240px] rounded-[10px] object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  </button>
                                )}
                                {!!(m.message && String(m.message).trim()) && (
                                  <p className="m-0 text-[14px] sm:text-[15px] leading-[1.5] text-[#172F53] whitespace-normal break-word max-w-full box-border" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', marginTop: m.image ? 8 : 0 }}>{m.message}</p>
                                )}
                                <small className="block mt-2 text-[9px] text-[#70829E]">
                                  {fmtBubbleTime(m.created_at)}{mine ? (m.read_at ? ' ✓✓' : ' ✓') : ''}
                                </small>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {newBelow && (
                      <button
                        onClick={scrollToBottom}
                        className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full bg-[#1769FF] text-white text-xs font-bold border-0 shadow-[0_6px_16px_rgba(18,100,232,0.3)] cursor-pointer hover:bg-[#0F57DC] transition-colors"
                      >
                        ↓ New messages
                      </button>
                    )}
                  </div>

                  {/* Attachment preview */}
                  {attachPreview && (
                    <div className="flex-none flex items-center gap-3 px-3 sm:px-4 pt-3 bg-white">
                      <span className="relative inline-block">
                        <img src={attachPreview} alt="Attachment preview" className="w-[72px] h-[72px] object-cover rounded-[12px] border border-[#DCE5F2]" />
                        <button
                          type="button"
                          onClick={clearAttach}
                          aria-label="Remove attached image"
                          className="absolute -top-2 -right-2 w-7 h-7 grid place-items-center rounded-full bg-[#102D59] text-white text-[13px] border-2 border-white cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                      <span className="text-[11px] text-[#687B99]">Photo attached — add a caption or send as is.</span>
                    </div>
                  )}

                  {/* Composer */}
                  <form
                    onSubmit={sendReply}
                    className="flex-none border-t border-[#DCE5F2] px-3 sm:px-4 pt-3 sm:pt-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 bg-white"
                  >
                    <button
                      type="button"
                      onClick={pickAttach}
                      className="w-12 h-12 flex-shrink-0 border border-[#DCE5F2] rounded-[12px] bg-white text-[#617594] text-[20px] grid place-items-center cursor-pointer hover:bg-[#F5F8FC]"
                      aria-label="Attach a photo"
                    >
                      <Icon name="paperclip" size={18} />
                    </button>
                    <input ref={attachInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onAttachPicked} className="hidden" aria-hidden="true" tabIndex={-1} />
                    <input
                      type="text"
                      value={reply}
                      onChange={(e) => setReply(e.target.value.slice(0, MAX_REPLY_LEN))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                      onFocus={() => { if (atBottom) scrollToBottom(); }}
                      maxLength={MAX_REPLY_LEN}
                      placeholder="Type a message..."
                      className="flex-1 min-w-0 h-12 px-3.5 border border-[#DCE5F2] rounded-[12px] outline-none text-[14px] text-[#102D59] focus:border-[#1769FF] focus:shadow-[0_0_0_3px_rgba(23,105,255,0.08)]"
                    />
                    <button
                      type="submit"
                      disabled={sending || (!reply.trim() && !attachFile)}
                      className="w-12 h-12 flex-shrink-0 border-0 rounded-[12px] bg-[#1769FF] text-white text-[20px] grid place-items-center cursor-pointer hover:bg-[#0F57DC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Send"
                    >
                      <Icon name="send" size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 min-h-[400px]">
                  <div className="text-center max-w-[320px]">
                    <span className="w-16 h-16 mx-auto rounded-full bg-[#EEF5FF] text-[#1769FF] grid place-items-center mb-4">
                      <Icon name="letter" size={26} />
                    </span>
                    <p className="text-[15px] font-extrabold text-[#102D59] m-0">No conversation selected</p>
                    <p className="text-[12px] text-[#7283A0] mt-2 leading-relaxed">Choose a conversation on the left, or start a new one with the ↗ button.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* ================= PHOTO LIGHTBOX ================= */}
      {lightbox && (
        <ImageLightbox photos={[lightbox]} index={0} onClose={() => setLightbox(null)} title="Attached photo" />
      )}

      {/* ================= NEW MESSAGE MODAL ================= */}
      <Modal
        open={composeOpen}
        onCancel={() => setComposeOpen(false)}
        title="New Message"
        description="Send a message to the Xevera team."
      >
        <form onSubmit={submitCompose} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold mb-1.5 text-[#26364B]">Recipient</span>
            <select
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              className="w-full p-2.5 rounded-[9px] border border-[#DCE5F2] text-sm bg-white outline-none focus:border-[#1769FF] cursor-pointer"
            >
              <option value="">Select recipient</option>
              {recipients.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold mb-1.5 text-[#26364B]">Subject</span>
            <input
              type="text"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Message subject"
              className="w-full p-2.5 rounded-[9px] border border-[#DCE5F2] text-sm outline-none focus:border-[#1769FF] placeholder:text-[#94A3B8]"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-bold mb-1.5 text-[#26364B]">Message</span>
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="w-full p-2.5 rounded-[9px] border border-[#DCE5F2] text-sm resize-y outline-none focus:border-[#1769FF] placeholder:text-[#94A3B8]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              className="px-4 py-2.5 rounded-[9px] border border-[#DCE5F2] bg-white text-sm font-semibold text-[#425676] cursor-pointer hover:bg-[#F5F8FC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={composing}
              className="h-10 px-5 rounded-[9px] bg-[#1769FF] text-white text-xs font-bold border-0 hover:bg-[#0F57DC] disabled:bg-[#A9C5F7] disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {composing ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </Modal>
    </ResidentLayout>
  );
}
