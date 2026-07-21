import { useState } from 'react';
import { formatPct } from '../lib/format';
import {
  assetLogoInitial,
  detectLogoBackdropTone,
  LOGO_VARIANT_DETAIL,
  withLogoVariant,
} from '../lib/assetLogo';
import {
  SHARE_COL_GAP,
  SHARE_COL_LOGO,
  SHARE_COL_VALUE,
  SHARE_COLOR_BRAND_GREEN,
  SHARE_COLOR_TEXT,
  SHARE_NAME_FONT_SIZE,
  SHARE_NAME_LINE_HEIGHT,
  shareReturnColor,
} from '../lib/portfolioShare';

/** Gemini share canvas — 375×667 at 1×, captured at 2× for share PNGs. */
export const SHARE_CARD_WIDTH = 375;
export const SHARE_CARD_HEIGHT = 667;
export const SHARE_CARD_PIXEL_RATIO = 2;

const COLORS = {
  text: SHARE_COLOR_TEXT,
  border: '#f3f4f6',
  brandGreen: SHARE_COLOR_BRAND_GREEN,
  bgGreenLight: '#ecfdf3',
  brandOrange: '#e55405',
  bgOrangeLight: '#fff6f0',
  rowBorder: '#f8fafc',
  footerDivider: '#fed7aa',
};

function ItemLogo({ logoIconUrl, assetKey, name, size = SHARE_COL_LOGO }) {
  const initial = assetLogoInitial(assetKey || name);
  const [backdrop, setBackdrop] = useState('light');
  const src = logoIconUrl ? withLogoVariant(logoIconUrl, LOGO_VARIANT_DETAIL) || logoIconUrl : null;

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
        color: COLORS.text,
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size * 2}
          height={size * 2}
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

/**
 * Shared grid across rows: logo | name (max-content) | value | spacer.
 * Name column sizes to the widest label; % sits right after — no dead middle gap.
 */
function ShareListRow({ row, value, valueColor, isLast }) {
  const cellBorder = isLast ? 'none' : `1px solid ${COLORS.rowBorder}`;

  return (
    <>
      <div
        style={{
          padding: '5px 0 5px 8px',
          borderBottom: cellBorder,
          display: 'flex',
          alignItems: 'flex-start',
        }}
      >
        <ItemLogo logoIconUrl={row.logoIconUrl} assetKey={row.ticker} name={row.label} />
      </div>
      <div
        style={{
          padding: '5px 0',
          borderBottom: cellBorder,
          fontWeight: 500,
          fontSize: SHARE_NAME_FONT_SIZE,
          lineHeight: SHARE_NAME_LINE_HEIGHT,
          color: COLORS.text,
          textAlign: 'left',
          wordBreak: 'break-word',
          maxWidth: 200,
        }}
      >
        <span
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {row.label}
        </span>
      </div>
      <div
        style={{
          padding: '5px 0',
          borderBottom: cellBorder,
          width: SHARE_COL_VALUE,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '-0.025em',
          color: valueColor,
          textAlign: 'left',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: SHARE_NAME_LINE_HEIGHT,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {/* Absorbs leftover width on the right — keeps value packed after name */}
      <div style={{ borderBottom: cellBorder, paddingRight: 8 }} />
    </>
  );
}

function ShareListSection({ title, subtitle, iconTone, icon, rows, renderValue, getValueColor }) {
  const iconBg = iconTone === 'green' ? COLORS.bgGreenLight : '#fff4ed';
  const iconFg = iconTone === 'green' ? COLORS.brandGreen : COLORS.brandOrange;

  return (
    <section style={{ marginBottom: 8, flexShrink: 1, minHeight: 0 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
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
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.text,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h2>
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, color: COLORS.text, flexShrink: 0 }}>
          {subtitle}
        </span>
      </header>
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${SHARE_COL_LOGO}px max-content ${SHARE_COL_VALUE}px 1fr`,
            columnGap: SHARE_COL_GAP,
            alignItems: 'start',
            width: '100%',
          }}
        >
          {rows.map((row, index) => (
            <ShareListRow
              key={row.ticker}
              row={row}
              value={renderValue(row)}
              valueColor={getValueColor(row)}
              isLast={index === rows.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PortfolioShareCard({
  snapshot,
  ownerHandle: _ownerHandle,
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

  const returnPct = Number(snapshot.returnPct) || 0;
  const returnColor = shareReturnColor(returnPct);

  return (
    <div
      data-share-card
      style={{
        boxSizing: 'border-box',
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        padding: '12px 12px 10px',
        backgroundColor: '#ffffff',
        color: COLORS.text,
        fontFamily: 'Inter, sans-serif',
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
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
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
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              whiteSpace: 'nowrap',
            }}
          >
            My <span style={{ color: COLORS.brandGreen }}>Portfolio</span>
          </h1>
        </div>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '8px 10px',
            minWidth: 96,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              margin: '0 0 2px',
              fontSize: 8,
              fontWeight: 600,
              color: COLORS.text,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Total Return
          </p>
          <p
            style={{
              margin: 0,
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
        </div>
      </header>

      <hr
        style={{
          border: 0,
          height: 1,
          backgroundColor: COLORS.border,
          margin: '0 0 8px',
          flexShrink: 0,
        }}
      />

      <ShareListSection
        title="Top 5 Performing Stocks/Funds"
        subtitle="By returns"
        iconTone="green"
        icon={<TrendIcon />}
        rows={performers}
        renderValue={(row) => formatPct(row.totalReturnPct)}
        getValueColor={(row) => shareReturnColor(row.totalReturnPct)}
      />

      <ShareListSection
        title="Top 5 Stocks/Funds by Weight"
        subtitle="By allocation"
        iconTone="orange"
        icon={<PieIcon />}
        rows={allocationRows}
        renderValue={(row) => `${Number(row.weight).toFixed(1)}%`}
        getValueColor={() => COLORS.text}
      />

      <footer
        style={{
          backgroundColor: COLORS.bgOrangeLight,
          borderRadius: 10,
          padding: '8px 10px',
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
            style={{ width: 16, height: 16, objectFit: 'contain' }}
          />
          <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.25, color: COLORS.text }}>
            Stay Updated with PocketEdge
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
