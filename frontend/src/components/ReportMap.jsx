import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_COLORS = {
  Pending: '#F59E0B',
  'In Progress': '#2563EB',
  Resolved: '#1EA85B',
  Rejected: '#DC2626',
};

const DEFAULT_CENTER = [14.5995, 121.0];

export default function ReportMap({ items = [], height = 420, onViewReport }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const located = (items || []).filter((r) => r.latitude != null && r.longitude != null);

    located.forEach((r) => {
      const color = STATUS_COLORS[r.status] || '#0D6EFD';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:#fff;font-size:10px;font-weight:800;">${String(r.id).replace(/\D/g, '').slice(0, 3)}</span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -18],
      });
      const marker = L.marker([r.latitude, r.longitude], { icon }).addTo(map);
      const popup = L.popup({ offset: [0, -14] });
      const body = `
        <div style="font-family:'Inter',sans-serif;min-width:170px;">
          <div style="font-weight:800;font-size:13px;margin-bottom:2px;">${String(r.id).replace(/</g, '&lt;')} · ${String(r.title).replace(/</g, '&lt;')}</div>
          <div style="font-size:11px;color:#64748B;">${String(r.category || '').replace(/</g, '&lt;')} · ${String(r.status || '').replace(/</g, '&lt;')}</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px;">${String(r.location || '').replace(/</g, '&lt;')}</div>
          ${onViewReport ? `<button data-ref="${String(r.id).replace(/"/g, '&quot;')}" style="margin-top:8px;width:100%;padding:5px 0;border:0;border-radius:8px;background:#0D6EFD;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">View report</button>` : ''}
        </div>`;
      popup.setContent(body);
      marker.bindPopup(popup);

      if (onViewReport) {
        marker.on('popupopen', () => {
          const btn = document.querySelector(`[data-ref="${String(r.id).replace(/"/g, '&quot;')}"]`);
          if (btn) btn.onclick = () => onViewReport(r.id);
        });
      }

      markersRef.current.push(marker);
    });

    if (located.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.3));
    }
  }, [items, onViewReport]);

  return <div ref={containerRef} style={{ height }} className="w-full rounded-[20px] overflow-hidden border border-line z-0" />;
}
