import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LOGO_VARIANT_DETAIL,
  LOGO_VARIANT_LIST,
  assetLogoInitial,
  loadedLogoSrcCache,
  markLogoSrcFailed,
  markLogoSrcLoaded,
  resolveAssetLogoUrl,
} from '../lib/assetLogo';

const SIZES = {
  xs: { className: 'h-6 w-6 text-[10px]', px: 24, variant: LOGO_VARIANT_LIST },
  sm: { className: 'h-8 w-8 text-[11px]', px: 32, variant: LOGO_VARIANT_LIST },
  md: { className: 'h-12 w-12 text-base', px: 48, variant: LOGO_VARIANT_DETAIL },
};

function logoAlreadyLoaded(img) {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

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
  const imgRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(() => Boolean(src && loadedLogoSrcCache.has(src)));
  const initial = assetLogoInitial(assetKey || name);

  useEffect(() => {
    setImgSrc(src);
    if (!src) {
      setFailed(false);
      setLoaded(false);
      return;
    }
    if (loadedLogoSrcCache.has(src)) {
      setFailed(false);
      setLoaded(true);
      return;
    }
    setFailed(false);
    setLoaded(false);
  }, [src]);

  // Preload/cache can finish before React attaches onLoad — pick that up here.
  useLayoutEffect(() => {
    if (!imgSrc) return;
    const img = imgRef.current;
    if (logoAlreadyLoaded(img)) {
      markLogoSrcLoaded(imgSrc);
      setFailed(false);
      setLoaded(true);
    }
  }, [imgSrc]);

  const showMonogram = !src || failed || !loaded;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-pe-border bg-transparent font-semibold text-pe-text-secondary ${sizeMeta.className} ${className}`.trim()}
      aria-hidden="true"
    >
      {showMonogram ? <span className="absolute inset-0 flex items-center justify-center">{initial}</span> : null}
      {imgSrc ? (
        <img
          ref={imgRef}
          src={imgSrc}
          alt=""
          width={sizeMeta.px}
          height={sizeMeta.px}
          loading="eager"
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          className={`relative h-full w-full object-contain p-0.5 transition-opacity duration-150 ${
            loaded && !failed ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={(event) => {
            if (imgSrc && logoAlreadyLoaded(event.currentTarget)) {
              markLogoSrcLoaded(imgSrc);
            }
            setFailed(false);
            setLoaded(true);
          }}
          onError={() => {
            // Retry once without the browser's poisoned 404 disk-cache entry.
            if (imgSrc && !/[?&]cb=/.test(imgSrc)) {
              const base = imgSrc.split('?')[0];
              setImgSrc(`${base}?cb=1`);
              setFailed(false);
              setLoaded(false);
              return;
            }
            if (imgSrc) markLogoSrcFailed(imgSrc);
            setFailed(true);
            setLoaded(false);
          }}
        />
      ) : null}
    </span>
  );
}
