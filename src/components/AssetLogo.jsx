import { useEffect, useState } from 'react';
import {
  LOGO_VARIANT_DETAIL,
  LOGO_VARIANT_LIST,
  assetLogoInitial,
  resolveAssetLogoUrl,
} from '../lib/assetLogo';

const SIZES = {
  xs: { className: 'h-6 w-6 text-[10px]', px: 24, variant: LOGO_VARIANT_LIST },
  sm: { className: 'h-8 w-8 text-[11px]', px: 32, variant: LOGO_VARIANT_LIST },
  md: { className: 'h-12 w-12 text-base', px: 48, variant: LOGO_VARIANT_DETAIL },
};

/** Remember successful loads so remounts skip the monogram flash. */
const loadedSrcCache = new Set();
/** Skip re-requesting icons that 404 (common for ETF/fund/index). */
const failedSrcCache = new Set();

/**
 * Circular market-asset logo. Prefers `logoIconUrl` / resolved Storage URL;
 * falls back to a letter monogram when the image is missing or fails.
 * Shows monogram until the image loads (no empty circle wait).
 *
 * List sizes (xs/sm) use icon-128 (~12KB); detail (md) uses icon-256.
 */
export default function AssetLogo({
  logoIconUrl,
  assetType,
  assetKey,
  name,
  size = 'sm',
  priority = false,
  className = '',
}) {
  const sizeMeta = SIZES[size] ?? SIZES.sm;
  const src = resolveAssetLogoUrl({
    logoIconUrl,
    assetType,
    assetKey,
    variant: sizeMeta.variant,
  });
  const [failed, setFailed] = useState(() => Boolean(src && failedSrcCache.has(src)));
  const [loaded, setLoaded] = useState(() => Boolean(src && loadedSrcCache.has(src)));
  const initial = assetLogoInitial(assetKey || name);

  useEffect(() => {
    setFailed(Boolean(src && failedSrcCache.has(src)));
    setLoaded(Boolean(src && loadedSrcCache.has(src)));
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-pe-border bg-pe-surface font-semibold text-pe-text-secondary ${sizeMeta.className} ${className}`.trim()}
      aria-hidden="true"
    >
      {!loaded || !showImage ? <span className="absolute inset-0 flex items-center justify-center">{initial}</span> : null}
      {showImage ? (
        <img
          src={src}
          alt=""
          width={sizeMeta.px}
          height={sizeMeta.px}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'low'}
          className={`relative h-full w-full object-cover transition-opacity duration-150 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => {
            if (src) {
              loadedSrcCache.add(src);
              failedSrcCache.delete(src);
            }
            setLoaded(true);
          }}
          onError={() => {
            if (src) failedSrcCache.add(src);
            setFailed(true);
          }}
        />
      ) : null}
    </span>
  );
}
