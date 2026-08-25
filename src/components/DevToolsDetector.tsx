import { useEffect, useRef } from 'react';
import {
  clearAuthStorage,
  enforceSecurityLock,
  isSecurityLocked,
} from '@/lib/security-lock';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=kYJjYy_PmqA';

async function hardSignOut() {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // ignore
  }
  clearAuthStorage();
}

/**
 * Inspection deterrent — ONLY on explicit shortcuts (F12, Ctrl+Shift+I, etc.).
 *
 * Important: we do NOT use window-size or debugger polling.
 * Those caused false positives on normal desktop browsers (black screen).
 *
 * After a trigger:
 * - auth is wiped
 * - security lock is set (blocks auto-login until password login)
 * - user is sent to YouTube
 *
 * Returning via Back lands on the public site logged-out (no black overlay).
 */
export function DevToolsDetector() {
  const triggeredRef = useRef(false);

  useEffect(() => {
    // If lock is active: log the user out silently, never paint a black screen.
    // Auto-login is blocked until a real password login clears the lock.
    const applyLockQuietly = async () => {
      if (!isSecurityLocked()) return;
      await hardSignOut();
      const path = window.location.pathname || '/';
      const isPublic =
        path === '/' ||
        path.startsWith('/auth') ||
        path.startsWith('/blog') ||
        path.startsWith('/docs') ||
        path.startsWith('/legal');
      if (!isPublic) {
        window.location.replace('/');
      }
    };

    applyLockQuietly();

    const onPageShow = () => {
      applyLockQuietly();
    };
    window.addEventListener('pageshow', onPageShow);

    // Dev environment: no protection
    if (import.meta.env.DEV) {
      return () => window.removeEventListener('pageshow', onPageShow);
    }

    const triggerProtection = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;

      enforceSecurityLock();
      hardSignOut();

      try {
        window.history.replaceState(null, '', '/');
      } catch {
        // ignore
      }

      try {
        window.location.replace(YOUTUBE_URL);
      } catch {
        try {
          window.location.href = YOUTUBE_URL;
        } catch {
          try {
            window.open(YOUTUBE_URL, '_self');
          } catch {
            // ignore
          }
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase?.() || '';
      const isF12 = e.key === 'F12' || e.code === 'F12';
      const isCtrlShift =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === 'i' || key === 'j' || key === 'c' || key === 'k');
      const isViewSource = (e.ctrlKey || e.metaKey) && key === 'u';
      const isMacDevTools = e.metaKey && e.altKey && (key === 'i' || key === 'j' || key === 'c');
      const isMacElements = e.metaKey && e.altKey && key === 'u';

      if (isF12 || isCtrlShift || isViewSource || isMacDevTools || isMacElements) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection();
        return false;
      }
    };

    
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'IMG' || target.closest?.('img'))) {
        e.preventDefault();
      }
    };

    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'IMG' || target.closest?.('img'))) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('dragstart', handleDragStart, true);
    window.addEventListener('selectstart', handleSelectStart, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('dragstart', handleDragStart, true);
      window.removeEventListener('selectstart', handleSelectStart, true);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  // Never render a blocking black overlay — that was freezing the PC view.
  return null;
}

export { clearSecurityLock } from '@/lib/security-lock';
