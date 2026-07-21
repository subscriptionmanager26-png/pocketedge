import { ImageResponse } from '@vercel/og';
import {
  buildSnapshotFromPortfolio,
  fetchPublicPortfolioShareData,
  formatPct,
  ownerPossessiveLabel,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_LABEL_BUBBLE_LG,
  SHARE_LABEL_BUBBLE_SM,
  SHARE_LABEL_TILE,
  SHARE_OG_SCALE,
  shortShareLabel,
} from '../_lib/portfolioShareServer.js';

export const config = {
  runtime: 'edge',
};

const S = SHARE_OG_SCALE;
const WIDTH = SHARE_CARD_WIDTH * S;
const HEIGHT = SHARE_CARD_HEIGHT * S;

const BUBBLE_COLORS = ['#1e4635', '#499d6d', '#addba5', '#d6eed0', '#fae5d3'];
const BUBBLE_TEXT = ['#ffffff', '#ffffff', '#1f2937', '#1f2937', '#1f2937'];
const BUBBLE_SIZES = [150, 130, 116, 104, 84].map((n) => n * S);
const BUBBLE_POS = [
  { top: 120, left: 280 },
  { top: 40, left: 480 },
  { top: 70, left: 80 },
  { top: 210, left: 140 },
  { top: 220, left: 400 },
].map((p) => ({ top: p.top * S, left: p.left * S }));

function px(n) {
  return n * S;
}

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

function BubbleLabel({ label, bubbleSize }) {
  const large = bubbleSize >= px(130);
  const maxChars = large ? SHARE_LABEL_BUBBLE_LG : SHARE_LABEL_BUBBLE_SM;
  const text = shortShareLabel(label, maxChars);
  const maxWidth = large ? px(150) : px(110);

  return (
    <div
      style={{
        display: 'flex',
        fontSize: large ? px(12) : px(10),
        fontWeight: 600,
        color: '#374151',
        maxWidth,
        lineHeight: `${px(14)}px`,
      }}
    >
      {text}
    </div>
  );
}

function TileLabel({ label }) {
  const text = shortShareLabel(label, SHARE_LABEL_TILE);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        fontSize: px(12),
        fontWeight: 500,
        color: '#374151',
        lineHeight: `${px(15)}px`,
      }}
    >
      {text}
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
          padding: `${px(28)}px ${px(32)}px ${px(24)}px`,
          fontFamily: 'system-ui, sans-serif',
          color: '#111827',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: px(20),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: px(10) }}>
            {brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogoUrl}
                width={px(32)}
                height={px(32)}
                style={{ width: px(32), height: px(32), objectFit: 'contain' }}
              />
            ) : null}
            <div style={{ display: 'flex', fontSize: px(22), fontWeight: 700 }}>PocketEdge</div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: px(12),
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
            marginBottom: px(12),
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: px(40), fontWeight: 700, lineHeight: 1.1 }}>
              {ownerLine}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: px(40),
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
              borderRadius: px(16),
              padding: px(18),
              minWidth: px(160),
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: px(11),
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
                fontSize: px(28),
                fontWeight: 700,
                color: returnColor,
                marginTop: px(4),
              }}
            >
              {formatPct(snapshot.returnPct)}
            </div>
            <div style={{ display: 'flex', fontSize: px(13), color: '#6b7280', marginTop: px(2) }}>
              All time
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: '100%',
            height: px(360),
            marginBottom: px(16),
          }}
        >
          {performers.map((row, index) => {
            const size = BUBBLE_SIZES[index] ?? px(84);
            const pos = BUBBLE_POS[index] ?? BUBBLE_POS[4];
            const logoSrc = absoluteLogoUrl(row.logoIconUrl, origin);
            return (
              <div
                key={row.ticker}
                style={{
                  position: 'absolute',
                  top: pos.top,
                  left: pos.left,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: px(6),
                    marginBottom: px(8),
                  }}
                >
                  <LogoMark src={logoSrc} label={row.label} size={px(24)} light={light} />
                  <BubbleLabel label={row.label} bubbleSize={size} />
                </div>
                <div
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    background: BUBBLE_COLORS[index] ?? '#fae5d3',
                    color: BUBBLE_TEXT[index] ?? '#1f2937',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontWeight: 700,
                      fontSize: size >= px(130) ? px(20) : px(14),
                    }}
                  >
                    {formatPct(row.totalReturnPct)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: px(40),
            border: '1px solid #f3f4f6',
            borderRadius: px(16),
            padding: px(12),
            marginBottom: px(14),
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: px(18), fontWeight: 700 }}>
              {String(snapshot.holdingsCount)}
            </div>
            <div style={{ display: 'flex', fontSize: px(13), color: '#6b7280' }}>Holdings</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: px(18), fontWeight: 700 }}>
              {String(snapshot.sectorsCount ?? 1)}
            </div>
            <div style={{ display: 'flex', fontSize: px(13), color: '#6b7280' }}>Sectors</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: px(10),
            fontSize: px(11),
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
            flexDirection: 'column',
            gap: px(8),
            marginBottom: px(14),
          }}
        >
          {allocation.map((row) => {
            const logoSrc = absoluteLogoUrl(row.logoIconUrl, origin);
            return (
              <div
                key={row.ticker}
                style={{
                  width: '100%',
                  border: '1px solid #f3f4f6',
                  borderRadius: px(12),
                  padding: `${px(10)}px ${px(12)}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: px(10),
                }}
              >
                <LogoMark src={logoSrc} label={row.label} size={px(28)} light />
                <TileLabel label={row.label} />
                <div
                  style={{
                    display: 'flex',
                    fontSize: px(14),
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
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
            borderRadius: px(16),
            padding: px(14),
            justifyContent: 'center',
            fontSize: px(14),
            color: '#374151',
          }}
        >
          Stay Updated On Your Portfolio with PocketEdge at www.pocketedge.in
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
