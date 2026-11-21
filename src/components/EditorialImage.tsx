import React, { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { sanitizeExternalUrl } from '../lib/utils';

interface EditorialImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  aspectClass?: string;
}

export const EditorialImage: React.FC<EditorialImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
  aspectClass = '',
}) => {
  const [failed, setFailed] = useState(false);
  const safeSrc = sanitizeExternalUrl(src || '');

  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);

  if (!safeSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-[#3B0A0A] text-[#F4F1EA] p-4 text-center ${aspectClass} ${className}`}
        role="img"
        aria-label={alt}
      >
        <Newspaper className="w-7 h-7 text-[#B91C1C] mb-2 opacity-90" aria-hidden="true" />
        {fallbackTitle && (
          <span className="font-display text-sm font-semibold tracking-wide line-clamp-2 max-w-[22ch] opacity-85">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};
