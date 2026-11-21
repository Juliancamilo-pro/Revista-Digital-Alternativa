import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 px-3.5 py-1.5 text-xs font-display font-semibold tracking-wide uppercase hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Instalar aplicación en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{compact ? 'Instalar' : 'Instalar app'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 px-3.5 py-1.5 text-xs font-display font-semibold tracking-wide uppercase hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Instalar</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
            <div className="w-full max-w-sm rounded-2xl bg-[#F8F6F1] dark:bg-[#171717] border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl">
              <h3 id="ios-install-title" className="font-display text-xl font-bold uppercase tracking-tight">
                Instalar en iPhone / iPad
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.
                <br />
                2. Desliza hacia abajo y selecciona <strong>Agregar a inicio</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-full bg-[#111111] dark:bg-white text-white dark:text-black py-2.5 text-sm font-display font-bold uppercase tracking-wider cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-[#111111] text-white border border-[#B91C1C] px-4 py-2 text-xs font-display tracking-wide shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#EF4444]" aria-hidden="true" />
      <span>Sin conexión — Mostrando contenido en caché</span>
    </div>
  );
};
