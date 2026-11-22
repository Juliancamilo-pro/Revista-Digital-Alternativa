import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DataSaverMode } from '../types/editorial';

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface DataSaverContextValue {
  mode: DataSaverMode;
  setMode: (mode: DataSaverMode) => void;
  isDataSaverActive: boolean;
  connectionLabel: string;
  autoNotice: string | null;
  dismissAutoNotice: () => void;
}

const STORAGE_KEY = 'revista_data_saver_mode';
const DataSaverContext = createContext<DataSaverContextValue | null>(null);

function getNavigatorConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

export const DataSaverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<DataSaverMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'on' || saved === 'off' || saved === 'auto') return saved;
    return 'auto';
  });

  const [autoDetectedSlow, setAutoDetectedSlow] = useState(false);
  const [connectionLabel, setConnectionLabel] = useState('Conexión estable');
  const [autoNotice, setAutoNotice] = useState<string | null>(null);

  const consecutiveSlowRef = useRef(0);
  const consecutiveFastRef = useRef(0);
  const prevAutoRef = useRef(false);

  const setMode = useCallback((next: DataSaverMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
    if (next !== 'auto') {
      setAutoNotice(null);
    }
  }, []);

  const dismissAutoNotice = useCallback(() => {
    setAutoNotice(null);
  }, []);

  const evaluateConnection = useCallback(async (withProbe = false) => {
    if (typeof navigator === 'undefined') return;

    const offline = navigator.onLine === false;
    const conn = getNavigatorConnection();
    const saveData = Boolean(conn?.saveData);
    const eff = conn?.effectiveType || '';
    const downlink = typeof conn?.downlink === 'number' ? conn.downlink : undefined;

    let looksSlow = offline || saveData || ['slow-2g', '2g', '3g'].includes(eff) || (downlink !== undefined && downlink > 0 && downlink < 1.6);

    if (offline) {
      setConnectionLabel('Sin conexión');
    } else if (saveData) {
      setConnectionLabel('Ahorro del navegador');
    } else if (eff) {
      setConnectionLabel(`Red ${eff.toUpperCase()}`);
    }

    if (!offline && !looksSlow && withProbe) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const start = performance.now();
        const res = await fetch(`/favicon.png?ds=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          await res.arrayBuffer();
          const elapsed = performance.now() - start;
          if (elapsed > 1250) {
            looksSlow = true;
            setConnectionLabel('Red lenta detectada');
          } else {
            setConnectionLabel('Conexión rápida');
          }
        }
      } catch {
        looksSlow = true;
        setConnectionLabel('Red inestable');
      }
    }

    // 2-reading hysteresis to avoid jitter unless browser Save-Data or offline is explicit
    if (offline || saveData) {
      consecutiveSlowRef.current = 2;
      consecutiveFastRef.current = 0;
      setAutoDetectedSlow(true);
    } else if (looksSlow) {
      consecutiveSlowRef.current += 1;
      consecutiveFastRef.current = 0;
      if (consecutiveSlowRef.current >= 2 || eff === 'slow-2g' || eff === '2g') {
        setAutoDetectedSlow(true);
      }
    } else {
      consecutiveFastRef.current += 1;
      consecutiveSlowRef.current = 0;
      if (consecutiveFastRef.current >= 2) {
        setAutoDetectedSlow(false);
      }
    }
  }, []);

  useEffect(() => {
    if (mode !== 'auto') return;

    evaluateConnection(false);
    const probeTimer = setInterval(() => {
      evaluateConnection(true);
    }, 30000);

    const onOnlineStatus = () => evaluateConnection(false);
    window.addEventListener('online', onOnlineStatus);
    window.addEventListener('offline', onOnlineStatus);

    const conn = getNavigatorConnection();
    const onConnChange = () => evaluateConnection(false);
    conn?.addEventListener?.('change', onConnChange);

    return () => {
      clearInterval(probeTimer);
      window.removeEventListener('online', onOnlineStatus);
      window.removeEventListener('offline', onOnlineStatus);
      conn?.removeEventListener?.('change', onConnChange);
    };
  }, [mode, evaluateConnection]);

  useEffect(() => {
    if (mode !== 'auto') {
      prevAutoRef.current = false;
      return;
    }
    if (autoDetectedSlow && !prevAutoRef.current) {
      setAutoNotice('Conexión lenta detectada: activamos el modo ahorro de datos para acelerar la lectura.');
    } else if (!autoDetectedSlow && prevAutoRef.current) {
      setAutoNotice('Conexión restablecida: carga multimedia normal restaurada.');
    }
    prevAutoRef.current = autoDetectedSlow;
  }, [autoDetectedSlow, mode]);

  const isDataSaverActive = useMemo(() => {
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return autoDetectedSlow;
  }, [mode, autoDetectedSlow]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('data-saver-active', isDataSaverActive);
  }, [isDataSaverActive]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      isDataSaverActive,
      connectionLabel,
      autoNotice,
      dismissAutoNotice,
    }),
    [mode, setMode, isDataSaverActive, connectionLabel, autoNotice, dismissAutoNotice]
  );

  return <DataSaverContext.Provider value={value}>{children}</DataSaverContext.Provider>;
};

export function useDataSaver() {
  const ctx = useContext(DataSaverContext);
  if (!ctx) throw new Error('useDataSaver debe usarse dentro de DataSaverProvider');
  return ctx;
}
