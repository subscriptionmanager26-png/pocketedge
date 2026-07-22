import { ImageResponse } from '@vercel/og';
import {
  buildSnapshotFromPortfolio,
  fetchPublicPortfolioShareData,
  formatPct,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_COL_GAP,
  SHARE_COL_LOGO,
  SHARE_COL_VALUE,
  SHARE_COLOR_BRAND_GREEN,
  SHARE_COLOR_TEXT,
  SHARE_NAME_CHARS_PER_LINE,
  SHARE_NAME_FONT_SIZE,
  SHARE_OG_SCALE,
  SHARE_ROW_MIN_HEIGHT,
  shareReturnColor,
  wrapShareLabel,
} from '../_lib/portfolioShareServer.js';

export const config = {
  runtime: 'edge',
};

const S = SHARE_OG_SCALE;
const WIDTH = SHARE_CARD_WIDTH * S;
const HEIGHT = SHARE_CARD_HEIGHT * S;

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

function px(n) {
  return n * S;
}

function initialFor(label) {
  const text = String(label ?? '').trim();
  return (text[0] || '?').toUpperCase();
}

function toDetailLogoPath(url) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return '';
  return raw.replace(/\/icon-(?:64|128|256)\.png$/i, '/icon-256.png') || raw;
}

function absoluteLogoUrl(url, origin) {
  const raw = toDetailLogoPath(url);
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

function ItemLogo({ src, label, size }) {
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
        color: COLORS.text,
      }}
    >
      {initialFor(label)}
    </div>
  );
}

function ListRow({ label, logoSrc, value, valueColor, isLast }) {
  const lines = wrapShareLabel(label, SHARE_NAME_CHARS_PER_LINE);
  const isSingleLine = lines.length <= 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: `${px(5)}px ${px(8)}px`,
        minHeight: px(isSingleLine ? SHARE_ROW_MIN_HEIGHT : SHARE_ROW_MIN_HEIGHT + 10),
        borderBottom: isLast ? 'none' : `1px solid ${COLORS.rowBorder}`,
        gap: px(SHARE_COL_GAP),
      }}
    >
      <ItemLogo src={logoSrc} label={label} size={px(SHARE_COL_LOGO)} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          fontSize: px(SHARE_NAME_FONT_SIZE),
          fontWeight: 500,
          color: COLORS.text,
          lineHeight: 1.3,
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex' }}>
            {line}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          width: px(SHARE_COL_VALUE),
          flexShrink: 0,
          fontSize: px(12),
          fontWeight: 700,
          color: valueColor,
          textAlign: 'left',
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
  getValueColor,
  origin,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: px(8) }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: px(5),
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
          <div style={{ display: 'flex', fontSize: px(13), fontWeight: 700, color: COLORS.text }}>
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: px(9), fontWeight: 500, color: COLORS.text }}>
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
            valueColor={getValueColor(row)}
            isLast={index === rows.length - 1}
          />
        ))}
      </div>
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
            padding: `${px(12)}px ${px(12)}px ${px(10)}px`,
            fontFamily: 'system-ui, sans-serif',
            color: COLORS.text,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginBottom: px(8),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: px(6), marginBottom: px(4) }}>
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandLogoUrl}
                  width={px(18)}
                  height={px(18)}
                  style={{ width: px(18), height: px(18) }}
                />
              ) : null}
              <div style={{ display: 'flex', fontSize: px(13), fontWeight: 700 }}>PocketEdge</div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'baseline',
                fontSize: px(24),
                fontWeight: 800,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ display: 'flex' }}>My&nbsp;</div>
              <div style={{ display: 'flex', color: COLORS.brandGreen }}>Portfolio</div>
            </div>
          </div>

          <div style={{ display: 'flex', height: 1, background: COLORS.border, marginBottom: px(8) }} />

          <ListSection
            title="Top 5 Performing Stocks/Funds"
            subtitle="By returns"
            iconBg={COLORS.bgGreenLight}
            iconColor={COLORS.brandGreen}
            iconChar="↗"
            rows={performers}
            renderValue={(row) => formatPct(row.totalReturnPct ?? 0)}
            getValueColor={(row) => shareReturnColor(row.totalReturnPct)}
            origin={origin}
          />

          <ListSection
            title="Top 5 Stocks/Funds by Weight"
            subtitle="By allocation"
            iconBg="#fff4ed"
            iconColor={COLORS.brandOrange}
            iconChar="◔"
            rows={allocation}
            renderValue={(row) => `${Number(row.weight ?? 0).toFixed(1)}%`}
            getValueColor={() => COLORS.text}
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
                <img
                  src={brandLogoUrl}
                  width={px(16)}
                  height={px(16)}
                  style={{ width: px(16), height: px(16) }}
                />
              ) : null}
              <div style={{ display: 'flex', fontSize: px(11), fontWeight: 500, color: COLORS.text }}>
                Stay Updated with PocketEdge
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: px(11),
                fontWeight: 700,
                color: COLORS.brandOrange,
              }}
            >
              pocketedge.in
            </div>
          </div>
        </div>
      ),
      { width: WIDTH, height: HEIGHT }
    );
  } catch (error) {
    console.error('OG portfolio image failed', error);
    return new Response(`OG image failed: ${error?.message ?? 'unknown'}`, { status: 500 });
  }
}
