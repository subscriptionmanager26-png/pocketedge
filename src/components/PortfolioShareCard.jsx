import { useState } from 'react';
import { formatPct } from '../lib/format';
import { assetLogoInitial, detectLogoBackdropTone, logoBackdropClass } from '../lib/assetLogo';

export const SHARE_CARD_WIDTH = 1080;
/** Image-only card; link lives in native share text (outside the PNG). */
export const SHARE_CARD_HEIGHT = 1200;

const PNL_COLORS = {
  positive: '#1a8917',
  negative: '#d93025',
  neutral: '#6b7280',
};

function sharePnlColor(n) {
  if (n > 0) return PNL_COLORS.positive;
  if (n < 0) return PNL_COLORS.negative;
  return PNL_COLORS.neutral;
}

function ShareCardLogo({ logoIconUrl, assetKey, name }) {
  const initial = assetLogoInitial(assetKey || name);
  const [backdrop, setBackdrop] = useState('light');

  return (
    <span
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        overflow: 'hidden',
        borderRadius: '50%',
        border: '1px solid #e5e7eb',
        color: '#6b7280',
        fontSize: 16,
        fontWeight: 600,
      }}
      className={logoBackdropClass(backdrop)}
    >
      {logoIconUrl ? (
        <img
          src={logoIconUrl}
          alt=""
          width={48}
          height={48}
          loading="eager"
          decoding="sync"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onLoad={(event) => {
            setBackdrop(detectLogoBackdropTone(event.currentTarget));
          }}
        />
      ) : (
        initial
      )}
    </span>
  );
}

/**
 * Fixed-size card rendered offscreen and captured as a PNG for native share.
 */
export default function PortfolioShareCard({ snapshot, ownerHandle }) {
  if (!snapshot) return null;

  const handle = ownerHandle ? `@${String(ownerHandle).replace(/^@/, '')}` : null;
  const periodLabel = 'Total';
  const remaining =
    snapshot.holdingsCount > (snapshot.topHoldings?.length ?? 0)
      ? snapshot.holdingsCount - snapshot.topHoldings.length
      : 0;

  return (
    <div
      data-share-card
      className="box-border bg-white text-[#111]"
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        padding: 56,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[28px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">
              PocketEdge
            </p>
            <h1 className="mt-3 truncate text-[52px] font-bold leading-tight text-[#111]">
              {snapshot.name || 'Portfolio'}
            </h1>
            {handle ? (
              <p className="mt-2 truncate text-[32px] text-[#6b7280]">{handle}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[24px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
              {periodLabel} return
            </p>
            <p
              className="mt-2 text-[48px] font-bold tabular-nums"
              style={{ color: sharePnlColor(snapshot.returnPct) }}
            >
              {formatPct(snapshot.returnPct)}
            </p>
          </div>
        </div>

        <div className="mt-10 flex-1">
          <p className="text-[24px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
            Top {snapshot.topHoldings?.length ?? 0} holdings
          </p>
          <div className="mt-5 space-y-4">
            {(snapshot.topHoldings ?? []).map((row) => (
              <div key={row.ticker} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <ShareCardLogo
                    logoIconUrl={row.logoIconUrl}
                    assetKey={row.ticker}
                    name={row.label}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[34px] font-semibold text-[#111]">{row.label}</p>
                    <p className="truncate text-[26px] text-[#6b7280]">
                      {row.weight.toFixed(1)}% allocation
                    </p>
                  </div>
                </div>
                <p
                  className="shrink-0 text-[32px] font-bold tabular-nums"
                  style={{ color: sharePnlColor(row.totalReturnPct) }}
                >
                  {formatPct(row.totalReturnPct)}
                </p>
              </div>
            ))}
          </div>
          {remaining > 0 ? (
            <p className="mt-5 text-[26px] text-[#6b7280]">+{remaining} more holdings</p>
          ) : null}
        </div>

        <p className="mt-auto pt-8 text-center text-[22px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
          PocketEdge
        </p>
      </div>
    </div>
  );
}
