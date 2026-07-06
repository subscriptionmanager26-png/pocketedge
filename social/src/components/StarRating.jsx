import { useState } from 'react';
import { Star } from 'lucide-react';

export function StarDisplay({ rating, size = 'md' }) {
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span className="inline-flex gap-0.5 text-pe-accent" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${iconClass} ${n <= rating ? 'fill-current' : 'fill-none opacity-30'}`}
        />
      ))}
    </span>
  );
}

export default function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(null);
  const active = hover ?? value;

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange?.(n)}
          className="rounded p-0.5 transition hover:scale-110"
          aria-label={`Rate ${n} stars`}
        >
          <Star
            className={`h-8 w-8 ${n <= active ? 'fill-pe-accent text-pe-accent' : 'text-pe-border-strong'}`}
          />
        </button>
      ))}
    </div>
  );
}
