import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { EditorialButton, EditorialModal } from './ui/EditorialPrimitives';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <EditorialButton
        variant="secondary"
        size="sm"
        onClick={install}
        title="Instalar aplicación en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{compact ? 'Instalar' : 'Instalar app'}</span>
      </EditorialButton>
    );
  }

  if (isIOS) {
    return (
      <>
        <EditorialButton
          variant="secondary"
          size="sm"
          onClick={() => setShowIOSGuide(true)}
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Instalar</span>
        </EditorialButton>

        <EditorialModal
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          kicker="Aplicación web progresiva"
          title="Instalar en iPhone / iPad"
          maxWidthClass="max-w-sm"
        >
          <p className="text-sm leading-relaxed text-[var(--editorial-muted)]">
            1. Toca el botón <strong className="text-[var(--editorial-ink)]">Compartir</strong> en la barra inferior de Safari.
            <br />
            2. Desliza hacia abajo y selecciona <strong className="text-[var(--editorial-ink)]">Agregar a inicio</strong>.
          </p>
          <EditorialButton
            variant="ink"
            size="lg"
            className="w-full"
            onClick={() => setShowIOSGuide(false)}
          >
            Entendido
          </EditorialButton>
        </EditorialModal>
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
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-[#111111] text-white border border-[var(--editorial-primary)] px-4 py-2 text-xs font-display tracking-wide shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-[var(--editorial-primary)]" aria-hidden="true" />
      <span>Sin conexión — Mostrando contenido en caché</span>
    </div>
  );
};
