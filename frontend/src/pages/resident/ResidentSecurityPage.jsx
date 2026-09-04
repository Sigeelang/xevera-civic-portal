import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import ResidentLoginSessions from '../../components/resident/ResidentLoginSessions';

export default function ResidentSecurityPage({ onNavigate }) {
  return (
    <ResidentLayout activePage="my-account" pageTitle="Login & Sessions" onNavigate={onNavigate}>
        <header className="mb-6">
          <button onClick={() => onNavigate && onNavigate('my-account')}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#075FF5] mb-3 bg-none border-none cursor-pointer hover:underline">
            {'\u2190'} Back to My Account
          </button>
          <ResidentPageHeader
            title="Login & Sessions"
            subtitle="Review your recent logins and the devices signed in to your XEVERA account."
          />
        </header>

        <ResidentLoginSessions />
    </ResidentLayout>
  );
}