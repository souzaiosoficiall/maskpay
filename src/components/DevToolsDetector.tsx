import { useEffect, useRef, useState } from 'react';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=kYJjYy_PmqA';

/**
 * Client-side inspection deterrent.
 * When DevTools / inspection is detected, covers the UI and forces
 * navigation to the configured YouTube video immediately.
 *
 * Note: this is not true security — anything in the browser can be bypassed.
 * It raises the bar for casual inspection only.
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

      // Hide page content immediately (no icons / UI visible)
      try {
        document.documentElement.style.visibility = 'hidden';
        document.body.style.visibility = 'hidden';
        document.body.innerHTML = '';
      } catch {
        // ignore
      }

      // Force navigate to YouTube (more reliable than window.open which is often blocked)
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

    // Block context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Block common inspection shortcuts (Windows / Linux / Mac)
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

    // Dimension-based detection (docked DevTools)
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

    // debugger timing detection
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

    // console firebug / toString tricks (legacy but still useful)
    const checkConsole = () => {
      try {
        const el = new Image();
        Object.defineProperty(el, 'id', {
          get: function () {
            triggerProtection();
            return '';
          },
        });
        // This may invoke the getter when DevTools is open and logging
        // eslint-disable-next-line no-console
        console.log('%c', el as any);
      } catch {
        // ignore
      }
    };

    const detect = () => {
      if (triggeredRef.current) return;
      if (checkDimensions()) return;
      if (checkDebugger()) return;
      checkConsole();
    };

    // Faster polling so opening DevTools is caught quickly
    const interval = window.setInterval(detect, 800);
    // Run once immediately
    detect();

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', checkDimensions);

    // Also watch for visibility of firebug-like elements
    let observer: MutationObserver | null = null;
    try {
      observer = new MutationObserver(() => {
        if (triggeredRef.current) return;
        // Some extensions inject elements when inspecting
        if (document.getElementById('__vue-devtools-root') || document.getElementById('react-devtools-root')) {
          triggerProtection();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
      // ignore
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', checkDimensions);
      try {
        observer?.disconnect();
      } catch {
        // ignore
      }
    };
  }, []);

  if (!isDetected) return null;

  // Pure black overlay — no icons, no UI chrome
  return (
    <div
      className="fixed inset-0 z-[999999] bg-black"
      style={{ visibility: 'visible' }}
      aria-hidden
    />
  );
}
