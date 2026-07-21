import { toPng } from 'html-to-image';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import PortfolioShareCard, {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_PIXEL_RATIO,
  SHARE_CARD_WIDTH,
} from '../components/PortfolioShareCard';
import { toCachedAssetLogoPath } from './assetLogo';
import {
  absolutePortfolioShareUrl,
  buildPortfolioShareSnapshot,
  portfolioShareCaption,
  SHARE_SORT_ALLOCATION,
} from './portfolioShare';
import { assetsFromHoldings, resolvePortfolioAssets } from './portfolioAssetUniverse';
import { recordPortfolioShare } from './portfolioEngagementApi';
import { posthog, isPostHogEnabled } from './posthog';

function resolveLogoFetchUrl(url) {
  if (!url) return null;
  const cached = toCachedAssetLogoPath(url);
  const path = cached || url;
  if (path.startsWith('/')) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

async function prefetchLogoDataUrl(url) {
  const fetchUrl = resolveLogoFetchUrl(url);
  if (!fetchUrl) return null;
  try {
    const response = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' });
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
        return dataUrl ? { ...row, logoIconUrl: dataUrl } : { ...row, logoIconUrl: null };
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
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
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

function sanitizeShareCardImages(element) {
  const origin = window.location.origin;
  element.querySelectorAll('img').forEach((img) => {
    const src = img.currentSrc || img.getAttribute('src') || '';
    const safe =
      src.startsWith('data:') ||
      src.startsWith('blob:') ||
      src.startsWith('/') ||
      src.startsWith(origin);
    if (!safe) {
      img.removeAttribute('src');
      img.src = '';
    }
  });
}

async function toPngWithRatio(element, width, height, pixelRatio) {
  return toPng(element, {
    width,
    height,
    pixelRatio,
    cacheBust: true,
    skipFonts: true,
    backgroundColor: '#ffffff',
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

async function captureClientShareCard(element) {
  if (!element) throw new Error('Share card element missing');

  sanitizeShareCardImages(element);

  const images = element.querySelectorAll('img');
  await Promise.all(
    [...images].map(
      (img) =>
        new Promise((resolve) => {
          if (!img.getAttribute('src') || img.complete) {
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
    console.warn('Share capture at high DPI failed, retrying at 2×', err);
    try {
      dataUrl = await toPngWithRatio(element, SHARE_CARD_WIDTH, height, 2);
    } catch (err2) {
      console.warn('Share capture at 2× failed, retrying at 1×', err2);
      dataUrl = await toPngWithRatio(element, SHARE_CARD_WIDTH, height, 1);
    }
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (!blob || blob.size < 1000) {
    throw new Error('Share image capture produced an empty image');
  }
  return blob;
}

async function captureOgShareImage(portfolioId, sort) {
  const params = new URLSearchParams({ id: portfolioId, v: String(Date.now()) });
  if (sort && sort !== SHARE_SORT_ALLOCATION) params.set('sort', sort);
  const url = `${window.location.origin}/api/og/portfolio?${params.toString()}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`OG image request failed (${response.status})`);
  }
  const blob = await response.blob();
  if (!blob || blob.size < 1000) {
    throw new Error('OG image was empty');
  }
  return blob;
}

async function captureClientShareImage(snapshot, ownerHandle) {
  const brandLogoUrl =
    (await prefetchLogoDataUrl(`${window.location.origin}/Pocketedge_logo.png`)) ||
    (await prefetchLogoDataUrl(`${window.location.origin}/logo.png`)) ||
    `${window.location.origin}/Pocketedge_logo.png`;

  const mounted = mountShareCard(snapshot, ownerHandle, brandLogoUrl);
  try {
    const element = mounted.getElement() ?? (await waitForShareCard(mounted.host));
    return await captureClientShareCard(element);
  } finally {
    await mounted.unmount();
  }
}

async function captureShareImage(snapshot, ownerHandle, portfolioId, sort) {
  try {
    const blob = await captureClientShareImage(snapshot, ownerHandle);
    return { blob, captureMethod: 'client' };
  } catch (clientError) {
    console.warn('Client share capture failed, trying OG image', clientError);
    try {
      const blob = await captureOgShareImage(portfolioId, sort);
      return { blob, captureMethod: 'og' };
    } catch (ogError) {
      console.error('OG share image failed', ogError);
      throw new Error(`${clientError?.message}|${ogError?.message}`);
    }
  }
}

function payloadShareable(payload) {
  if (typeof navigator === 'undefined' || !navigator.canShare) return true;
  try {
    return navigator.canShare(payload);
  } catch {
    return false;
  }
}

async function trySharePayloads(payloads) {
  for (const payload of payloads) {
    if (!payloadShareable(payload)) continue;
    try {
      await navigator.share(payload);
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }
  }
  return false;
}

async function fallbackShare(blob, url, caption) {
  const fileName = 'pocketedge-portfolio.png';
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
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

async function invokeNativeShare({ title, caption, shareUrl, blob }) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    throw new Error('Native share unavailable');
  }

  if (blob) {
    const file = new File([blob], 'pocketedge-portfolio.png', { type: 'image/png' });
    const shared = await trySharePayloads([
      { files: [file] },
      { files: [file], title },
      { files: [file], text: caption },
      { files: [file], title, text: caption },
      { files: [file], title, text: caption, url: shareUrl },
    ]);
    if (shared) return 'native';
  }

  const shared = await trySharePayloads([
    { title, text: caption, url: shareUrl },
    { text: `${caption}\n${shareUrl}`, url: shareUrl },
    { title, url: shareUrl },
    { url: shareUrl },
  ]);
  if (shared) return 'native_text_only';

  throw new Error('Native share unavailable');
}

function trackShare(method, sort, captureMethod) {
  if (!isPostHogEnabled) return;
  posthog.capture('portfolio_shared', {
    sort,
    has_image: Boolean(captureMethod),
    method,
    capture_method: captureMethod ?? 'none',
  });
}

function trackShareFailure(reason, detail) {
  if (!isPostHogEnabled) return;
  posthog.capture('portfolio_share_failed', {
    reason: String(reason ?? 'unknown'),
    detail: String(detail ?? '').slice(0, 240),
  });
}

async function buildShareContext({ portfolio, ownerHandle, sort }) {
  const shareUrl = absolutePortfolioShareUrl(portfolio.id, { sort });
  const assetsByKey = await resolveAssetsForPortfolio(portfolio);
  let snapshot = buildPortfolioShareSnapshot(portfolio, { sort, assetsByKey });
  if (!snapshot) return null;

  snapshot = await enrichSnapshotLogos(snapshot);
  const caption = portfolioShareCaption(snapshot, shareUrl);
  const title = snapshot.name || 'Portfolio on PocketEdge';

  return { snapshot, caption, shareUrl, title, portfolioId: portfolio.id, sort };
}

/**
 * Pre-generate the share image while the sheet is open so navigator.share
 * runs inside the user's tap gesture (async capture breaks user activation).
 */
export async function preparePortfolioShare({ portfolio, ownerHandle, sort = SHARE_SORT_ALLOCATION }) {
  if (!portfolio?.id) return { ok: false, reason: 'missing_portfolio' };

  const context = await buildShareContext({ portfolio, ownerHandle, sort });
  if (!context) return { ok: false, reason: 'empty_snapshot' };

  const captured = await captureShareImage(
    context.snapshot,
    ownerHandle,
    context.portfolioId,
    sort
  );

  return {
    ok: true,
    ...context,
    blob: captured.blob,
    captureMethod: captured.captureMethod,
  };
}

/**
 * Share a pre-generated image/link immediately (call from button click handler).
 */
export async function sharePreparedPortfolio({ prepared, onSharesUpdated }) {
  if (!prepared?.ok) {
    return { ok: false, reason: prepared?.reason ?? 'not_prepared' };
  }

  const { blob, captureMethod, caption, shareUrl, title, portfolioId, sort } = prepared;
  let method = 'fallback';

  try {
    const shared = await invokeNativeShare({ title, caption, shareUrl, blob });
    method = shared;
  } catch (shareError) {
    if (shareError?.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }

    console.warn('Native share failed, trying text-only then download', shareError);

    try {
      method = await invokeNativeShare({ title, caption, shareUrl, blob: null });
    } catch (textError) {
      if (textError?.name === 'AbortError') {
        return { ok: false, reason: 'cancelled' };
      }

      if (blob) {
        method = await fallbackShare(blob, shareUrl, caption);
      } else {
        trackShareFailure('share_failed', textError?.message);
        throw textError;
      }
    }
  }

  try {
    const next = await recordPortfolioShare(portfolioId);
    onSharesUpdated?.(next.shares);
  } catch (recordError) {
    console.warn('recordPortfolioShare failed after share', recordError);
  }

  trackShare(method, sort, captureMethod);
  return { ok: true, method, shareUrl, captureMethod };
}

/** One-shot share (prepare + share). Prefer prepare + sharePrepared in the UI. */
export async function sharePortfolio({
  portfolio,
  ownerHandle,
  sort = SHARE_SORT_ALLOCATION,
  onSharesUpdated,
}) {
  const prepared = await preparePortfolioShare({ portfolio, ownerHandle, sort });
  if (!prepared.ok) return prepared;
  return sharePreparedPortfolio({ prepared, onSharesUpdated });
}
