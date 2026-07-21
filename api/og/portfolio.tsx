import { ImageResponse } from '@vercel/og';
import {
  buildSnapshotFromPortfolio,
  fetchPublicPortfolioShareData,
  formatPct,
  ownerPossessiveLabel,
} from '../_lib/portfolioShareServer.js';

export const config = {
  runtime: 'edge',
};

const BUBBLE_COLORS = ['#1e4635', '#499d6d', '#addba5', '#d6eed0', '#fae5d3'];
const BUBBLE_TEXT = ['#ffffff', '#ffffff', '#1f2937', '#1f2937', '#1f2937'];
const BUBBLE_SIZES = [150, 130, 116, 104, 84];
const BUBBLE_POS = [
  { top: 120, left: 280 },
  { top: 40, left: 480 },
  { top: 70, left: 80 },
  { top: 210, left: 140 },
  { top: 220, left: 400 },
];

function initialFor(label) {
  const text = String(label ?? '').trim();
  return (text[0] || '?').toUpperCase();
}

function absoluteLogoUrl(url, origin) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    try {
      return new URL(raw, origin).toString();
    } catch {
      return null;
    }
  }
  return null;
}

function LogoMark({ src, label, size, light = false }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          objectFit: 'cover',
          background: light ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.18)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size / 2,
        background: light ? 'rgba(30,70,53,0.12)' : 'rgba(255,255,255,0.2)',
        color: light ? '#1e4635' : '#ffffff',
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
      }}
    >
      {initialFor(label)}
    </div>
  );
}

export default async function handler(request) {
  const { searchParams, origin } = new URL(request.url);
  const portfolioId = searchParams.get('id');
  const sort = searchParams.get('sort') === 'performance' ? 'performance' : 'allocation';

  if (!portfolioId) {
    return new Response('Missing portfolio id', { status: 400 });
  }

  const payload = await fetchPublicPortfolioShareData(portfolioId);
  if (!payload) {
    return new Response('Portfolio not found', { status: 404 });
  }

  const snapshot = buildSnapshotFromPortfolio(payload.portfolio, { sort });
  const ownerLine = ownerPossessiveLabel(payload.ownerHandle);
  const returnColor =
    snapshot.returnPct > 0 ? '#10b981' : snapshot.returnPct < 0 ? '#dc2626' : '#6b7280';
  const performers = snapshot.topPerformers ?? [];
  const allocation = (snapshot.topByAllocation ?? snapshot.topHoldings ?? []).slice(0, 10);
  const brandLogoUrl = absoluteLogoUrl('/Pocketedge_logo.png', origin);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          padding: '28px 32px 24px',
          fontFamily: 'system-ui, sans-serif',
          color: '#111827',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogoUrl}
                width={32}
                height={32}
                style={{ width: 32, height: 32, objectFit: 'contain' }}
              />
            ) : null}
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700 }}>PocketEdge</div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
              letterSpacing: 2,
            }}
          >
            PORTFOLIO SNAPSHOT
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, lineHeight: 1.1 }}>
              {ownerLine}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1.1,
                color: '#1e4635',
              }}
            >
              Portfolio
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #f3f4f6',
              borderRadius: 16,
              padding: 18,
              minWidth: 160,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 11,
                fontWeight: 600,
                color: '#9ca3af',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              Total Return
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                fontWeight: 700,
                color: returnColor,
                marginTop: 4,
              }}
            >
              {formatPct(snapshot.returnPct)}
            </div>
            <div style={{ display: 'flex', fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              All time
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: '100%',
            height: 360,
            marginBottom: 16,
          }}
        >
          {performers.map((row, index) => {
            const size = BUBBLE_SIZES[index] ?? 84;
            const pos = BUBBLE_POS[index] ?? BUBBLE_POS[4];
            const logoSize = Math.round(size * 0.28);
            const light = index >= 2;
            const logoSrc = absoluteLogoUrl(row.logoIconUrl, origin);
            return (
              <div
                key={row.ticker}
                style={{
                  position: 'absolute',
                  top: pos.top,
                  left: pos.left,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  background: BUBBLE_COLORS[index] ?? '#fae5d3',
                  color: BUBBLE_TEXT[index] ?? '#1f2937',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: size >= 130 ? 14 : 11,
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', marginBottom: 6 }}>
                  <LogoMark src={logoSrc} label={row.label} size={logoSize} light={light} />
                </div>
                <div style={{ display: 'flex' }}>{String(row.label).slice(0, 10)}</div>
                <div style={{ display: 'flex', fontWeight: 700, fontSize: size >= 130 ? 16 : 12 }}>
                  {formatPct(row.totalReturnPct)}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 40,
            border: '1px solid #f3f4f6',
            borderRadius: 16,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 18, fontWeight: 700 }}>
              {String(snapshot.holdingsCount)}
            </div>
            <div style={{ display: 'flex', fontSize: 13, color: '#6b7280' }}>Holdings</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 18, fontWeight: 700 }}>
              {String(snapshot.sectorsCount ?? 1)}
            </div>
            <div style={{ display: 'flex', fontSize: 13, color: '#6b7280' }}>Sectors</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 10,
            fontSize: 11,
            color: '#9ca3af',
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          <div style={{ display: 'flex' }}>TOP HOLDINGS (BY ALLOCATION)</div>
          <div style={{ display: 'flex' }}>
            {`Showing ${allocation.length} of ${snapshot.holdingsCount}`}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {allocation.map((row) => {
            const logoSrc = absoluteLogoUrl(row.logoIconUrl, origin);
            return (
              <div
                key={row.ticker}
                style={{
                  width: 138,
                  border: '1px solid #f3f4f6',
                  borderRadius: 12,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', marginBottom: 6 }}>
                  <LogoMark src={logoSrc} label={row.label} size={28} light />
                </div>
                <div style={{ display: 'flex', fontSize: 11, color: '#4b5563' }}>
                  {String(row.label).slice(0, 12)}
                </div>
                <div style={{ display: 'flex', fontSize: 14, fontWeight: 700 }}>
                  {`${Number(row.weight).toFixed(1)}%`}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            background: '#f6f9f7',
            borderRadius: 16,
            padding: 14,
            justifyContent: 'center',
            fontSize: 14,
            color: '#374151',
          }}
        >
          Stay Updated On Your Portfolio with PocketEdge at www.pocketedge.in
        </div>
      </div>
    ),
    {
      width: 800,
      height: 920,
    }
  );
}
