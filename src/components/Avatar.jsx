import { useLayoutEffect, useRef, useState } from 'react';
import { detectLogoBackdropTone, logoBackdropClass } from '../lib/assetLogo';

const PALETTE = [
  'bg-[#fff0e8] text-[#c2410c]',
  'bg-[#eef4ff] text-[#1d4ed8]',
  'bg-[#f3eefc] text-[#6d28d9]',
  'bg-[#ecfdf3] text-[#15803d]',
  'bg-[#fef3c7] text-[#b45309]',
];

function isAssetLogoUrl(url) {
  const raw = typeof url === 'string' ? url : '';
  return (
    raw.includes('/asset-logos/') ||
    raw.includes('/storage/v1/object/public/asset-logos/')
  );
}

/** Substack feed avatars are 36px. */
export default function Avatar({ person, size = 'md', onClick, className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs', // 32px — comments / chrome
    md: 'h-9 w-9 text-sm', // 36px — feed posts
    lg: 'h-11 w-11 text-base', // 44px — profile chrome
    xl: 'h-16 w-16 text-xl md:h-[72px] md:w-[72px] md:text-2xl', // profile hero
  };
  const idx = (person?.name?.charCodeAt(0) ?? 0) % PALETTE.length;
  const Tag = onClick ? 'button' : 'div';
  const avatarUrl = String(person?.avatarUrl ?? person?.avatar_url ?? '').trim() || null;
  const imgRef = useRef(null);
  const [backdrop, setBackdrop] = useState('light');
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    setBackdrop('light');
    setFailed(false);
    const img = imgRef.current;
    if (!avatarUrl || !img?.complete || !img.naturalWidth) return;
    setBackdrop(detectLogoBackdropTone(img));
  }, [avatarUrl]);

  const sharedClass = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${sizes[size]} ${onClick ? 'cursor-pointer transition hover:opacity-90' : ''} ${className}`;

  // Keep the original avatar URL for display. For AMC asset-logo avatars, set
  // crossOrigin so canvas backdrop sampling can detect white-on-transparent marks
  // (Supabase Storage sends Access-Control-Allow-Origin: *).
  if (avatarUrl && !failed) {
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`${sharedClass} border border-pe-border ${logoBackdropClass(backdrop)}`}
        aria-label={person?.name}
      >
        <img
          ref={imgRef}
          src={avatarUrl}
          alt=""
          crossOrigin={isAssetLogoUrl(avatarUrl) ? 'anonymous' : undefined}
          className="h-full w-full object-cover"
          onLoad={(event) => {
            setFailed(false);
            setBackdrop(detectLogoBackdropTone(event.currentTarget));
          }}
          onError={() => {
            setFailed(true);
            setBackdrop('light');
          }}
        />
      </Tag>
    );
  }

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`${sharedClass} ${PALETTE[idx]}`}
      aria-label={person?.name}
    >
      {person?.avatar ?? person?.name?.[0] ?? '?'}
    </Tag>
  );
}
