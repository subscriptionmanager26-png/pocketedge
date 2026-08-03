import AssetLogo from './AssetLogo';
import { formatPct, formatPrice, pnlClass } from '../lib/format';
import { ideaAssetTypeLabel, ideaSecurityKey } from '../lib/ideaSecurities';

const CARD_SHADOW =
  'shadow-[0_6px_24px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)]';
const CARD_SHADOW_HOVER =
  'hover:shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)]';

/**
 * Ideas card for an individual security — Design Language v1:
 * white surface, shadow lift (no grey fill / heavy border).
 */
export default function SecurityIdeaCard({ item, onOpen }) {
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

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item)}
      className={`flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-white p-4 text-left transition duration-150 hover:-translate-y-px ${CARD_SHADOW} ${CARD_SHADOW_HOVER}`}
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
      </div>
    </button>
  );
}
