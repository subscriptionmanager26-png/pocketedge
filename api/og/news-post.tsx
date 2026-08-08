import { ImageResponse } from '@vercel/og';
import {
  companyLogoAbsoluteUrl,
  fetchPublicSocialPost,
  parseNewsContentForSeo,
  resolveCompanyName,
  siteOrigin,
  truncateSeoPreview,
  absoluteMediaUrl,
} from '../_lib/newsPostSeo.js';

export const config = {
  runtime: 'edge',
};

/** Same footprint as site og-image.jpg / parent link cards. */
const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  wash: '#f3f4f6',
  accent: '#e55405',
  border: '#e5e7eb',
};

function initialFor(label: string) {
  const text = String(label ?? '').trim();
  return (text[0] || '?').toUpperCase();
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') ?? '').trim();
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const origin = siteOrigin(request);
  const row = await fetchPublicSocialPost(id);
  if (!row) {
    return new Response('Post not found', { status: 404 });
  }

  const parts = parseNewsContentForSeo(row);
  const companyName =
    (await resolveCompanyName(origin, parts.symbol, parts.assetType)) ||
    parts.symbol ||
    'PocketEdge News';
  const symbol = parts.symbol ? String(parts.symbol).toUpperCase() : '';
  const bodyPreview =
    truncateSeoPreview([parts.title, parts.text].filter(Boolean).join(' '), 220) ||
    'Market news on PocketEdge';

  const postImage = absoluteMediaUrl(
    origin,
    row.image_url ?? row.image ?? null
  );
  const logoUrl = companyLogoAbsoluteUrl(origin, parts.symbol, parts.assetType);

  // Prefer a full-bleed post photo when present; otherwise logo + text card.
  if (postImage) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            backgroundColor: COLORS.wash,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={postImage}
            width={WIDTH}
            height={HEIGHT}
            style={{
              position: 'absolute',
              inset: 0,
              width: WIDTH,
              height: HEIGHT,
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '28px 36px',
              background:
                'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 55%, rgba(0,0,0,0.88) 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.2,
              }}
            >
              {companyName}
              {symbol ? `  ·  @${symbol}` : ''}
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 10,
                fontSize: 24,
                color: 'rgba(255,255,255,0.92)',
                lineHeight: 1.35,
                maxHeight: 110,
                overflow: 'hidden',
              }}
            >
              {bodyPreview}
            </div>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
        },
      }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: COLORS.bg,
          padding: '48px 56px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              width={128}
              height={128}
              style={{
                width: 128,
                height: 128,
                borderRadius: 28,
                objectFit: 'contain',
                backgroundColor: COLORS.wash,
                border: `1px solid ${COLORS.border}`,
                padding: 12,
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 128,
                height: 128,
                borderRadius: 28,
                backgroundColor: COLORS.wash,
                border: `1px solid ${COLORS.border}`,
                fontSize: 48,
                fontWeight: 700,
                color: COLORS.text,
              }}
            >
              {initialFor(companyName)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 44,
                fontWeight: 700,
                color: COLORS.text,
                lineHeight: 1.15,
              }}
            >
              {companyName}
            </div>
            {symbol ? (
              <div
                style={{
                  display: 'flex',
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 600,
                  color: COLORS.muted,
                }}
              >
                @{symbol}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 36,
            fontSize: 30,
            lineHeight: 1.4,
            color: COLORS.text,
            maxHeight: 260,
            overflow: 'hidden',
          }}
        >
          {bodyPreview}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 24,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.accent,
            }}
          >
            PocketEdge
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: COLORS.muted }}>
            pocketedge.in
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
      },
    }
  );
}
