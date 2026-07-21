import { ImageResponse } from '@vercel/og';
import {
  buildSnapshotFromPortfolio,
  fetchPublicPortfolioShareData,
  formatPct,
  ownerPossessiveLabel,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_OG_SCALE,
} from '../_lib/portfolioShareServer.js';

export const config = {
  runtime: 'edge',
};

const S = SHARE_OG_SCALE;
const WIDTH = SHARE_CARD_WIDTH * S;
const HEIGHT = SHARE_CARD_HEIGHT * S;

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

function px(n: number) {
  return n * S;
}

function initialFor(label: string) {
  const text = String(label ?? '').trim();
  return (text[0] || '?').toUpperCase();
}

function absoluteLogoUrl(url: string | null | undefined, origin: string) {
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

function ItemLogo({ src, label, size }: { src: string | null; label: string; size: number }) {
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
          borderRadius: px(7),
          objectFit: 'cover',
          border: `1px solid ${COLORS.border}`,
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
        borderRadius: px(7),
        border: `1px solid ${COLORS.border}`,
        fontSize: px(11),
        fontWeight: 600,
        color: COLORS.textMuted,
      }}
    >
      {initialFor(label)}
    </div>
  );
}

function ListRow({
  label,
  logoSrc,
  value,
  valueColor,
  isLast,
}: {
  label: string;
  logoSrc: string | null;
  value: string;
  valueColor: string;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${px(10)}px`,
        height: px(38),
        borderBottom: isLast ? 'none' : `1px solid ${COLORS.rowBorder}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
        <ItemLogo src={logoSrc} label={label} size={px(26)} />
        <div
          style={{
            display: 'flex',
            fontSize: px(12),
            fontWeight: 500,
            color: COLORS.textMain,
            maxWidth: px(180),
          }}
        >
          {String(label).slice(0, 32)}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: px(12),
          fontWeight: 700,
          color: valueColor,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ListSection({
  title,
  subtitle,
  iconBg,
  iconColor,
  iconChar,
  rows,
  renderValue,
  valueColor,
  origin,
}: {
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  iconChar: string;
  rows: Array<{ ticker: string; label: string; logoIconUrl?: string | null; totalReturnPct?: number; weight?: number }>;
  renderValue: (row: (typeof rows)[0]) => string;
  valueColor: string;
  origin: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: px(10) }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: px(6),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: px(6) }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: px(22),
              height: px(22),
              borderRadius: px(11),
              background: iconBg,
              color: iconColor,
              fontSize: px(10),
              fontWeight: 700,
            }}
          >
            {iconChar}
          </div>
          <div style={{ display: 'flex', fontSize: px(13), fontWeight: 600 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', fontSize: px(9), fontWeight: 500, color: COLORS.textLight }}>
          {subtitle}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${COLORS.border}`,
          borderRadius: px(12),
          overflow: 'hidden',
        }}
      >
        {rows.map((row, index) => (
          <ListRow
            key={row.ticker}
            label={row.label}
            logoSrc={absoluteLogoUrl(row.logoIconUrl, origin)}
            value={renderValue(row)}
            valueColor={valueColor}
            isLast={index === rows.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export default async function handler(request: Request) {
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
  const returnPct = Number(snapshot.returnPct) || 0;
  const returnColor =
    returnPct > 0 ? COLORS.brandGreen : returnPct < 0 ? '#dc2626' : COLORS.textMuted;
  const performers = (snapshot.topPerformers ?? snapshot.topHoldings ?? []).slice(0, 5);
  const allocation = (snapshot.topByAllocation ?? snapshot.topHoldings ?? []).slice(0, 5);
  const brandLogoUrl = absoluteLogoUrl('/Pocketedge_logo.png', origin);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            padding: `${px(14)}px ${px(14)}px ${px(12)}px`,
            fontFamily: 'system-ui, sans-serif',
            color: COLORS.textMain,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: px(10),
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: px(6), marginBottom: px(6) }}>
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogoUrl} width={px(18)} height={px(18)} style={{ width: px(18), height: px(18) }} />
                ) : null}
                <div style={{ display: 'flex', fontSize: px(13), fontWeight: 700 }}>PocketEdge</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: px(26), fontWeight: 800, lineHeight: 1.05 }}>
                <div style={{ display: 'flex' }}>{ownerLine}</div>
                <div style={{ display: 'flex', color: COLORS.brandGreen }}>Portfolio</div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${COLORS.border}`,
                borderRadius: px(12),
                padding: `${px(8)}px ${px(10)}px`,
                minWidth: px(100),
              }}
            >
              <div style={{ display: 'flex', fontSize: px(8), fontWeight: 600, color: COLORS.textMuted, letterSpacing: 1 }}>
                TOTAL RETURN
              </div>
              <div style={{ display: 'flex', fontSize: px(20), fontWeight: 700, color: returnColor, marginTop: px(2) }}>
                {formatPct(returnPct)}
              </div>
              <div style={{ display: 'flex', fontSize: px(10), color: COLORS.textMuted, marginTop: px(2) }}>
                All time
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', height: 1, background: COLORS.border, marginBottom: px(10) }} />

          <ListSection
            title="Top 5 Performing Stocks"
            subtitle="By returns"
            iconBg={COLORS.bgGreenLight}
            iconColor={COLORS.brandGreen}
            iconChar="↗"
            rows={performers}
            renderValue={(row) => formatPct(row.totalReturnPct ?? 0)}
            valueColor={COLORS.brandGreen}
            origin={origin}
          />

          <ListSection
            title="Top 5 Stocks by Weight"
            subtitle="By allocation"
            iconBg="#fff4ed"
            iconColor={COLORS.brandOrange}
            iconChar="◔"
            rows={allocation}
            renderValue={(row) => `${Number(row.weight ?? 0).toFixed(1)}%`}
            valueColor={COLORS.brandOrange}
            origin={origin}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: COLORS.bgOrangeLight,
              borderRadius: px(10),
              padding: `${px(9)}px ${px(11)}px`,
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: px(6) }}>
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogoUrl} width={px(16)} height={px(16)} style={{ width: px(16), height: px(16) }} />
              ) : null}
              <div style={{ display: 'flex', fontSize: px(11), fontWeight: 500 }}>
                Stay Updated with PocketEdge
              </div>
            </div>
            <div style={{ display: 'flex', fontSize: px(11), fontWeight: 700, color: COLORS.brandOrange }}>
              pocketedge.in
            </div>
          </div>
        </div>
      ),
      { width: WIDTH, height: HEIGHT }
    );
  } catch (error) {
    console.error('OG portfolio image failed', error);
    return new Response(`OG image failed: ${(error as Error)?.message ?? 'unknown'}`, { status: 500 });
  }
}
