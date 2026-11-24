import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeOrnament } from './ThemeOrnaments';

export const ThemeSectionDivider: React.FC = () => {
  const { showDividers, activeTheme, effectiveAnimationsEnabled } = useTheme();
  if (!showDividers || activeTheme.dividerOrnament === 'none') return null;

  const ornamentSet = activeTheme.ornaments.length > 0 ? activeTheme.ornaments : [activeTheme.dividerOrnament];
  const items = [0, 1, 2].map((idx) => ornamentSet[idx % ornamentSet.length]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none flex items-center gap-3 py-1 overflow-clip"
    >
      <div className="h-px flex-1 bg-[var(--editorial-border)]" />
      <div className="flex items-center gap-3.5 px-2">
        {items.map((ornId, idx) => (
          <ThemeOrnament
            key={`${ornId}_${idx}`}
            id={ornId}
            size="xs"
            animatedFlame={effectiveAnimationsEnabled}
            className="opacity-85"
          />
        ))}
      </div>
      <div className="h-px flex-1 bg-[var(--editorial-border)]" />
    </div>
  );
};
