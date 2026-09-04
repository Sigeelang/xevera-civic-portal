import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await apiFetch('settings/get.php');
      setSettings(data);
    } catch {
      // keep existing settings on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  const value = {
    settings,
    loading,
    siteName: settings.site_name || 'Xevera Civic Platform',
    categories: Array.isArray(settings.categories) ? settings.categories : [],
    reportsPerPage: Math.min(50, Math.max(1, parseInt(settings.reports_per_page, 10) || 8)),
    maxPhotos: Math.max(1, parseInt(settings.max_photos, 10) || 5),
    maxSizeMb: Math.max(1, parseInt(settings.max_file_size_mb, 10) || 5),
    maintenanceMode: settings.maintenance_mode === '1',
    maintenanceScheduledAt: settings.maintenance_scheduled_at || null,
    maintenanceTitle: settings.maintenance_title || 'Website Under Maintenance',
    maintenanceHeadline: settings.maintenance_headline || 'We\u2019ll Be Back Soon!',
    maintenanceDescription: settings.maintenance_description || 'Our team is currently improving the system. Thank you for your patience.',
    maintenanceFooter: settings.maintenance_footer || 'Thank you for your patience and understanding.',
    maintenanceReturn: settings.maintenance_return || null,
    maintenanceEmergencyPhone: settings.maintenance_emergency_phone || '',
    maintenanceEmergencyEmail: settings.maintenance_emergency_email || '',
    maintenanceEmergencyFacebook: settings.maintenance_emergency_facebook || '',
    maintenanceAllowedRoles: (() => {
      const raw = settings.maintenance_allowed_roles;
      if (!raw) return ['Super Admin', 'Admin'];
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : ['Super Admin', 'Admin'];
      } catch {
        return ['Super Admin', 'Admin'];
      }
    })(),
    maintenanceNotifications: (() => {
      const raw = settings.maintenance_notifications;
      if (!raw) return { email_admin: true, notify_staff: true, countdown: true, estimated_completion: true, reason: true, emergency_contact: false };
      try {
        const obj = JSON.parse(raw);
        return typeof obj === 'object' && obj !== null ? obj : {};
      } catch {
        return {};
      }
    })(),
    registrationEnabled: settings.registration_enabled !== '0',
    idleTimeoutMinutes: (() => {
      const v = parseInt(settings.session_inactivity_minutes, 10);
      if (!Number.isFinite(v)) return 15;
      return Math.min(120, Math.max(1, v));
    })(),
    heroBanner: settings.hero_banner || null,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
