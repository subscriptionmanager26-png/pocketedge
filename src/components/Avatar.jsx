import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LOGO_VARIANT_LIST,
  detectLogoBackdropTone,
  logoBackdropClass,
  toCachedAssetLogoPath,
  withLogoVariant,
} from '../lib/assetLogo';

const PALETTE = [
  'bg-[#fff0e8] text-[#c2410c]',
  'bg-[#eef4ff] text-[#1d4ed8]',
  'bg-[#f3eefc] text-[#6d28d9]',
  'bg-[#ecfdf3] text-[#15803d]',
  'bg-[#fef3c7] text-[#b45309]',
];

/** AMC profiles store asset logos as avatar_url — rewrite to same-origin for backdrop sampling. */
function resolveAvatarSrc(url) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  const isAssetLogo =
    raw.includes('/asset-logos/') ||
    raw.includes('/storage/v1/object/public/asset-logos/');
  if (!isAssetLogo) return raw;
  return (
    toCachedAssetLogoPath(withLogoVariant(raw, LOGO_VARIANT_LIST)) ||
    toCachedAssetLogoPath(raw) ||
    raw
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
  const avatarUrl = person?.avatarUrl ?? person?.avatar_url ?? null;
  const src = useMemo(() => resolveAvatarSrc(avatarUrl), [avatarUrl]);
  const imgRef = useRef(null);
  const [backdrop, setBackdrop] = useState('light');

  useLayoutEffect(() => {
    setBackdrop('light');
    const img = imgRef.current;
    if (!src || !img?.complete || !img.naturalWidth) return;
    setBackdrop(detectLogoBackdropTone(img));
  }, [src]);

  const sharedClass = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${sizes[size]} ${onClick ? 'cursor-pointer transition hover:opacity-90' : ''} ${className}`;

  if (src) {
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`${sharedClass} border border-pe-border ${logoBackdropClass(backdrop)}`}
        aria-label={person?.name}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onLoad={(event) => {
            setBackdrop(detectLogoBackdropTone(event.currentTarget));
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
