import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function usePWAUpdate() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || import.meta.env.DEV) return;
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedsRefresh(true);
        },
        onOfflineReady() {
          // Offline shell cached cleanly
        },
        onRegisteredSW(_swUrl, registration) {
          if (registration) {
            setInterval(() => {
              registration.update().catch(() => undefined);
            }, 60 * 60 * 1000);
          }
        },
      });
      updateSwRef.current = updateSW;
    } catch {
      // Safe fallback when SW is unavailable
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    setNeedsRefresh(false);
    if (updateSwRef.current) {
      await updateSwRef.current(true);
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setNeedsRefresh(false);
  }, []);

  return {
    needsRefresh,
    applyUpdate,
    dismissUpdate,
  };
}
