/** Substack-style underline tabs — used for filters, list selectors, and content tabs */
export default function UnderlineTabs({
  tabs,
  active,
  onChange,
  className = '',
  trailing = null,
  embedded = false,
}) {
  const tabButtonClass = embedded
    ? 'relative flex h-full shrink-0 items-center pr-4 text-[15px] font-semibold transition first:pl-0'
    : 'relative shrink-0 py-3 pr-4 text-[15px] font-semibold transition first:pl-0';

  return (
    <div
      className={`flex items-center gap-1 overflow-x-auto scrollbar-none ${
        embedded
          ? 'h-full min-w-0 flex-1'
          : 'border-b border-pe-border px-4'
      } ${className}`}
    >
      {tabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`${tabButtonClass} ${
              isActive ? 'text-pe-text' : 'text-pe-text-muted hover:text-pe-text'
            }`}
          >
            {label}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-pe-accent" />
            )}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}
