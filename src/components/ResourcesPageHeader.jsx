import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Shared page header for Resources hub + tool pages (Design Language v1).
 */
export default function ResourcesPageHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Resources',
  meta = null,
  className = '',
}) {
  return (
    <div className={className || 'mb-6'}>
      {backTo ? (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--fv-text-secondary)] transition hover:text-[var(--fv-accent)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2} />
          {backLabel}
        </Link>
      ) : null}
      <h1
        className={`text-[22px] font-semibold tracking-tight text-[var(--fv-text)] md:text-[28px] ${
          backTo ? 'mt-3' : ''
        }`}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--fv-text-secondary)]">
          {subtitle}
        </p>
      ) : null}
      {meta ? <div className="mt-2">{meta}</div> : null}
    </div>
  );
}
