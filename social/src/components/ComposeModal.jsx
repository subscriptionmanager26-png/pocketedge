import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { formatPct, pnlClass } from '../lib/format';
import { defaultPortfolioShareBody } from '../lib/portfolioShare';

export default function ComposeModal({ open, onClose, onPost, portfolioShare = null }) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const [share, setShare] = useState(null);
  const fileRef = useRef(null);
  const prefilledRef = useRef(null);

  useEffect(() => {
    if (!open) {
      prefilledRef.current = null;
      return;
    }
    const key = portfolioShare?.portfolioId ?? null;
    if (prefilledRef.current === key) return;
    prefilledRef.current = key;
    setShare(portfolioShare);
    setBody(portfolioShare ? defaultPortfolioShareBody(portfolioShare) : '');
    setImage(null);
  }, [open, portfolioShare]);

  if (!open) return null;

  const reset = () => {
    setBody('');
    setImage(null);
    setShare(null);
    prefilledRef.current = null;
  };

  const submit = () => {
    const text = body.trim();
    if (!text && !image && !share) return;
    onPost?.({
      body: text,
      image,
      portfolioShare: share,
    });
    reset();
    onClose();
  };

  const onPickImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const canPost = Boolean(body.trim() || image || share);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-pe-border bg-pe-canvas sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-pe-border px-4 py-3.5">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface hover:text-pe-text"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-[15px] font-semibold text-pe-text">
            {share ? 'Share portfolio' : 'New post'}
          </span>
          <span className="w-9" aria-hidden="true" />
        </div>
        <div className="px-4 py-4">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              share
                ? 'Add context for your portfolio…'
                : 'Share a thesis… use @TICKER for disclosure'
            }
            rows={share ? 4 : 6}
            className="w-full resize-none bg-transparent text-[17px] leading-[1.65] text-pe-ink outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-pe-text-muted"
          />

          {share ? (
            <div className="mt-3">
              <PortfolioSharePreview share={share} />
              <p className="mt-2 text-xs text-pe-text-muted">
                Sharing weights & returns only — not rupee amounts or quantities.
              </p>
            </div>
          ) : null}

          {image && (
            <div className="relative mt-3 overflow-hidden rounded-lg">
              <img src={image} alt="" className="aspect-[16/10] w-full object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-pe-text-secondary">
            <div className="flex min-w-0 items-center gap-3">
              {!share ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex shrink-0 items-center gap-1.5 hover:text-pe-text"
                >
                  <ImagePlus className="h-4 w-4" />
                  Image
                </button>
              ) : null}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              <span className="truncate text-xs">
                {share ? 'Attached as a portfolio post' : 'Tickers auto-disclose your position'}
              </span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className="shrink-0 rounded-md bg-pe-accent px-4 py-1.5 text-sm font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortfolioSharePreview({ share }) {
  if (!share) return null;
  return (
    <div className="rounded-[12px] border border-pe-border bg-pe-surface px-3.5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            Portfolio
          </p>
          <p className="mt-0.5 truncate text-[15px] font-semibold text-pe-text">{share.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
            {share.period}
          </p>
          <p className={`mt-0.5 text-[15px] font-bold ${pnlClass(share.returnPct)}`}>
            {formatPct(share.returnPct)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {(share.topHoldings ?? []).map((holding) => (
          <div key={holding.ticker} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-pe-text">{holding.label}</p>
              <p className="truncate text-[12px] text-pe-text-muted">
                {holding.weight.toFixed(1)}% of portfolio
              </p>
            </div>
            <p className={`shrink-0 text-[13px] font-semibold ${pnlClass(holding.returnPct)}`}>
              {formatPct(holding.returnPct)}
            </p>
          </div>
        ))}
      </div>

      {share.holdingsCount > (share.topHoldings?.length ?? 0) ? (
        <p className="mt-3 text-[12px] text-pe-text-muted">
          +{share.holdingsCount - share.topHoldings.length} more holdings
        </p>
      ) : null}
    </div>
  );
}
