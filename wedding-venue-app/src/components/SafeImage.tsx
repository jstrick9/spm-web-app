import React, { useMemo, useState } from 'react';
import type { ImageItem } from '../types';
import { getFirstRenderableImage } from '../utils/renderGuards';

interface SafeImageProps {
  src?: string;
  images?: ImageItem[];
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  images,
  alt,
  className = '',
  fallback = (
    <div className="flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
      No image
    </div>
  ),
}) => {
  const [failed, setFailed] = useState(false);
  const selected = useMemo(() => getFirstRenderableImage(src, images), [src, images]);

  if (!selected || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={selected.url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
};

export default SafeImage;