import React from 'react';

export const TricolorHairline: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`tricolor-hairline ${className}`}
  />
);
