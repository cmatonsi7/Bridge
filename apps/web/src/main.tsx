import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './features/auth/AuthProvider';
import { ToastProvider } from './components/Toast';
import { AppRouter } from './app/router';
import { initSentry } from './lib/sentry';
import './styles/index.css';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
