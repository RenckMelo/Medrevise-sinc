import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './internato/index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Global polyfill/patch for DOM node manipulation errors caused by browser extensions or Google Translate
if (typeof window !== 'undefined' && typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('DOM Guard: Prevented removeChild error on mismatched parentNode', child, this);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('DOM Guard: Prevented insertBefore error on mismatched parentNode', newNode, referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Programmatically unlock screen orientation and listen for device rotation in mobile PWAs
if (typeof window !== 'undefined') {
  const recheckViewportOrientation = () => {
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.unlock === 'function') {
      try {
        window.screen.orientation.unlock();
      } catch {
        // Ignore if not supported by browser policy
      }
    }
    window.dispatchEvent(new Event('resize'));
  };

  recheckViewportOrientation();
  window.addEventListener('orientationchange', recheckViewportOrientation);
  window.addEventListener('resize', recheckViewportOrientation);
}

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

