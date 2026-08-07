import { useState } from 'react';
import {
  LOGO_VARIANT_DETAIL,
  resolveAssetLogoUrl,
  assetLogoInitial,
} from '../lib/assetLogo';

/**
 * Logo block for news cards — company mark as the visual after body text.
 * Compact on desktop so it doesn't dominate the column.
 */
export default function NewsLogoImage({
  symbol,
  companyName,
  assetType = 'stock',
  isDetail = false,
  onOpenPost,
  onOpenStock,
  className = '',
}) {
  const src = resolveAssetLogoUrl({
    assetType,
    assetKey: symbol,
    variant: LOGO_VARIANT_DETAIL,
  });
  const [failed, setFailed] = useState(false);
  const initial = assetLogoInitial(symbol || companyName);

  const handleClick = (event) => {
    event.stopPropagation();
    if (onOpenStock && symbol) {
      onOpenStock(symbol);
      return;
    }
    if (!isDetail) onOpenPost?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`mt-4 block w-full overflow-hidden rounded-2xl bg-[#f2f2f3] text-left transition hover:bg-[#ececee] md:mx-auto md:max-w-[280px] ${
        isDetail || onOpenPost || onOpenStock ? 'cursor-pointer' : ''
      } ${className}`}
      aria-label={
        companyName
          ? `Open ${companyName}`
          : symbol
            ? `Open ${symbol}`
            : 'Open post'
      }
    >
      <span className="flex aspect-[4/3] w-full items-center justify-center p-6 md:aspect-square md:p-7">
        {src && !failed ? (
          <img
            src={src}
            alt=""
            className="max-h-full max-w-[min(100%,160px)] object-contain md:max-w-[120px]"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-pe-border bg-white text-[24px] font-semibold text-pe-text-secondary md:h-16 md:w-16 md:text-[20px]">
            {initial}
          </span>
        )}
      </span>
    </button>
  );
}
