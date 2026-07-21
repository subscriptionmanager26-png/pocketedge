import { toPng } from 'html-to-image';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import PortfolioShareCard, {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_PIXEL_RATIO,
  SHARE_CARD_WIDTH,
} from '../components/PortfolioShareCard';
import {
  absolutePortfolioShareUrl,
  buildPortfolioShareSnapshot,
  portfolioShareCaption,
  SHARE_SORT_ALLOCATION,
} from './portfolioShare';
import { assetsFromHoldings, resolvePortfolioAssets } from './portfolioAssetUniverse';
import { recordPortfolioShare } from './portfolioEngagementApi';
import { posthog, isPostHogEnabled } from './posthog';

async function prefetchLogoDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function enrichSnapshotLogos(snapshot) {
  if (!snapshot) return snapshot;

  const enrichList = async (rows = []) =>
    Promise.all(
      rows.map(async (row) => {
        if (!row?.logoIconUrl) return row;
        const dataUrl = await prefetchLogoDataUrl(row.logoIconUrl);
        return dataUrl ? { ...row, logoIconUrl: dataUrl } : row;
      })
    );

  const [topHoldings, topByAllocation, topPerformers] = await Promise.all([
    enrichList(snapshot.topHoldings),
    enrichList(snapshot.topByAllocation),
    enrichList(snapshot.topPerformers),
  ]);

  return {
    ...snapshot,
    topHoldings,
    topByAllocation,
    topPerformers,
  };
}

async function resolveAssetsForPortfolio(portfolio) {
  const seeded = assetsFromHoldings(portfolio.holdings);
  const tickers = [
    ...(portfolio.holdings ?? []).map((h) => h?.ticker).filter(Boolean),
    ...(portfolio.tickers ?? []),
  ];
  const unique = [...new Set(tickers)];
  if (!unique.length) return seeded;

  try {
    const resolved = await resolvePortfolioAssets(unique);
    const merged = { ...seeded };
    for (const [key, asset] of resolved.entries()) merged[key] = asset;
    return merged;
  } catch {
    return seeded;
  }
}

async function waitForShareCard(host, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const element = host.querySelector('[data-share-card]');
    if (element) return element;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error('Share card element missing');
}

function mountShareCard(snapshot, ownerHandle, brandLogoUrl) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // Keep in-viewport (opacity 0) so layout/fonts measure correctly on mobile Safari.
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  host.style.overflow = 'hidden';
  document.body.appendChild(host);

  const root = createRoot(host);
  flushSync(() => {
    root.render(
      <PortfolioShareCard
        snapshot={snapshot}
        ownerHandle={ownerHandle}
        brandLogoUrl={brandLogoUrl}
      />
    );
  });

  return {
    host,
    async unmount() {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      root.unmount();
      host.remove();
    },
    getElement() {
      return host.querySelector('[data-share-card]');
    },
  };
}

async function toPngWithRatio(element, width, height, pixelRatio) {
  return toPng(element, {
    width,
    height,
    pixelRatio,
    cacheBust: true,
    skipFonts: true,
    filter: (node) => {
      if (node.tagName === 'LINK' && node.rel === 'stylesheet') {
        const href = node.getAttribute('href') || '';
        if (href.startsWith('http') && !href.startsWith(window.location.origin)) {
          return false;
        }
      }
      return true;
    },
  });
}

export async function captureShareCard(element) {
  if (!element) throw new Error('Share card element missing');

  const images = element.querySelectorAll('img');
  await Promise.all(
    [...images].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );

  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const height = Math.max(
    Math.ceil(element.getBoundingClientRect().height),
    Math.ceil(element.scrollHeight),
    SHARE_CARD_HEIGHT
  );

  let dataUrl;
  try {
    dataUrl = await toPngWithRatio(element, SHARE_CARD_WIDTH, height, SHARE_CARD_PIXEL_RATIO);
  } catch (err) {
    console.warn('Share capture at 2× failed, retrying at 1×', err);
    dataUrl = await toPngWithRatio(element, SHARE_CARD_WIDTH, height, 1);
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (!blob || blob.size < 1000) {
    throw new Error('Share image capture produced an empty image');
  }
  return blob;
}

function canSharePayload(data) {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

async function fallbackShare(blob, url, caption) {
  const fileName = 'pocketedge-portfolio.png';
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  try {
    await navigator.clipboard.writeText(`${caption}\n${url}`);
  } catch {
    /* clipboard may be blocked */
  }

  return 'fallback';
}

function trackShare(method, sort) {
  if (!isPostHogEnabled) return;
  posthog.capture('portfolio_shared', {
    sort,
    has_image: true,
    method,
  });
}

/**
 * Generate PNG + invoke native share (or download/copy fallback).
 */
export async function sharePortfolio({
  portfolio,
  ownerHandle,
  sort = SHARE_SORT_ALLOCATION,
  onSharesUpdated,
}) {
  if (!portfolio?.id) return { ok: false, reason: 'missing_portfolio' };

  const shareUrl = absolutePortfolioShareUrl(portfolio.id, { sort });
  const assetsByKey = await resolveAssetsForPortfolio(portfolio);
  let snapshot = buildPortfolioShareSnapshot(portfolio, { sort, assetsByKey });
  if (!snapshot) return { ok: false, reason: 'empty_snapshot' };

  snapshot = await enrichSnapshotLogos(snapshot);
  const caption = portfolioShareCaption(snapshot, shareUrl);
  const brandLogoUrl =
    (await prefetchLogoDataUrl(`${window.location.origin}/Pocketedge_logo.png`)) ||
    (await prefetchLogoDataUrl(`${window.location.origin}/logo.png`)) ||
    '/Pocketedge_logo.png';

  const mounted = mountShareCard(snapshot, ownerHandle, brandLogoUrl);
  let method = 'fallback';

  try {
    const element = mounted.getElement() ?? (await waitForShareCard(mounted.host));
    const blob = await captureShareCard(element);
    const file = new File([blob], 'pocketedge-portfolio.png', { type: 'image/png' });
    const title = snapshot.name || 'Portfolio on PocketEdge';
    const fileSharePayload = { title, text: caption, files: [file] };
    const textSharePayload = { title, text: caption, url: shareUrl };

    try {
      if (canSharePayload(fileSharePayload)) {
        await navigator.share(fileSharePayload);
        method = 'native';
      } else if (canSharePayload(textSharePayload)) {
        await navigator.share(textSharePayload);
        method = 'native_text_only';
      } else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(textSharePayload);
        method = 'native_text_only';
      } else {
        method = await fallbackShare(blob, shareUrl, caption);
      }
    } catch (shareError) {
      if (shareError?.name === 'AbortError') {
        return { ok: false, reason: 'cancelled' };
      }
      // Native share can reject for payload/size reasons — still deliver the image.
      console.warn('Native share failed, using download fallback', shareError);
      method = await fallbackShare(blob, shareUrl, caption);
    }

    try {
      const next = await recordPortfolioShare(portfolio.id);
      onSharesUpdated?.(next.shares);
    } catch (recordError) {
      console.warn('recordPortfolioShare failed after share', recordError);
    }
    trackShare(method, sort);

    return { ok: true, method, shareUrl };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    console.error('sharePortfolio failed', error);
    throw error;
  } finally {
    await mounted.unmount();
  }
}
