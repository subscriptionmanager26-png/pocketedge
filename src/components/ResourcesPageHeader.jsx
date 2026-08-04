/**
 * Shared page header for marketing tool pages (Design Language v1).
 * No back-link chrome — tools are top-level destinations.
 */
export default function ResourcesPageHeader({
  title,
  subtitle,
  meta = null,
  className = '',
}) {
  return (
    <div className={className || 'mb-6'}>
      <h1 className="text-[22px] font-semibold tracking-tight text-[var(--fv-text)] md:text-[28px]">
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
