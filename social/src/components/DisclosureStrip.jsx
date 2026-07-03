import { getPosition } from '../data/mockData';
import { statusStyles } from '../lib/tickers';

export default function DisclosureStrip({ tickers, authorId }) {
  if (!tickers?.length) return null;

  return (
    <div className="mt-3.5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none">
      {tickers.map((ticker) => {
        const position = getPosition(authorId, ticker);
        const styles = statusStyles(position.status);
        return (
          <span
            key={ticker}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            ${ticker}
            <span className="opacity-90">· {styles.label}</span>
          </span>
        );
      })}
    </div>
  );
}
