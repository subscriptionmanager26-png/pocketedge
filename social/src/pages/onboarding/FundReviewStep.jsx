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
      <p className="mt-4 font-serif text-2xl font-bold text-pe-text">Recommend a fund</p>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        To unlock community reviews, share your take on one <strong>{category}</strong> fund.
        Your rating helps build our investor content database.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-pe-text-muted">
        Pick a {category} fund
      </p>
      <div className="mt-3 space-y-2">
        {categoryFunds.map((fund) => (
          <button
            key={fund.id}
            type="button"
            onClick={() => onSelectFund(fund.id)}
            className={`w-full rounded-lg border px-3 py-3 text-left transition ${
              selectedFundId === fund.id
                ? 'border-pe-accent bg-pe-accent-wash'
                : 'border-pe-border hover:border-pe-border-strong'
            }`}
          >
            <p className="text-[15px] font-semibold text-pe-text">{fund.name}</p>
            <p className="text-sm text-pe-text-muted">{fund.amc}</p>
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-pe-text-muted">Your rating</p>
      <div className="mt-2">
        <StarRating value={rating} onChange={onRating} />
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-pe-text-muted">
        One-line review (optional)
      </p>
      <input
        value={reviewLine}
        onChange={(e) => onReviewLine(e.target.value)}
        placeholder="I like this fund because…"
        maxLength={160}
        className={`${inputClass} mt-2`}
      />
      <p className="mt-1 text-xs text-pe-text-muted">{reviewLine.length}/160</p>

      <div className="mt-8 rounded-lg border border-pe-accent-border bg-pe-accent-wash px-4 py-3 text-sm text-pe-text-secondary">
        🔓 Submit to unlock community reviews and join fund discussions.
      </div>
    </>
  );
}
