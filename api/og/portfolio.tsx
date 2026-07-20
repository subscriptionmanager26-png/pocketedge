import { ImageResponse } from '@vercel/og';
import {
  buildSnapshotFromPortfolio,
  fetchPublicPortfolioShareData,
  formatPct,
} from '../_lib/portfolioShareServer.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
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
  const handle = payload.ownerHandle ? `@${payload.ownerHandle}` : null;
  const returnColor =
    snapshot.returnPct > 0 ? '#059669' : snapshot.returnPct < 0 ? '#dc2626' : '#374151';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          padding: 48,
          fontFamily: 'system-ui, sans-serif',
          color: '#111827',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '70%' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#6b7280', letterSpacing: 2 }}>
              POCKETEDGE
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, marginTop: 12 }}>{snapshot.name}</div>
            {handle ? (
              <div style={{ fontSize: 28, color: '#6b7280', marginTop: 8 }}>{handle}</div>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#6b7280' }}>TOTAL RETURN</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: returnColor, marginTop: 8 }}>
              {formatPct(snapshot.returnPct)}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: '#6b7280', marginTop: 36 }}>
          TOP {snapshot.topHoldings.length} HOLDINGS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20, gap: 14, flex: 1 }}>
          {snapshot.topHoldings.map((row) => {
            const rowColor =
              row.totalReturnPct > 0 ? '#059669' : row.totalReturnPct < 0 ? '#dc2626' : '#374151';
            return (
              <div
                key={row.ticker}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '72%' }}>
                  <div style={{ fontSize: 28, fontWeight: 600 }}>{row.label}</div>
                  <div style={{ fontSize: 22, color: '#6b7280' }}>{row.weight.toFixed(1)}% allocation</div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: rowColor }}>
                  {formatPct(row.totalReturnPct)}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 24,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 3,
            textAlign: 'center',
            color: '#9ca3af',
          }}
        >
          POCKETEDGE
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1200,
    }
  );
}
