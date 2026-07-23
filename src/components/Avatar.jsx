import { useEffect, useRef, useState } from 'react';
import AssetLogo from './AssetLogo';
import { detectLogoBackdropTone, logoBackdropClass } from '../lib/assetLogo';

const PALETTE = [
  'bg-[#fff0e8] text-[#c2410c]',
  'bg-[#eef4ff] text-[#1d4ed8]',
  'bg-[#f3eefc] text-[#6d28d9]',
  'bg-[#ecfdf3] text-[#15803d]',
  'bg-[#fef3c7] text-[#b45309]',
];

const AVATAR_TO_ASSET_LOGO_SIZE = {
  sm: 'xs',
  md: 'sm',
  lg: 'sm',
  xl: 'md',
};

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

  useEffect(() => {
    setBackdrop('light');
    setFailed(false);
  }, [avatarUrl]);

  const sharedClass = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${sizes[size]} ${onClick ? 'cursor-pointer transition hover:opacity-90' : ''} ${className}`;

  // AMC profiles store market logos as avatar_url. Reuse AssetLogo so they get the
  // same same-origin path + dark-backdrop handling as Markets search (no crossOrigin
  // on a display <img>, which can blank cached logos).
  if (avatarUrl && isAssetLogoUrl(avatarUrl)) {
    const logo = (
      <AssetLogo
        logoIconUrl={avatarUrl}
        assetKey={person?.handle || person?.name}
        name={person?.name}
        size={AVATAR_TO_ASSET_LOGO_SIZE[size] ?? 'sm'}
        className={onClick || className ? '' : className}
      />
    );
    if (!onClick) return logo;
    return (
      <Tag type="button" onClick={onClick} className={`inline-flex ${className}`} aria-label={person?.name}>
        {logo}
      </Tag>
    );
  }

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
