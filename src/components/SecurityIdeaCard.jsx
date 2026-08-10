import AssetLogo from './AssetLogo';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { ideaAssetTypeLabel, ideaSecurityKey } from '../lib/ideaSecurities';

/** Tight shadow — large blur inside overflow-x rails paints a grey pad behind the row. */
const CARD_SHADOW =
  'shadow-[0_1px_2px_rgba(0,0,0,0.05),0_2px_8px_rgba(0,0,0,0.06)]';
const CARD_SHADOW_HOVER =
  'hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_6px_16px_rgba(0,0,0,0.08)]';

function ratingBadgeClass(label) {
  if (label === 'Buy') return 'bg-[rgba(26,137,23,0.1)] text-pe-positive';
  if (label === 'Sell') return 'bg-[rgba(217,48,37,0.1)] text-pe-negative';
  return 'bg-pe-surface text-pe-text-secondary';
}

/**
 * Ideas card for an individual security — Design Language v1:
 * white surface, own shadow lift (no shared grey rail pad).
 */
export default function SecurityIdeaCard({ item, rating = null, onOpen }) {
  if (!item) return null;

  const type = item.assetType || item._ideaType;
  const title = item.name || item.symbol || 'Security';
  const typeLabel = ideaAssetTypeLabel(type);
  const meta =
    type === 'fund' ? item.schemeCode || null : item.symbol || null;
  const changePct = item.changePct;
  const hasPct = changePct != null && Number.isFinite(Number(changePct));
  const assetKey = String(
    item.symbol ?? item.id ?? item.schemeCode ?? item.assetKey ?? ''
  ).trim();

  const consensus =
    rating?.consensusLabel && rating.consensusLabel !== 'Limited'
      ? rating.consensusLabel
      : null;
  const upside = Number(rating?.upsidePct);
  const hasUpside = consensus && Number.isFinite(upside);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className={`relative z-0 flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-white p-4 text-left transition duration-150 hover:z-10 hover:-translate-y-px ${CARD_SHADOW} ${CARD_SHADOW_HOVER}`}
      data-security-key={ideaSecurityKey(item)}
    >
      <div className="flex items-start gap-3">
        <AssetLogo
          logoIconUrl={item.logoIconUrl}
          assetType={type}
          assetKey={assetKey}
          name={title}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-5 tracking-tight text-pe-text">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[12px] leading-4 text-pe-text-muted">
            {meta ? `${meta} · ${typeLabel}` : typeLabel}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-3">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-medium leading-4 text-pe-text-muted">Price</p>
            <p className="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-pe-text">
              {item.price != null ? formatPrice(item.price) : '—'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] font-medium leading-4 text-pe-text-muted">1D</p>
            <p
              className={`mt-0.5 text-[15px] font-semibold tabular-nums ${
                hasPct ? pnlClass(changePct) : 'text-pe-text-secondary'
              }`}
            >
              {hasPct ? formatPct(changePct) : '—'}
            </p>
          </div>
        </div>

        {consensus ? (
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-pe-border/70 pt-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-pe-text-muted">
                Rating
              </p>
              <span
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${ratingBadgeClass(
                  consensus
                )}`}
              >
                {consensus}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-pe-text-muted">
                Upside
              </p>
              <p
                className={`mt-1 text-[13px] font-semibold tabular-nums ${
                  hasUpside ? pnlClass(upside) : 'text-pe-text-muted'
                }`}
              >
                {hasUpside ? `${upside >= 0 ? '+' : ''}${Math.round(upside)}%` : '—'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </button>
  );
}
