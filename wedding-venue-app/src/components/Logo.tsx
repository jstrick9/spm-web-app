import React from 'react';
import SafeImage from './SafeImage';

interface LogoProps {
  url?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Logo Component for Seven Paths Manor
 *
 * To use your own logo:
 * 1. Upload your logo image to your hosting (Squarespace Files, etc.)
 * 2. Pass the URL as the 'url' prop
 */
export const Logo: React.FC<LogoProps> = ({
  url,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  if (url) {
    return (
      <SafeImage
        src={url}
        alt="Seven Paths Manor"
        className={`${sizeClasses[size]} object-contain ${className}`}
        fallback={
          <div
            className={`${sizeClasses[size]} bg-[#4A1942] rounded-full flex items-center justify-center text-white font-bold ${textSizes[size]} ${className}`}
          >
            7P
          </div>
        }
      />
    );
  }

  return (
    <div
      className={`
        ${sizeClasses[size]}
        bg-[#4A1942]
        rounded-full
        flex items-center justify-center
        text-white font-bold
        ${textSizes[size]}
        ${className}
      `}
    >
      7P
    </div>
  );
};

export default Logo;