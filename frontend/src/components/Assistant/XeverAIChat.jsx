import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = ['How to report an issue', 'Garbage schedule', 'Document requests', 'Report status'];

function botReply(text) {
  const q = text.toLowerCase();

  if (/(status|track|follow|update|ref|xr-\d|kalagayan)/.test(q)) {
    return '**Report status:** Sign in and open **My Reports** to see the live status of each report \u2014 Pending, Verified, Assigned, In Progress, Resolved, Closed, or Rejected. You can also search by reference number (e.g. XR-2026-001234), and you\u2019ll be notified whenever the status changes.';
  }
  if (/(garbage|trash|waste|basura|collection|kalat|schedule|iskedyul)/.test(q)) {
    return '**Garbage schedule:** Collection runs every **Tuesday and Friday morning**. Please separate biodegradables from recyclables (segregation) before putting them out. For bulky items or missed pickups, message the civic desk on the Contact page.';
  }
  if (/(report|issue|complain|reklamo|magreklamo|mag-ulat|ulat|submit)/.test(q)) {
    return '**How to report:** Go to **Submit Report** in the sidebar, choose a category (potholes, floods, garbage, streetlights, etc.), add a title, description and location, attach a photo if you can, and submit. You\u2019ll get a tracking ID (e.g. XR-...) to monitor progress.';
  }
  if (/(announcement|news|update|event|balita|paunawa|anunsyo)/.test(q)) {
    return '**Announcements:** Community announcements, advisories, and upcoming events (cleanups, health checkups, fundraisers) appear on the **Announcements** page and the dashboard panel. New items appear first, so check back regularly.';
  }
  if (/(document|clearance|certificate|barangay|residency|birth|requirements|kailangan|iproseso)/.test(q)) {
    return '**Document requests:** Xevera issues barangay clearances, certificates of residency, and other local documents. Open the **Documents / Services** page to see each document\u2019s requirements and how to request it. You can also contact the Barangay Hall for help.';
  }
  if (/(service|services|office|hall|telephone|phone|email|contact)/.test(q)) {
    return '**Community services:** Document requests, reporting, announcements, garbage info, and more are all in the Services section of this portal. You can also reach the Barangay Hall through the **Contact** page \u2014 include your email or number so staff can reply.';
  }
  if (/(who are you|what are you|hello|hi|hey|kumusta|mabuhay)/.test(q)) {
    return 'I\u2019m **Xevera AI**, the civic assistant for the Xevera Portal. I help with reports, garbage, documents, announcements and services \u2014 in English, Filipino or Taglish. What do you need help with?';
  }
  if (/(english|filipino|tagalog|taglish|language)/.test(q)) {
    return 'I can answer in English, Filipino or Taglish! Just ask your question in the language you prefer. How can I help?';
  }
  return 'I can help you with report status, garbage schedules, document requests, announcements, and contacting the Barangay Hall \u2014 in English, Filipino or Taglish. Try one of the quick questions below!';
}

export default function XeverAIChat() {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I\u2019m Xevera AI. How can I help with your community today?' },
  ]);
  const [input, setInput] = useState('');
  const [footerVisible, setFooterVisible] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, typing, open]);

  /* Hide the floating button when the page footer is in view so it
   * never covers footer contact/social links on mobile. */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return undefined;
    const footer = document.querySelector('footer');
    if (!footer) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );
    obs.observe(footer);
    return () => obs.disconnect();
  }, []);

  function send(raw) {
    const text = (raw || input).trim();
    if (!text || typing) return;
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, { role: 'bot', text: botReply(text) }]);
    }, 900);
  }

  return (
    <div className="fixed bottom-[76px] md:bottom-6 right-6 z-50 flex flex-col items-end gap-3 pb-[env(safe-area-inset-bottom)]">
      {open && (
        <div className="w-[340px] max-w-[calc(100vw-3rem)] bg-white rounded-[22px] border border-[#E5E7EB] shadow-[0_20px_50px_rgba(16,24,40,0.18)] overflow-hidden animate-rise flex flex-col">
          <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: 'linear-gradient(120deg,#1258E8 0%,#0B3AAB 100%)' }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base">✦</div>
            <div className="flex-1">
              <div className="text-sm font-extrabold">Ask Xevera AI</div>
              <div className="flex items-center gap-1.5 text-[10px] text-white/85">
                <span className="w-1.5 h-1.5 rounded-full bg-xevera-400" /> Digital Assistant · online
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white cursor-pointer" aria-label="Close chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div ref={bodyRef} className="flex-1 px-4 py-4 space-y-3 overflow-y-auto max-h-[320px] bg-[#F8FAFC]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed rounded-2xl whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-xevera-600 text-white rounded-br-md'
                    : 'bg-white border border-[#E5E7EB] text-[#374151] rounded-bl-md'
                }`}>{m.text}</div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#E5E7EB] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-3 pt-2 flex flex-wrap gap-1.5 pb-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="px-3 py-1.5 rounded-full bg-xevera-50 text-xevera-600 text-[11px] font-bold hover:bg-xevera-100 transition-colors cursor-pointer">
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#E5E7EB] bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask Xevera AI..."
              className="flex-1 px-3.5 py-2.5 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] text-sm focus:outline-2 focus:outline-xevera-600"
            />
            <button onClick={() => send()} className="w-10 h-10 rounded-full bg-xevera-600 hover:bg-xevera-700 text-white flex items-center justify-center cursor-pointer transition-colors" aria-label="Send">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        className={`w-14 h-14 rounded-full text-white flex items-center justify-center shadow-[0_12px_30px_rgba(18,88,232,0.45)] hover:shadow-[0_14px_34px_rgba(18,88,232,0.5)] transition-all duration-300 cursor-pointer ${
          footerVisible && !open ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
        style={{ background: 'linear-gradient(120deg,#1258E8,#0B3AAB)' }}
        aria-label="Open Xevera AI"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8a4 4 0 0 0-8 0c0 4.5 8 7.5 8 7.5s8-3 8-7.5a4 4 0 0 0-8 0Z" />
          </svg>
        )}
      </button>
    </div>
  );
}