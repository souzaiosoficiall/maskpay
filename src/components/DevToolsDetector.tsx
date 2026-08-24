import { useEffect, useRef, useState } from 'react';
import {
  clearAuthStorage,
  clearSecurityLock,
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
 * Client-side inspection deterrent.
 *
 * On detect:
 * 1. Sets a durable security lock in localStorage
 * 2. Wipes auth tokens
 * 3. Navigates to YouTube
 *
 * On any later return (Back / bfcache / reopen):
 * if the lock is set → force logout and send user to homepage.
 * Lock is only cleared after a fresh password login.
 */
export function DevToolsDetector() {
  const [isDetected, setIsDetected] = useState(false);
  const triggeredRef = useRef(false);

  useEffect(() => {
    // If user came back via Back button with lock still set, kick them out immediately
    const kickIfLocked = async () => {
      if (!isSecurityLocked()) return;
      triggeredRef.current = true;
      setIsDetected(true);
      await hardSignOut();
      // Stay locked — only successful login clears it
      try {
        document.documentElement.style.visibility = 'hidden';
      } catch {
        // ignore
      }
      const path = window.location.pathname;
      if (path !== '/' && !path.startsWith('/auth')) {
        window.location.replace('/');
      } else {
        try {
          document.documentElement.style.visibility = '';
        } catch {
          // ignore
        }
      }
    };

    // Run on mount (covers Back from YouTube → restored app page)
    kickIfLocked();

    // bfcache restore
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || isSecurityLocked()) {
        kickIfLocked();
      }
    };
    window.addEventListener('pageshow', onPageShow);

    // Allow local development tooling
    if (import.meta.env.DEV) {
      return () => window.removeEventListener('pageshow', onPageShow);
    }

    const triggerProtection = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      setIsDetected(true);

      // Lock + wipe BEFORE leaving — survives Back
      enforceSecurityLock();
      hardSignOut();

      try {
        document.documentElement.style.visibility = 'hidden';
        document.body.style.visibility = 'hidden';
      } catch {
        // ignore
      }

      // Nuke in-tab history so Back cannot land on an authenticated route
      try {
        const home = window.location.origin + '/';
        window.history.replaceState(null, '', home);
        // Push a disposable entry then replace with YouTube via location
      } catch {
        // ignore
      }

      try {
        window.location.replace(YOUTUBE_URL);
      } catch {
        try {
          window.location.href = YOUTUBE_URL;
        } catch {
          window.open(YOUTUBE_URL, '_self');
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

    const checkDimensions = () => {
      const threshold = 140;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      if (!isMobile && (widthDiff || heightDiff)) {
        triggerProtection();
        return true;
      }
      return false;
    };

    const checkDebugger = () => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      if (performance.now() - start > 100) {
        triggerProtection();
        return true;
      }
      return false;
    };

    const detect = () => {
      if (triggeredRef.current) return;
      if (checkDimensions()) return;
      if (checkDebugger()) return;
    };

    const interval = window.setInterval(detect, 800);
    detect();

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', checkDimensions);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', checkDimensions);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  if (!isDetected) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] bg-black"
      style={{ visibility: 'visible' }}
      aria-hidden
    />
  );
}

/** Call after successful password login so the user can use the app again. */
export { clearSecurityLock };
