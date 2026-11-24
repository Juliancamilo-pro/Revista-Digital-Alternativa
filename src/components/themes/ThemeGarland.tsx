import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeGarlandStyle } from '../../types/editorial';

const BULB_COLORS = ['#DC2626', '#16A34A', '#F59E0B', '#2563EB', '#EAB308'];
const TRICOLOR = ['#FCD116', '#003893', '#CE1126'];
const PICADO_COLORS = ['#DC2626', '#D97706', '#059669', '#2563EB', '#BE123C'];

export const ThemeGarland: React.FC<{ styleOverride?: ThemeGarlandStyle; forceShow?: boolean }> = ({
  styleOverride,
  forceShow = false,
}) => {
  const { showGarland, activeTheme, effectiveAnimationsEnabled } = useTheme();
  const style = styleOverride || activeTheme.garlandStyle;
  if ((!showGarland && !forceShow) || style === 'none') return null;

  const nodes = Array.from({ length: 16 }, (_, idx) => idx);
  const twinkle = effectiveAnimationsEnabled;

  if (style === 'mourning') {
    return (
      <div
        aria-hidden="true"
        className="w-full h-2.5 overflow-clip pointer-events-none select-none border-t border-neutral-700/60 bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-full h-5 overflow-clip pointer-events-none select-none relative flex items-start justify-center border-t border-[var(--editorial-border)]/40"
    >
      <svg
        viewBox="0 0 1200 24"
        preserveAspectRatio="none"
        className="w-full h-full min-w-[640px]"
      >
        <path
          d="M0 3 Q 75 13 150 3 T 300 3 T 450 3 T 600 3 T 750 3 T 900 3 T 1050 3 T 1200 3"
          fill="none"
          stroke="var(--editorial-border)"
          strokeWidth="1.5"
        />
        {nodes.map((idx) => {
          const x = 38 + idx * 75;
          const y = idx % 2 === 0 ? 7 : 9;
          const delayStyle = twinkle ? { animationDelay: `${(idx % 5) * 0.48}s` } : undefined;

          if (style === 'lights') {
            const fill = BULB_COLORS[idx % BULB_COLORS.length];
            return (
              <g
                key={idx}
                className={twinkle ? 'theme-bulb-twinkle' : ''}
                style={delayStyle}
              >
                <rect x={x - 2.2} y={y - 3} width="4.4" height="3.5" rx="1" fill="#374151" />
                <ellipse cx={x} cy={y + 4.5} rx="4" ry="5.5" fill={fill} />
              </g>
            );
          }

          if (style === 'lanterns') {
            const fill = idx % 2 === 0 ? '#F59E0B' : '#EA580C';
            return (
              <g key={idx} className={twinkle ? 'theme-bulb-twinkle' : ''} style={delayStyle}>
                <rect x={x - 4.5} y={y} width="9" height="10" rx="2" fill={fill} stroke="#78350F" strokeWidth="1" />
                <circle cx={x} cy={y + 5} r="2.2" fill="#FEF08A" />
              </g>
            );
          }

          if (style === 'bunting') {
            const fill = TRICOLOR[idx % TRICOLOR.length];
            return (
              <polygon
                key={idx}
                points={`${x - 10},${y - 2} ${x + 10},${y - 2} ${x},${y + 11}`}
                fill={fill}
                opacity="0.92"
              />
            );
          }

          if (style === 'papel_picado') {
            const fill = PICADO_COLORS[idx % PICADO_COLORS.length];
            return (
              <g key={idx}>
                <path
                  d={`M${x - 10},${y - 2} h20 v10 l-5 3 -5-3 -5 3 -5-3 Z`}
                  fill={fill}
                  opacity="0.9"
                />
                <circle cx={x} cy={y + 4} r="2" fill="var(--editorial-paper)" />
              </g>
            );
          }

          if (style === 'floral') {
            return (
              <g key={idx}>
                <circle cx={x} cy={y + 4} r="4.5" fill="var(--editorial-primary)" opacity="0.85" />
                <circle cx={x} cy={y + 4} r="1.8" fill="#FBBF24" />
              </g>
            );
          }

          // stars / sparkles
          return (
            <g key={idx} className={twinkle ? 'theme-bulb-twinkle' : ''} style={delayStyle}>
              <path
                d={`M${x} ${y - 2} L${x + 2} ${y + 3} L${x + 7} ${y + 4} L${x + 2} ${y + 6} L${x} ${y + 11} L${x - 2} ${y + 6} L${x - 7} ${y + 4} L${x - 2} ${y + 3} Z`}
                fill="#FBBF24"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
