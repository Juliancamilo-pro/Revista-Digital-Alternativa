import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeFooterStyle } from '../../types/editorial';

export const ThemeFooterBorder: React.FC<{ styleOverride?: ThemeFooterStyle; forceShow?: boolean }> = ({
  styleOverride,
  forceShow = false,
}) => {
  const { showFooterDecoration, activeTheme } = useTheme();
  const style = styleOverride || activeTheme.footerStyle;
  if ((!showFooterDecoration && !forceShow) || style === 'none') return null;

  if (style === 'mourning_bar') {
    return (
      <div
        aria-hidden="true"
        className="w-full h-2 bg-gradient-to-r from-neutral-800 via-neutral-500 to-neutral-800 pointer-events-none select-none"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-full h-9 overflow-clip pointer-events-none select-none -mt-8 relative z-10"
    >
      <svg
        viewBox="0 0 1200 44"
        preserveAspectRatio="none"
        className="w-full h-full min-w-[640px]"
      >
        {style === 'pines' && (
          <path
            d="M0 44 L0 36 L25 18 L50 36 L75 12 L100 36 L130 22 L160 38 L195 14 L230 38 L265 20 L300 40 L335 15 L370 38 L410 22 L450 38 L485 12 L520 38 L560 22 L600 40 L635 14 L670 38 L710 20 L750 38 L785 12 L820 38 L860 22 L900 40 L935 15 L970 38 L1010 22 L1050 38 L1085 12 L1120 38 L1160 20 L1200 38 L1200 44 Z"
            fill="#111111"
          />
        )}
        {style === 'tolima_peaks' && (
          <>
            <path
              d="M0 44 L0 34 Q150 6 300 32 T600 28 T900 30 T1200 26 L1200 44 Z"
              fill="#111111"
            />
            <path
              d="M275 18 L300 8 L325 18 M875 19 L900 10 L925 19"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="2"
              fill="none"
            />
          </>
        )}
        {style === 'candles' && (
          <>
            <rect x="0" y="34" width="1200" height="10" fill="#111111" />
            {[80, 240, 400, 560, 720, 880, 1040, 1140].map((x) => (
              <g key={x}>
                <rect x={x - 5} y="20" width="10" height="16" rx="1.5" fill="#FEF3C7" />
                <path d={`M${x} 10 C${x + 4} 14 ${x + 4} 18 ${x} 20 C${x - 4} 18 ${x - 4} 14 ${x} 10 Z`} fill="#F59E0B" />
              </g>
            ))}
          </>
        )}
        {style === 'floral_vine' && (
          <>
            <path d="M0 44 L0 34 Q100 22 200 34 T400 34 T600 34 T800 34 T1000 34 T1200 34 L1200 44 Z" fill="#111111" />
            {[100, 300, 500, 700, 900, 1100].map((x) => (
              <circle key={x} cx={x} cy="27" r="4" fill="var(--editorial-primary)" />
            ))}
          </>
        )}
        {(style === 'skyline' || style === 'confetti_wave' || style === 'lace') && (
          <path
            d="M0 44 L0 30 Q60 18 120 30 T240 30 T360 30 T480 30 T600 30 T720 30 T840 30 T960 30 T1080 30 T1200 30 L1200 44 Z"
            fill="#111111"
          />
        )}
      </svg>
    </div>
  );
};
