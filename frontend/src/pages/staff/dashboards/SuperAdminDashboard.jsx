import { useAuth } from '../../../context/AuthContext';
import AdminDashboard from './AdminDashboard';

export default function SuperAdminDashboard({ onNavigate }) {
  const { user } = useAuth();

  return (
    <AdminDashboard
      onNavigate={onNavigate}
      eyebrow="Super Admin"
      title="Super Admin Dashboard"
      description={`Welcome back, ${user?.name || 'Admin User'}`}
    />
  );
}
