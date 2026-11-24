import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeLogoAccentStyle, ThemeOrnamentId } from '../../types/editorial';

export type OrnamentSizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_STYLE_MAP: Record<OrnamentSizeToken, React.CSSProperties> = {
  xs: { width: '20px', height: '20px' },
  sm: { width: '28px', height: '28px' },
  md: { width: '40px', height: '40px' },
  lg: { width: 'clamp(40px, 9vw, 56px)', height: 'clamp(40px, 9vw, 56px)' },
  xl: { width: 'clamp(52px, 12vw, 80px)', height: 'clamp(52px, 12vw, 80px)' },
};

interface ThemeOrnamentProps {
  id: ThemeOrnamentId;
  size?: OrnamentSizeToken;
  className?: string;
  animatedFlame?: boolean;
}

export const ThemeOrnament: React.FC<ThemeOrnamentProps> = ({
  id,
  size = 'sm',
  className = '',
  animatedFlame = false,
}) => {
  const renderArtwork = () => {
    switch (id) {
      case 'bell':
        return (
          <>
            <path d="M32 10c-10 0-16 8-16 20 0 8-3 12-6 15h44c-3-3-6-7-6-15 0-12-6-20-16-20Z" fill="#D97706" stroke="#92400E" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="32" cy="49" r="5" fill="#B45309" />
            <path d="M24 14c-4 3-5 9-5 15" stroke="#FDE68A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <circle cx="32" cy="8" r="3" fill="#B91C1C" />
          </>
        );
      case 'bauble':
        return (
          <>
            <rect x="27" y="9" width="10" height="6" rx="2" fill="#D97706" />
            <circle cx="32" cy="7" r="2.5" fill="none" stroke="#D97706" strokeWidth="2" />
            <circle cx="32" cy="36" r="19" fill="var(--editorial-primary)" stroke="var(--editorial-accent)" strokeWidth="2.5" />
            <path d="M16 34c8 5 24 5 32 0" stroke="#FDE68A" strokeWidth="2.5" fill="none" />
            <circle cx="25" cy="27" r="3.5" fill="#FFFFFF" opacity="0.35" />
          </>
        );
      case 'star':
        return (
          <path
            d="M32 7l6.9 14.3 15.8 2.2-11.5 11.1 2.8 15.7L32 42.8 18 50.3l2.8-15.7L9.3 23.5l15.8-2.2L32 7Z"
            fill="#F59E0B"
            stroke="#B45309"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        );
      case 'bethlehem_star':
        return (
          <>
            <path d="M32 4l4 19 19 4-19 4-4 25-4-25-19-4 19-4 4-19Z" fill="#FBBF24" stroke="#B45309" strokeWidth="2" strokeLinejoin="round" />
            <path d="M20 15l12 12 12-12-12 12 12 12-12-12-12 12 12-12-12-12Z" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
          </>
        );
      case 'pine':
        return (
          <>
            <rect x="28" y="47" width="8" height="10" rx="1.5" fill="#78350F" />
            <path d="M32 8L15 28h10L13 42h12L11 50h42L39 42h12L39 28h10L32 8Z" fill="#15803D" stroke="#14532D" strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx="32" cy="8" r="3.2" fill="#FBBF24" />
            <circle cx="26" cy="34" r="2.2" fill="#DC2626" />
            <circle cx="38" cy="40" r="2.2" fill="#FBBF24" />
          </>
        );
      case 'gift':
        return (
          <>
            <rect x="13" y="25" width="38" height="29" rx="3" fill="var(--editorial-primary)" stroke="var(--editorial-accent)" strokeWidth="2.2" />
            <rect x="10" y="19" width="44" height="8" rx="2" fill="var(--editorial-accent)" />
            <rect x="29" y="19" width="6" height="35" fill="#FBBF24" />
            <path d="M32 19c-6-9-15-6-12 0h12Zm0 0c6-9 15-6 12 0H32Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1.8" />
          </>
        );
      case 'holly':
        return (
          <>
            <path d="M32 34c-8-14-21-15-23-5 4 4 3 10-1 14 9 2 18-1 24-9Z" fill="#15803D" stroke="#14532D" strokeWidth="2" />
            <path d="M32 34c8-14 21-15 23-5-4 4-3 10 1 14-9 2-18-1-24-9Z" fill="#166534" stroke="#14532D" strokeWidth="2" />
            <circle cx="32" cy="35" r="4.5" fill="#DC2626" />
            <circle cx="27" cy="40" r="4" fill="#B91C1C" />
            <circle cx="37" cy="40" r="4" fill="#B91C1C" />
          </>
        );
      case 'candle':
        return (
          <>
            <rect x="22" y="29" width="20" height="27" rx="3" fill="#FEF3C7" stroke="#D97706" strokeWidth="2.2" />
            <path d="M22 36c6 3 14 0 20 3" stroke="#F59E0B" strokeWidth="2" fill="none" />
            <line x1="32" y1="23" x2="32" y2="29" stroke="#451A03" strokeWidth="2" />
            <g className={animatedFlame ? 'theme-flame-soft' : ''}>
              <path d="M32 8c5 6 7 11 5 15a5.5 5.5 0 0 1-10 0c-2-4 0-9 5-15Z" fill="#F59E0B" />
              <path d="M32 13c2.5 3.5 3.5 6.5 2.5 9a2.8 2.8 0 0 1-5 0c-1-2.5 0-5.5 2.5-9Z" fill="#FEF08A" />
            </g>
          </>
        );
      case 'lantern':
        return (
          <>
            <path d="M26 10h12l4 7H22l4-7Z" fill="#B45309" />
            <rect x="19" y="17" width="26" height="31" rx="4" fill="#FEF3C7" stroke="#92400E" strokeWidth="2.5" />
            <path d="M26 17v31M38 17v31" stroke="#B45309" strokeWidth="2" />
            <circle cx="32" cy="32" r="6" fill="#F59E0B" opacity="0.85" />
            <rect x="22" y="48" width="20" height="6" rx="2" fill="#78350F" />
          </>
        );
      case 'candy_cane':
        return (
          <>
            <path d="M24 22a10 10 0 0 1 20 0v28" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
            <path d="M24 22a10 10 0 0 1 20 0v28" fill="none" stroke="#DC2626" strokeWidth="9" strokeDasharray="6 6" strokeLinecap="round" />
            <path d="M24 22a10 10 0 0 1 20 0v28" fill="none" stroke="#991B1B" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          </>
        );
      case 'snowflake':
      case 'frost':
        return (
          <g stroke="#60A5FA" strokeWidth="2.8" strokeLinecap="round" fill="none">
            <line x1="32" y1="8" x2="32" y2="56" />
            <line x1="11" y1="20" x2="53" y2="44" />
            <line x1="53" y1="20" x2="11" y2="44" />
            <path d="M26 14l6 6 6-6M26 50l6-6 6 6M15 27l7-2-2-7M49 37l-7 2 2 7M49 27l-7-2 2-7M15 37l7 2-2 7" />
          </g>
        );
      case 'heart':
        return (
          <path
            d="M32 53S11 40 11 23.5C11 16.5 16.5 11 23 11c4.1 0 7.4 2.1 9 5 1.6-2.9 4.9-5 9-5 6.5 0 12 5.5 12 12.5C53 40 32 53 32 53Z"
            fill="var(--editorial-primary)"
            stroke="var(--editorial-accent)"
            strokeWidth="2.2"
          />
        );
      case 'balloon':
        return (
          <>
            <ellipse cx="32" cy="26" rx="15" ry="18" fill="var(--editorial-primary)" stroke="var(--editorial-accent)" strokeWidth="2.2" />
            <path d="M29 45l3-2 3 2-3 4-3-4Z" fill="var(--editorial-accent)" />
            <path d="M32 49c-3 4 3 6 0 10" stroke="var(--editorial-muted)" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="26" cy="20" rx="3" ry="5" fill="#FFFFFF" opacity="0.3" />
          </>
        );
      case 'pumpkin':
        return (
          <>
            <path d="M30 11c0-3 3-5 6-5" stroke="#15803D" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <ellipse cx="32" cy="35" rx="21" ry="16" fill="#EA580C" stroke="#9A3412" strokeWidth="2.2" />
            <ellipse cx="32" cy="35" rx="11" ry="16" fill="#F97316" stroke="#9A3412" strokeWidth="1.8" />
            <path d="M22 30l4-4 3 4h-7Zm13 0l4-4 3 4h-7Zm-11 9c4 4 12 4 16 0" fill="#FEF08A" stroke="#7C2D12" strokeWidth="1.5" />
          </>
        );
      case 'bat':
        return (
          <path
            d="M32 25l3-6 2 5c6-4 14-5 19-1-4 4-5 9-3 14-6-3-11-2-15 3l-6 7-6-7c-4-5-9-6-15-3 2-5 1-10-3-14 5-4 13-3 19 1l2-5 3 6Z"
            fill="#1F2937"
            stroke="#6D28D9"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        );
      case 'ghost':
        return (
          <>
            <path d="M16 32a16 16 0 0 1 32 0v20l-5-4-5 4-6-4-6 4-5-4-5 4V32Z" fill="#F8FAFC" stroke="#6D28D9" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="26" cy="29" r="3" fill="#1E1B4B" />
            <circle cx="38" cy="29" r="3" fill="#1E1B4B" />
            <ellipse cx="32" cy="37" rx="3.2" ry="4" fill="#1E1B4B" />
          </>
        );
      case 'web':
        return (
          <g stroke="var(--editorial-muted)" strokeWidth="2" fill="none" opacity="0.65">
            <line x1="6" y1="6" x2="58" y2="6" />
            <line x1="6" y1="6" x2="6" y2="58" />
            <line x1="6" y1="6" x2="54" y2="54" />
            <line x1="6" y1="6" x2="58" y2="28" />
            <line x1="6" y1="6" x2="28" y2="58" />
            <path d="M22 6c0 9-7 16-16 16M38 6c0 18-14 32-32 32M54 6c0 26-22 48-48 48" />
          </g>
        );
      case 'flower':
        return (
          <>
            <circle cx="32" cy="16" r="8" fill="var(--editorial-primary)" />
            <circle cx="46" cy="26" r="8" fill="var(--editorial-primary)" />
            <circle cx="41" cy="43" r="8" fill="var(--editorial-primary)" />
            <circle cx="23" cy="43" r="8" fill="var(--editorial-primary)" />
            <circle cx="18" cy="26" r="8" fill="var(--editorial-primary)" />
            <circle cx="32" cy="31" r="7" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          </>
        );
      case 'butterfly':
        return (
          <>
            <path d="M31 32c-10-18-23-18-23-6 0 8 7 12 13 11-7 4-9 13-2 16 7 3 11-5 12-13Z" fill="#F59E0B" stroke="#B45309" strokeWidth="2" />
            <path d="M33 32c10-18 23-18 23-6 0 8-7 12-13 11 7 4 9 13 2 16-7 3-11-5-12-13Z" fill="#D97706" stroke="#92400E" strokeWidth="2" />
            <line x1="32" y1="18" x2="32" y2="48" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
            <path d="M32 19l-5-7M32 19l5-7" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
          </>
        );
      case 'sombrero':
        return (
          <>
            <ellipse cx="32" cy="39" rx="24" ry="8" fill="#FDE68A" stroke="#92400E" strokeWidth="2.3" />
            <path d="M20 37l4-15c2-4 14-4 16 0l4 15H20Z" fill="#FCD34D" stroke="#92400E" strokeWidth="2.2" />
            <path d="M21 33h22" stroke="#B91C1C" strokeWidth="3.5" />
          </>
        );
      case 'tiple':
        return (
          <>
            <path d="M39 10l6 6-11 11c4 5 4 13-2 19-6 6-15 6-20 0-5-5-5-14 1-20 5-5 12-6 17-3l9-13Z" fill="#B45309" stroke="#78350F" strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx="24" cy="38" r="4" fill="#451A03" stroke="#FDE68A" strokeWidth="1.5" />
            <line x1="18" y1="44" x2="43" y2="13" stroke="#FDE68A" strokeWidth="1.3" opacity="0.8" />
          </>
        );
      case 'papel_picado':
        return (
          <>
            <path d="M12 12h40v34l-10 8-10-8-10 8-10-8V12Z" fill="var(--editorial-primary)" stroke="var(--editorial-accent)" strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx="32" cy="27" r="6" fill="var(--editorial-paper)" />
            <circle cx="20" cy="21" r="2.5" fill="#FBBF24" />
            <circle cx="44" cy="21" r="2.5" fill="#FBBF24" />
          </>
        );
      case 'quill':
        return (
          <>
            <path d="M50 10C34 12 21 24 18 42l8 4c14-5 24-18 24-36Z" fill="#FEF3C7" stroke="#78350F" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M13 53l10-11M22 36L46 14" stroke="#78350F" strokeWidth="2.3" strokeLinecap="round" />
          </>
        );
      case 'typewriter':
        return (
          <>
            <rect x="19" y="10" width="26" height="15" rx="2" fill="#FFFDF8" stroke="#78350F" strokeWidth="2" />
            <line x1="24" y1="15" x2="40" y2="15" stroke="#78350F" strokeWidth="1.8" />
            <line x1="24" y1="20" x2="36" y2="20" stroke="#78350F" strokeWidth="1.8" />
            <rect x="11" y="25" width="42" height="26" rx="4" fill="#3F3F46" stroke="#18181B" strokeWidth="2.2" />
            <rect x="17" y="34" width="30" height="11" rx="2" fill="#D4D4D8" />
          </>
        );
      case 'inkwell':
        return (
          <>
            <rect x="24" y="13" width="16" height="7" rx="2" fill="#57534E" />
            <path d="M21 20h22l4 10v19a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V30l4-10Z" fill="#1C1917" stroke="#78350F" strokeWidth="2.2" />
            <rect x="23" y="33" width="18" height="10" rx="2" fill="#FEF3C7" />
          </>
        );
      case 'pennant':
        return (
          <>
            <path d="M12 14h40L32 52 12 14Z" fill="#FCD116" />
            <path d="M19 27h26l-6.5 12h-13L19 27Z" fill="#003893" />
            <path d="M25.5 39h13L32 52l-6.5-13Z" fill="#CE1126" />
          </>
        );
      case 'tricolor_ribbon':
        return (
          <>
            <path d="M16 14h32v10H16z" fill="#FCD116" />
            <path d="M16 24h32v10H16z" fill="#003893" />
            <path d="M16 34h32v10H16z" fill="#CE1126" />
            <rect x="16" y="14" width="32" height="30" rx="3" fill="none" stroke="#111111" strokeWidth="1.8" opacity="0.25" />
          </>
        );
      case 'firework':
        return (
          <g strokeLinecap="round">
            <line x1="32" y1="10" x2="32" y2="54" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="4 6" />
            <line x1="10" y1="32" x2="54" y2="32" stroke="#EAB308" strokeWidth="2.5" strokeDasharray="4 6" />
            <line x1="16" y1="16" x2="48" y2="48" stroke="#F97316" strokeWidth="2.5" strokeDasharray="4 6" />
            <line x1="48" y1="16" x2="16" y2="48" stroke="#FBBF24" strokeWidth="2.5" strokeDasharray="4 6" />
            <circle cx="32" cy="32" r="5" fill="#FEF08A" />
          </g>
        );
      case 'champagne':
        return (
          <>
            <path d="M22 10h20l-2 17a8 8 0 0 1-16 0L22 10Z" fill="#FEF08A" stroke="#B45309" strokeWidth="2.2" />
            <line x1="32" y1="35" x2="32" y2="52" stroke="#B45309" strokeWidth="2.5" />
            <line x1="23" y1="53" x2="41" y2="53" stroke="#B45309" strokeWidth="3" strokeLinecap="round" />
            <circle cx="29" cy="18" r="1.8" fill="#FFFFFF" />
            <circle cx="35" cy="15" r="1.5" fill="#FFFFFF" />
          </>
        );
      case 'mourning_ribbon':
        return (
          <path
            d="M32 36L20 53l-6-4 11-18c-3-5-3-12 1-17 3-4 9-4 12 0 4 5 4 12 1 17l11 18-6 4-12-17Z"
            fill="#18181B"
            stroke="#52525B"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        );
      case 'ribbon':
      default:
        return (
          <>
            <path d="M32 30c-9-9-18-6-16 2 2 6 10 5 16-2Zm0 0c9-9 18-6 16 2-2 6-10 5-16-2Z" fill="var(--editorial-primary)" stroke="var(--editorial-accent)" strokeWidth="2" />
            <path d="M29 33l-7 17 6-2 4-15Zm6 0l7 17-6-2-4-15Z" fill="var(--editorial-accent)" />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={SIZE_STYLE_MAP[size]}
      className={`shrink-0 pointer-events-none select-none ${className}`}
    >
      {renderArtwork()}
    </svg>
  );
};

export const ThemeHeadingIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isDecorated, activeTheme, themeSettings, effectiveAnimationsEnabled } = useTheme();
  if (!isDecorated || !themeSettings.layers.dividers || activeTheme.headingOrnament === 'none') {
    return null;
  }
  return (
    <ThemeOrnament
      id={activeTheme.headingOrnament}
      size="xs"
      animatedFlame={effectiveAnimationsEnabled}
      className={`inline-block align-middle ${className}`}
    />
  );
};

export const ThemeCornerOrnaments: React.FC<{ variant?: 'header' | 'hero'; className?: string }> = ({
  variant = 'hero',
  className = '',
}) => {
  const { showCorners, activeTheme, effectiveAnimationsEnabled } = useTheme();
  if (!showCorners || activeTheme.cornerOrnament === 'none') return null;

  const size = variant === 'header' ? 'xs' : 'sm';
  const swayClass = effectiveAnimationsEnabled && variant === 'hero' ? 'theme-ornament-sway' : '';
  const cornerId = activeTheme.cornerOrnament;

  return (
    <div aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
      <div className={`absolute top-1.5 left-2 z-20 ${swayClass}`}>
        <ThemeOrnament id={cornerId} size={size} animatedFlame={effectiveAnimationsEnabled} />
      </div>
      <div className={`absolute top-1.5 right-2 z-20 scale-x-[-1] ${swayClass}`}>
        <ThemeOrnament id={cornerId} size={size} animatedFlame={effectiveAnimationsEnabled} />
      </div>
    </div>
  );
};

export const ThemeCardRibbon: React.FC = () => {
  const { showCorners, activeTheme } = useTheme();
  if (!showCorners || activeTheme.cornerOrnament === 'none') return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute top-2.5 right-2.5 z-10 rounded-full bg-[var(--editorial-paper)]/90 p-1 shadow-sm border border-[var(--editorial-border)]"
    >
      <ThemeOrnament id={activeTheme.cornerOrnament} size="xs" />
    </div>
  );
};

export const ThemeLogoAccent: React.FC = () => {
  const { showLogoAccent, activeTheme } = useTheme();
  if (!showLogoAccent || activeTheme.logoAccent === 'none') return null;

  const renderAccent = (style: ThemeLogoAccentStyle) => {
    switch (style) {
      case 'santa_hat':
        return (
          <svg viewBox="0 0 40 32" className="w-6 h-5 -rotate-12 drop-shadow-xs">
            <path d="M6 22C10 8 24 4 33 13l-3 9H6Z" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.5" />
            <circle cx="34" cy="13" r="4" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
            <rect x="4" y="20" width="27" height="6" rx="3" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
          </svg>
        );
      case 'hat_tolima':
        return (
          <svg viewBox="0 0 40 28" className="w-6 h-5 -rotate-6 drop-shadow-xs">
            <ellipse cx="20" cy="20" rx="17" ry="5" fill="#FDE68A" stroke="#92400E" strokeWidth="1.5" />
            <path d="M12 19l3-10c2-3 8-3 10 0l3 10H12Z" fill="#FCD34D" stroke="#92400E" strokeWidth="1.5" />
            <path d="M13 16h14" stroke="#B91C1C" strokeWidth="2.5" />
          </svg>
        );
      case 'candle':
        return <ThemeOrnament id="candle" size="xs" />;
      case 'star':
        return <ThemeOrnament id="bethlehem_star" size="xs" />;
      case 'laurel':
        return <ThemeOrnament id="tricolor_ribbon" size="xs" />;
      case 'flower':
        return <ThemeOrnament id="flower" size="xs" />;
      case 'ribbon_bow':
        return <ThemeOrnament id="ribbon" size="xs" />;
      case 'quill':
        return <ThemeOrnament id="quill" size="xs" />;
      case 'snowflake':
        return <ThemeOrnament id="snowflake" size="xs" />;
      case 'mourning_ribbon':
        return <ThemeOrnament id="mourning_ribbon" size="xs" />;
      default:
        return null;
    }
  };

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none select-none absolute -top-2.5 -left-2 z-20"
    >
      {renderAccent(activeTheme.logoAccent)}
    </span>
  );
};
