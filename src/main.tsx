import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './internato/index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Register PWA Service Worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('MedRevise SW registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.warn('MedRevise SW registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Register in dev mode too so we can test, but handle gracefully
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('MedRevise SW registered (dev):', registration.scope);
      })
      .catch((error) => {
        console.log('MedRevise SW skipped registration in local debug environment:', error);
      });
  });
}

