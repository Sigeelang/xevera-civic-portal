import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import CivicIllustration from '../../components/public/CivicIllustration';
import Icon from '../../components/Icon';

export default function ContactPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('settings/get.php')
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const address = settings?.barangay_address || 'Xevera, Calibutbut, Bacolor';
  const email = settings?.contact_email || 'civicdesk@xevera.gov.ph';
  const phone = settings?.contact_phone || '(02) 8123-4567';

  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-[18px] border border-[#E5E7EB] p-7.5 max-w-[700px]">
        <div className="h-7 w-32 bg-[#F3F4F6] rounded mb-3" />
        <div className="h-4 w-full bg-[#F3F4F6] rounded mb-2" />
        <div className="h-4 w-3/4 bg-[#F3F4F6] rounded mb-2" />
        <div className="h-4 w-1/2 bg-[#F3F4F6] rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]">
      <div className="max-w-[700px] bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-7.5">
        <h2 className="text-xl font-head font-extrabold mb-2.5 text-[#111827]">Contact</h2>
        <div className="text-sm text-[#6B7280] leading-relaxed space-y-2.5">
          <p className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center flex-shrink-0">
              <Icon name="pin" size={18} />
            </span>
            {address}
          </p>
          <p className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#DBEAFE] border border-[#BFDBFE] text-xevera-600 flex items-center justify-center flex-shrink-0">
              <Icon name="mail" size={18} />
            </span>
            {email}
          </p>
          <p className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] flex items-center justify-center flex-shrink-0">
              <Icon name="phone" size={18} />
            </span>
            {phone}
          </p>
        </div>
      </div>
    </div>
  );
}
