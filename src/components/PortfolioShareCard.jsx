import { useState } from 'react';
import { formatPct } from '../lib/format';
import { assetLogoInitial, detectLogoBackdropTone } from '../lib/assetLogo';
import { ownerPossessiveLabel } from '../lib/portfolioShare';

/** Gemini share canvas — 375×667 at 1×, captured at 2× for share PNGs. */
export const SHARE_CARD_WIDTH = 375;
export const SHARE_CARD_HEIGHT = 667;
export const SHARE_CARD_PIXEL_RATIO = 2;

const COLORS = {
  textMain: '#111827',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  border: '#f3f4f6',
  brandGreen: '#0e753f',
  bgGreenLight: '#ecfdf3',
  brandOrange: '#e55405',
  bgOrangeLight: '#fff6f0',
  rowBorder: '#f8fafc',
  footerDivider: '#fed7aa',
};

function ItemLogo({ logoIconUrl, assetKey, name, size = 26 }) {
  const initial = assetLogoInitial(assetKey || name);
  const [backdrop, setBackdrop] = useState('light');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 7,
        overflow: 'hidden',
        backgroundColor: backdrop === 'dark' ? '#27272a' : '#ffffff',
        color: '#6b7280',
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {logoIconUrl ? (
        <img
          src={logoIconUrl}
          alt=""
          width={size}
          height={size}
          loading="eager"
          decoding="sync"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onLoad={(event) => setBackdrop(detectLogoBackdropTone(event.currentTarget))}
        />
      ) : (
        initial
      )}
    </span>
  );
}

function TrendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function PieIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

function ShareListRow({ row, value, valueColor }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        height: 38,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <ItemLogo logoIconUrl={row.logoIconUrl} assetKey={row.ticker} name={row.label} />
        <span
          style={{
            fontWeight: 500,
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: COLORS.textMain,
          }}
        >
          {row.label}
        </span>
      </div>
      <span
        style={{
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '-0.025em',
          color: valueColor,
          flexShrink: 0,
          marginLeft: 8,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ShareListSection({ title, subtitle, iconTone, icon, rows, renderValue, valueColor }) {
  const iconBg = iconTone === 'green' ? COLORS.bgGreenLight : '#fff4ed';
  const iconFg = iconTone === 'green' ? COLORS.brandGreen : COLORS.brandOrange;

  return (
    <section style={{ marginBottom: 10, flexShrink: 1, minHeight: 0 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: iconBg,
              color: iconFg,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMain }}>{title}</h2>
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, color: COLORS.textLight }}>{subtitle}</span>
      </header>
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        {rows.map((row, index) => (
          <div
            key={row.ticker}
            style={{
              borderBottom: index < rows.length - 1 ? `1px solid ${COLORS.rowBorder}` : 'none',
            }}
          >
            <ShareListRow row={row} value={renderValue(row)} valueColor={valueColor} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PortfolioShareCard({
  snapshot,
  ownerHandle,
  brandLogoUrl = '/Pocketedge_logo.png',
}) {
  if (!snapshot) return null;

  const performers = (snapshot.topPerformers?.length
    ? snapshot.topPerformers
    : snapshot.topHoldings ?? []
  ).slice(0, 5);

  const allocationRows = (snapshot.topByAllocation?.length
    ? snapshot.topByAllocation
    : snapshot.topHoldings ?? []
  ).slice(0, 5);

  const ownerLine = ownerPossessiveLabel(ownerHandle);
  const returnPct = Number(snapshot.returnPct) || 0;
  const returnColor =
    returnPct > 0 ? COLORS.brandGreen : returnPct < 0 ? '#dc2626' : COLORS.textMuted;

  return (
    <div
      data-share-card
      style={{
        boxSizing: 'border-box',
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        padding: '14px 14px 12px',
        backgroundColor: '#ffffff',
        color: COLORS.textMain,
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <img
              src={brandLogoUrl}
              alt=""
              width={18}
              height={18}
              style={{ width: 18, height: 18, objectFit: 'contain' }}
            />
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.025em' }}>
              PocketEdge
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            {ownerLine}
            <br />
            <span style={{ color: COLORS.brandGreen }}>Portfolio</span>
          </h1>
        </div>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '8px 10px',
            minWidth: 100,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              margin: '0 0 2px',
              fontSize: 8,
              fontWeight: 600,
              color: COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Total Return
          </p>
          <p
            style={{
              margin: '0 0 2px',
              fontSize: 20,
              fontWeight: 700,
              color: returnColor,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPct(returnPct)}
          </p>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 500, color: COLORS.textMuted }}>
            All time
          </p>
        </div>
      </header>

      <hr
        style={{
          border: 0,
          height: 1,
          backgroundColor: COLORS.border,
          margin: '0 0 10px',
          flexShrink: 0,
        }}
      />

      <ShareListSection
        title="Top 5 Performing Stocks"
        subtitle="By returns"
        iconTone="green"
        icon={<TrendIcon />}
        rows={performers}
        renderValue={(row) => formatPct(row.totalReturnPct)}
        valueColor={COLORS.brandGreen}
      />

      <ShareListSection
        title="Top 5 Stocks by Weight"
        subtitle="By allocation"
        iconTone="orange"
        icon={<PieIcon />}
        rows={allocationRows}
        renderValue={(row) => `${Number(row.weight).toFixed(1)}%`}
        valueColor={COLORS.brandOrange}
      />

      <footer
        style={{
          backgroundColor: COLORS.bgOrangeLight,
          borderRadius: 10,
          padding: '9px 11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <img
            src={brandLogoUrl}
            alt=""
            width={16}
            height={16}
            style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
          />
          <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.25 }}>
            Stay Updated with PocketEdge
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 1, height: 12, backgroundColor: COLORS.footerDivider }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: COLORS.brandOrange,
              whiteSpace: 'nowrap',
            }}
          >
            pocketedge.in
          </span>
        </div>
      </footer>
    </div>
  );
}
