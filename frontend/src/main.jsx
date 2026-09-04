import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import App from './App';
import './styles/globals.css';
import './styles/theme.css';
import './styles/ui.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SettingsProvider>
  </StrictMode>
);
