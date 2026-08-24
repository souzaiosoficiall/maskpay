/**
 * After DevTools is detected we set a lock so browser Back (bfcache)
 * cannot restore a logged-in session from memory.
 */
export const SECURITY_LOCK_KEY = 'maskpay-security-lock';

export function isSecurityLocked(): boolean {
  try {
    return window.localStorage.getItem(SECURITY_LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSecurityLock(): void {
  try {
    window.localStorage.setItem(SECURITY_LOCK_KEY, '1');
  } catch {
    // ignore
  }
}

export function clearSecurityLock(): void {
  try {
    window.localStorage.removeItem(SECURITY_LOCK_KEY);
  } catch {
    // ignore
  }
}

/** Wipe every auth-related key EXCEPT the security lock flag. */
export function clearAuthStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === SECURITY_LOCK_KEY) continue;
      const lower = key.toLowerCase();
      if (
        lower.includes('supabase') ||
        lower.includes('auth') ||
        lower.includes('maskpay') ||
        lower.includes('sb-')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }

  try {
    // Keep security lock if present
    const locked = sessionStorage.getItem(SECURITY_LOCK_KEY);
    sessionStorage.clear();
    if (locked) sessionStorage.setItem(SECURITY_LOCK_KEY, locked);
  } catch {
    // ignore
  }
}

/** Full lock + wipe — call when DevTools is detected. */
export function enforceSecurityLock(): void {
  setSecurityLock();
  clearAuthStorage();
  try {
    sessionStorage.removeItem('maskpay-app-unlocked');
  } catch {
    // ignore
  }
}
