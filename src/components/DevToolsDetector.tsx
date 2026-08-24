import { useEffect, useRef, useState } from 'react';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=kYJjYy_PmqA';

/**
 * Wipe local auth so browser "Back" after the YouTube redirect
 * cannot restore a logged-in session.
 */
function clearAuthState() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
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
    sessionStorage.clear();
  } catch {
    // ignore
  }

  // Best-effort sign out via Supabase client (dynamic import to avoid circular deps)
  try {
    import('@/integrations/supabase/client')
      .then(({ supabase }) => supabase.auth.signOut({ scope: 'local' }))
      .catch(() => undefined);
  } catch {
    // ignore
  }
}

/**
 * Client-side inspection deterrent.
 * When DevTools / inspection is detected:
 * 1. Clears any persisted login session
 * 2. Covers the UI (no icons)
 * 3. Forces navigation to the configured YouTube video
 *
 * Clearing auth prevents "Back" from landing inside a logged-in account.
 */
export function DevToolsDetector() {
  const [isDetected, setIsDetected] = useState(false);
  const triggeredRef = useRef(false);

  useEffect(() => {
    // Allow local development
    if (import.meta.env.DEV) return;

    const triggerProtection = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      setIsDetected(true);

      // CRITICAL: destroy session before leaving so Back cannot restore the app logged-in
      clearAuthState();

      // Hide page content immediately (no icons / UI visible)
      try {
        document.documentElement.style.visibility = 'hidden';
        document.body.style.visibility = 'hidden';
      } catch {
        // ignore
      }

      // Replace current history entry so Back does not return to the form mid-session
      try {
        window.history.replaceState(null, '', '/');
      } catch {
        // ignore
      }

      // Force navigate to YouTube
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

    // If user returns via Back/forward cache with DevTools still open, re-check
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Coming from bfcache — ensure we are not authenticated if protection already fired
        if (triggeredRef.current) {
          clearAuthState();
          window.location.replace('/');
        } else {
          detect();
        }
      }
    };
    window.addEventListener('pageshow', onPageShow);

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
