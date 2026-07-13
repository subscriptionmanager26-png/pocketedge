import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { formatPct, pnlClass } from '../lib/format';
import { defaultPortfolioShareBody } from '../lib/portfolioShare';
import { MARKET_MIN_SEARCH_CHARS } from '../lib/marketDataApi';
import { searchPortfolioAssets } from '../lib/portfolioAssetUniverse';
import {
  formatTicker,
  getMentionSessionQuery,
  getTextareaCaretOffset,
  mentionInsertText,
  replaceMentionSession,
} from '../lib/tickers';

export default function ComposeModal({ open, onClose, onPost, portfolioShare = null }) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const [share, setShare] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [mentionStart, setMentionStart] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const suggestRef = useRef(null);
  const prefilledRef = useRef(null);

  const mentionSession =
    open && mentionStart != null ? getMentionSessionQuery(body, cursor, mentionStart) : null;
  const mentionQuery = mentionSession?.query?.trim() ?? '';
  const showSuggestions = Boolean(mentionSession);

  const exitMentionSearch = () => {
    setMentionStart(null);
    setSuggestions([]);
    setSuggestLoading(false);
    setMenuPos(null);
  };

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
    setCursor(0);
    exitMentionSearch();
  }, [open, portfolioShare]);

  useEffect(() => {
    if (!showSuggestions) {
      setSuggestions([]);
      setSuggestLoading(false);
      return undefined;
    }

    if (mentionQuery.length < MARKET_MIN_SEARCH_CHARS) {
      setSuggestions([]);
      setSuggestLoading(false);
      return undefined;
    }

    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      searchPortfolioAssets(mentionQuery, { limit: 8 })
        .then((items) => {
          if (!cancelled) setSuggestions(items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showSuggestions, mentionQuery]);

  useLayoutEffect(() => {
    if (!showSuggestions || !textareaRef.current || mentionStart == null) {
      setMenuPos(null);
      return;
    }

    const caret = getTextareaCaretOffset(textareaRef.current, cursor);
    const ta = textareaRef.current;
    const maxLeft = Math.max(0, ta.clientWidth - 280);
    setMenuPos({
      top: caret.top + caret.height + 4,
      left: Math.min(Math.max(0, caret.left), maxLeft),
    });
  }, [showSuggestions, body, cursor, mentionStart]);

  useEffect(() => {
    if (!showSuggestions) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (suggestRef.current?.contains(target)) return;
      if (textareaRef.current?.contains(target)) return;
      exitMentionSearch();
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showSuggestions]);

  if (!open) return null;

  const reset = () => {
    setBody('');
    setImage(null);
    setShare(null);
    setCursor(0);
    exitMentionSearch();
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

  const syncCursor = (event) => {
    setCursor(event.target.selectionStart ?? 0);
  };

  const maybeStartMention = (nextValue, nextCursor) => {
    if (nextCursor < 1) return;
    if (nextValue[nextCursor - 1] !== '@') return;
    const before = nextCursor >= 2 ? nextValue[nextCursor - 2] : '';
    if (before && /[A-Za-z0-9\]]/.test(before)) return;
    setMentionStart(nextCursor - 1);
  };

  const handleBodyChange = (event) => {
    const nextValue = event.target.value;
    const nextCursor = event.target.selectionStart ?? nextValue.length;

    setBody(nextValue);
    setCursor(nextCursor);

    if (mentionStart != null) {
      if (nextCursor <= mentionStart || nextValue[mentionStart] !== '@') {
        exitMentionSearch();
      }
      return;
    }

    maybeStartMention(nextValue, nextCursor);
  };

  const handleKeyDown = (event) => {
    if (!showSuggestions) return;

    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      exitMentionSearch();
    }
  };

  const applyMention = (asset) => {
    const insert = mentionInsertText(asset);
    if (!insert || !mentionSession) return;
    const next = replaceMentionSession(body, mentionSession, insert);
    setBody(next.text);
    setCursor(next.cursor);
    exitMentionSearch();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
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
        <div className="relative px-4 py-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              autoFocus
              value={body}
              onChange={handleBodyChange}
              onClick={syncCursor}
              onKeyUp={syncCursor}
              onKeyDown={handleKeyDown}
              onSelect={syncCursor}
              placeholder={
                share
                  ? 'Add context for your portfolio…'
                  : 'Share a thesis… type @ to tag a security'
              }
              rows={share ? 4 : 6}
              className="w-full resize-none bg-transparent text-[17px] leading-[1.65] text-pe-ink outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-pe-text-muted"
            />

            {showSuggestions && menuPos ? (
              <div
                ref={suggestRef}
                style={{ top: menuPos.top, left: menuPos.left }}
                className="absolute z-20 w-[min(100%,280px)] max-h-56 overflow-y-auto rounded-[12px] border border-pe-border bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              >
                {mentionQuery.length < MARKET_MIN_SEARCH_CHARS ? (
                  <p className="px-3 py-3 text-sm text-pe-text-muted">
                    Keep typing to search securities…
                  </p>
                ) : suggestLoading ? (
                  <p className="px-3 py-3 text-sm text-pe-text-muted">Searching…</p>
                ) : suggestions.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-pe-text-muted">No securities found.</p>
                ) : (
                  suggestions.map((asset) => (
                    <button
                      key={`${asset.kind}:${asset.key}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyMention(asset)}
                      className="w-full border-b border-pe-border px-3 py-2.5 text-left last:border-b-0 hover:bg-pe-surface"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-pe-text">
                          {asset.kind === 'fund' ? asset.name : formatTicker(asset.key)}
                        </span>
                        <span className="rounded-full bg-pe-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pe-text-muted">
                          {asset.kindLabel}
                        </span>
                      </div>
                      {asset.kind !== 'fund' && asset.name ? (
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-pe-text-muted">
                          {asset.name}
                        </p>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {share ? (
            <div className="mt-3">
              <PortfolioSharePreview share={share} />
              <p className="mt-2 text-xs text-pe-text-muted">
                Sharing weights & returns only - not rupee amounts or quantities.
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
                {share ? 'Attached as a portfolio post' : 'Type @ to search & tag securities'}
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
