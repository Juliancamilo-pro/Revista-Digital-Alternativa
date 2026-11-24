import React from 'react';
import { Eye, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSite } from '../../context/SiteContext';
import { useTheme } from '../../context/ThemeContext';

export const ThemePreviewFloatingBar: React.FC = () => {
  const { isAdmin } = useAuth();
  const { navigate, currentPath } = useSite();
  const { isPreviewing, activeTheme, setPreviewThemeId } = useTheme();

  if (!isAdmin || !isPreviewing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[95vw] rounded-full border border-[var(--editorial-primary)] bg-[#111111] text-white px-4 py-2 shadow-2xl flex flex-wrap items-center justify-center gap-2.5 text-xs"
    >
      <Eye className="w-3.5 h-3.5 text-[var(--editorial-primary)] shrink-0" aria-hidden="true" />
      <span className="font-display font-bold uppercase tracking-wider truncate">
        Vista previa: {activeTheme.emoji} {activeTheme.name}
      </span>
      {!currentPath.startsWith('/admin') && (
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="px-3 py-1 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider cursor-pointer transition-colors"
        >
          Volver al panel
        </button>
      )}
      <button
        type="button"
        onClick={() => setPreviewThemeId(null)}
        aria-label="Cerrar vista previa de tema"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/25 text-neutral-200 hover:text-white font-display font-bold uppercase tracking-wider cursor-pointer"
      >
        <X className="w-3 h-3" aria-hidden="true" />
        <span>Salir</span>
      </button>
    </div>
  );
};
