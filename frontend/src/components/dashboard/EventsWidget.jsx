import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';

const EVENT_COLORS = ['from-[#2563EB] to-[#3B82F6]', 'from-[#1EA85B] to-[#15803D]', 'from-[#8B5CF6] to-[#6D28D9]'];

export default function EventsWidget({ onNavigate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('community/events.php?limit=3')
      .then(d => setEvents(d.items || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-head font-extrabold text-[#0B1220]">Upcoming Events</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Calendar</span>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-[#E5E7EB] rounded-xl animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-[#64748B] py-4 text-center">No upcoming events.</p>
      ) : (
        <div className="space-y-3">
          {events.map((e, i) => (
            <div key={e.id} className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${EVENT_COLORS[i % EVENT_COLORS.length]} text-white flex flex-col items-center justify-center flex-shrink-0 shadow-sm`}>
                <span className="text-[9px] font-bold leading-none uppercase">{e.date?.split(' ')[0]}</span>
                <span className="text-[14px] font-extrabold leading-none mt-0.5">{e.date?.split(' ')[1]}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[#0B1220] truncate">{e.title}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">{e.location} · {e.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}