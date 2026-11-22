import React from 'react';

interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<VerifiedBadgeProps['size']>, string> = {
  xs: 'w-3.5 h-3.5 text-[8px]',
  sm: 'w-4 h-4 text-[9px]',
  md: 'w-5 h-5 text-[11px]',
  lg: 'w-6 h-6 text-xs',
};

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 'sm', className = '' }) => {
  return (
    <span
      role="img"
      title="Perfil verificado"
      aria-label="Perfil verificado"
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-display font-black leading-none select-none text-[#231702] bg-gradient-to-br from-[#FDE68A] via-[#F59E0B] to-[#B45309] border border-[#FEF3C7]/90 dark:border-[#92400E] shadow-xs ring-1 ring-[#D97706]/35 ${SIZE_CLASSES[size]} ${className}`}
    >
      R
    </span>
  );
};
