/**
 * Helper to safely write to localStorage wrapper to avoid QuotaExceededError or SecurityError.
 * Automatically falls back to an in-memory store in sandboxed or restricted iframe preview environments.
 */

const memoryStore: Record<string, string> = {};

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return false;
    }
    const storage = window.localStorage;
    if (!storage) {
      return false;
    }
    const testKey = '__test_storage_avail__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const storageAvailable = isStorageAvailable();

export function safeLocalStorageGet(key: string): string | null {
  try {
    if (storageAvailable && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (e) {
    console.warn(`[StorageFallback] Failed to read key "${key}" from localStorage:`, e);
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    if (storageAvailable && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return true;
    }
  } catch (e: any) {
    const isQuotaError = 
      e.name === 'QuotaExceededError' || 
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || 
      e.code === 22 || 
      e.code === 1014;

    if (isQuotaError && storageAvailable && typeof window !== 'undefined' && window.localStorage) {
      console.warn(`[StorageFallback] Adhering to quota: clearing transient local caches for key "${key}"`);
      try {
        const storage = window.localStorage;
        // Find and delete all cache-related keys
        Object.keys(storage).forEach(k => {
          if (
            k.startsWith('local_cache_') || 
            k.startsWith('cache_') || 
            k.includes('_cache_') || 
            k === 'local_cache_view_subject'
          ) {
            storage.removeItem(k);
          }
        });
        
        // Try setting it one more time
        storage.setItem(key, value);
        return true;
      } catch (retryError) {
        console.warn(`[StorageFallback] Switched to memory store for key "${key}":`, retryError);
      }
    } else {
      console.warn(`[StorageFallback] Switched to memory store for key "${key}":`, e);
    }
  }
  
  // In-memory fallback
  memoryStore[key] = String(value);
  return true;
}

export function safeLocalStorageRemove(key: string): boolean {
  try {
    if (storageAvailable && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return true;
    }
  } catch (e) {
    console.warn(`[StorageFallback] Failed to remove key "${key}" from localStorage:`, e);
  }
  delete memoryStore[key];
  return true;
}

export function safeLocalStorageClear(): boolean {
  try {
    if (storageAvailable && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
      return true;
    }
  } catch (e) {
    console.warn(`[StorageFallback] Failed to clear localStorage:`, e);
  }
  Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  return true;
}

export function safeLocalStorageKeys(): string[] {
  try {
    if (storageAvailable && typeof window !== 'undefined' && window.localStorage) {
      return Object.keys(window.localStorage);
    }
  } catch (e) {
    console.warn('[StorageFallback] Failed to get keys from localStorage:', e);
  }
  return Object.keys(memoryStore);
}

