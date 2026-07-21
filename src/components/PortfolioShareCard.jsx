import { useState } from 'react';
import { formatPct } from '../lib/format';
import { assetLogoInitial, detectLogoBackdropTone } from '../lib/assetLogo';
import {
  ownerPossessiveLabel,
  shortShareLabel,
  SHARE_LABEL_BUBBLE_LG,
  SHARE_LABEL_BUBBLE_SM,
  SHARE_LABEL_TILE,
} from '../lib/portfolioShare';

/** Matches Gemini share template width (CSS px). */
export const SHARE_CARD_WIDTH = 800;
/** Natural content height at 800px width (template has no fixed height). Used for OG meta. */
export const SHARE_CARD_HEIGHT = 1100;
/** Retina capture at 2× — 3× often OOMs on mobile for tall share cards. */
export const SHARE_CARD_PIXEL_RATIO = 2;

/** Hex only — html-to-image breaks on Tailwind/CSS variables. */
const LOGO_BACKDROP = {
  light: '#f7f6f4',
  dark: '#27272a',
};

const BUBBLE_SIZES = [170, 148, 132, 120, 88];
const BUBBLE_POSITIONS = [
  { top: '45%', left: '48%' },
  { top: '24%', left: '75%' },
  { top: '30%', left: '22%' },
  { top: '70%', left: '30%' },
  { top: '72%', left: '62%' },
];
const BUBBLE_COLORS = [
  { bg: '#1e4635', fg: '#ffffff' },
  { bg: '#499d6d', fg: '#ffffff' },
  { bg: '#addba5', fg: '#1f2937' },
  { bg: '#d6eed0', fg: '#1f2937' },
  { bg: '#fae5d3', fg: '#1f2937' },
];

function ShareMarkLogo({ logoIconUrl, assetKey, name, size = 28, ring = '#e5e7eb' }) {
  const initial = assetLogoInitial(assetKey || name);
  const [backdrop, setBackdrop] = useState('light');

  return (
    <span
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: '50%',
        border: `1px solid ${ring}`,
        backgroundColor: LOGO_BACKDROP[backdrop] ?? LOGO_BACKDROP.light,
        color: backdrop === 'dark' ? '#e5e7eb' : '#6b7280',
        fontSize: Math.max(10, Math.round(size * 0.38)),
        fontWeight: 600,
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
 * Layout follows the Gemini PocketEdge portfolio snapshot template.
 */
export default function PortfolioShareCard({ snapshot, ownerHandle, brandLogoUrl = '/Pocketedge_logo.png' }) {
  if (!snapshot) return null;

  const performers = snapshot.topPerformers?.length
    ? snapshot.topPerformers
    : (snapshot.topHoldings ?? []).slice(0, 5);
  const allocationRows = snapshot.topByAllocation?.length
    ? snapshot.topByAllocation
    : snapshot.topHoldings ?? [];
  const holdingsCount = snapshot.holdingsCount ?? allocationRows.length;
  const sectorsCount = snapshot.sectorsCount ?? 1;
  const ownerLine = ownerPossessiveLabel(ownerHandle);
  const returnColor =
    snapshot.returnPct > 0 ? '#10b981' : snapshot.returnPct < 0 ? '#dc2626' : '#6b7280';
  const showing = Math.min(allocationRows.length, 10);

  return (
    <div
      data-share-card
      style={{
        boxSizing: 'border-box',
        width: SHARE_CARD_WIDTH,
        padding: '28px 32px 24px',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        color: '#111827',
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={brandLogoUrl}
            alt=""
            width={32}
            height={32}
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
          <span style={{ fontWeight: 700, fontSize: 20, color: '#111827', letterSpacing: '-0.02em' }}>
            PocketEdge
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#6b7280',
            letterSpacing: '0.08em',
          }}
        >
          PORTFOLIO SNAPSHOT
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="#10b981"
            />
          </svg>
        </div>
      </header>

      {/* Hero */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#111827',
              letterSpacing: '-0.03em',
            }}
          >
            {ownerLine}
          </h1>
          <h1
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#1e4635',
              letterSpacing: '-0.03em',
            }}
          >
            Portfolio
          </h1>
        </div>

        <div
          style={{
            border: '1px solid #f3f4f6',
            borderRadius: 16,
            padding: 20,
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 12,
              fontWeight: 600,
              color: '#9ca3af',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Total Return
          </p>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 30,
              fontWeight: 700,
              color: returnColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPct(snapshot.returnPct)}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>All time</p>
        </div>
      </div>

      {/* Bubble viz — top performers by return */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 360,
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        {[200, 300, 400].map((size) => (
          <div
            key={size}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: size,
              height: size,
              marginTop: -size / 2,
              marginLeft: -size / 2,
              borderRadius: '50%',
              border: '1px dashed #e2e8f0',
              zIndex: 0,
            }}
          />
        ))}

        <div
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10b981',
            opacity: 0.3,
            top: '20%',
            left: '30%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#d1d5db',
            top: '45%',
            left: '10%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#fca5a5',
            top: '35%',
            right: '15%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#d1d5db',
            bottom: '20%',
            right: '25%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10b981',
            opacity: 0.3,
            top: '5%',
            right: '40%',
          }}
        />

        {performers.slice(0, 5).map((row, index) => {
          const size = BUBBLE_SIZES[index] ?? 88;
          const pos = BUBBLE_POSITIONS[index] ?? BUBBLE_POSITIONS[4];
          const tone = BUBBLE_COLORS[index] ?? BUBBLE_COLORS[4];
          const pctSize = size >= 148 ? 20 : size >= 120 ? 17 : 14;
          const labelMaxWidth = size >= 148 ? 150 : size >= 120 ? 130 : 110;

          return (
            <div
              key={row.ticker}
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 10,
                maxWidth: labelMaxWidth + 40,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  marginBottom: 8,
                  maxWidth: labelMaxWidth + 28,
                }}
              >
                <ShareMarkLogo
                  logoIconUrl={row.logoIconUrl}
                  assetKey={row.ticker}
                  name={row.label}
                  size={24}
                />
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: size >= 148 ? 12 : 10,
                    lineHeight: 1.3,
                    color: '#374151',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    textAlign: 'left',
                    maxWidth: labelMaxWidth,
                    overflow: 'hidden',
                    maxHeight: size >= 148 ? 48 : 36,
                  }}
                >
                  {shortShareLabel(
                    row.label,
                    size >= 148 ? SHARE_LABEL_BUBBLE_LG : SHARE_LABEL_BUBBLE_SM
                  )}
                </span>
              </div>
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: tone.bg,
                  color: tone.fg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: pctSize,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPct(row.totalReturnPct)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #f3f4f6',
          borderRadius: 16,
          padding: 12,
          marginBottom: 16,
          background: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '50%',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="1.5">
            <path d="M21 16V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18H19C20.1046 18 21 17.1046 21 16Z" />
            <path d="M3 10H21" />
            <path d="M7 6V18" />
          </svg>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {holdingsCount}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.2 }}>Holdings</p>
          </div>
        </div>
        <div style={{ width: 1, height: 36, background: '#f1f5f9' }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '50%',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="1.5">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
            <path d="M12 2V12L18.5 18.5" />
            <path d="M2.5 10H12" />
          </svg>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {sectorsCount}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.2 }}>Sectors</p>
          </div>
        </div>
      </div>

      {/* Top holdings by allocation */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              color: '#9ca3af',
              letterSpacing: '0.08em',
            }}
          >
            TOP HOLDINGS (BY ALLOCATION)
          </h3>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            Showing {showing} of {holdingsCount}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {allocationRows.slice(0, 10).map((row) => (
            <div
              key={`alloc-${row.ticker}`}
              style={{
                border: '1px solid #f3f4f6',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ShareMarkLogo
                logoIconUrl={row.logoIconUrl}
                assetKey={row.ticker}
                name={row.label}
                size={28}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151',
                  lineHeight: 1.3,
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  overflow: 'hidden',
                  maxHeight: 34,
                }}
              >
                {shortShareLabel(row.label, SHARE_LABEL_TILE)}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#111827',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Number(row.weight).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer — brand only; portfolio URL stays in share caption */}
      <div
        style={{
          background: '#f6f9f7',
          borderRadius: 16,
          padding: 16,
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
          Stay Updated On Your Portfolio with{' '}
          <span style={{ fontWeight: 700, color: '#1e4635' }}>PocketEdge</span> at{' '}
          <span style={{ fontWeight: 600, color: '#10b981' }}>www.pocketedge.in</span>
        </p>
      </div>
    </div>
  );
}
