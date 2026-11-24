import React, { useMemo, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useSite } from '../../context/SiteContext';
import { useTheme } from '../../context/ThemeContext';
import { getCountdownDaysColombia } from '../../themes';

export const ThemeGreetingBanner: React.FC = () => {
  const { navigate } = useSite();
  const { showBanner, activeTheme, themeBanner } = useTheme();
  const [dismissedKey, setDismissedKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem('revista_theme_banner_dismissed') || '';
    } catch {
      return '';
    }
  });

  const displayText = themeBanner.text.trim() || activeTheme.defaultBannerText || '';
  const displayEmoji = themeBanner.emoji || activeTheme.defaultBannerEmoji || activeTheme.emoji;
  const currentKey = `${activeTheme.id}:${displayText}`;

  const countdown = useMemo(
    () => getCountdownDaysColombia(themeBanner.countdownTarget),
    [themeBanner.countdownTarget]
  );

  if (!showBanner || !displayText || dismissedKey === currentKey) {
    return null;
  }

  const handleDismiss = () => {
    setDismissedKey(currentKey);
    try {
      sessionStorage.setItem('revista_theme_banner_dismissed', currentKey);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div
      role="region"
      aria-label={`Aviso especial: ${activeTheme.name}`}
      className="border-b border-[var(--editorial-border)] bg-[var(--editorial-primary)] text-white"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          {displayEmoji && (
            <span aria-hidden="true" className="text-base leading-none shrink-0">
              {displayEmoji}
            </span>
          )}
          <p className="font-editorial font-medium leading-snug text-white">
            {displayText}
          </p>
          {countdown && (
            <span className="font-display text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/25 text-white shrink-0">
              {countdown.label}
            </span>
          )}
          {themeBanner.ctaLabel && themeBanner.ctaPath && (
            <button
              type="button"
              onClick={() => navigate(themeBanner.ctaPath!)}
              className="inline-flex items-center gap-1 font-display text-xs font-bold uppercase tracking-wider underline underline-offset-4 hover:opacity-90 cursor-pointer shrink-0"
            >
              <span>{themeBanner.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar saludo editorial"
          className="p-1 rounded-full hover:bg-black/20 text-white/90 hover:text-white cursor-pointer shrink-0 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
