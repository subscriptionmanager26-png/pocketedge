import StarRating from '../../components/StarRating';
import { getFundsByCategory } from '../../data/fundData';

const inputClass =
  'w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2.5 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

export default function FundReviewStep({
  category,
  selectedFundId,
  onSelectFund,
  rating,
  onRating,
  reviewLine,
  onReviewLine,
}) {
  const categoryFunds = getFundsByCategory(category);

  return (
    <>
      <h2 className="text-2xl font-bold leading-tight text-pe-text md:text-3xl">
        Share your take
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        Rate one <span className="font-semibold text-pe-text">{category}</span> fund you know to
        unlock community reviews across PocketEdge.
      </p>

      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        Pick a fund
      </p>
      <div className="mt-3 divide-y divide-pe-border rounded-lg border border-pe-border">
        {categoryFunds.map((fund) => {
          const selected = selectedFundId === fund.id;
          return (
            <button
              key={fund.id}
              type="button"
              onClick={() => onSelectFund(fund.id)}
              className={`w-full px-4 py-3.5 text-left transition first:rounded-t-lg last:rounded-b-lg ${
                selected ? 'bg-pe-accent-wash' : 'hover:bg-pe-surface'
              }`}
            >
              <p className="text-[15px] font-semibold text-pe-text">{fund.name}</p>
              <p className="text-sm text-pe-text-muted">{fund.amc}</p>
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        Your rating
      </p>
      <div className="mt-3">
        <StarRating value={rating} onChange={onRating} />
      </div>

      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
        One-line review <span className="font-medium normal-case tracking-normal text-pe-text-muted">(optional)</span>
      </p>
      <input
        value={reviewLine}
        onChange={(e) => onReviewLine(e.target.value)}
        placeholder="I like this because…"
        maxLength={160}
        className={`${inputClass} mt-3`}
      />
      <p className="mt-1.5 text-xs text-pe-text-muted">{reviewLine.length}/160</p>

      <div className="mt-8 rounded-lg border border-pe-accent-border bg-pe-accent-wash px-4 py-3 text-[15px] text-pe-text-secondary">
        Submitting unlocks full community reviews and discussions across PocketEdge.
      </div>
    </>
  );
}
