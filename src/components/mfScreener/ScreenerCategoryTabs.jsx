export function ScreenerCategoryTabs({ options, activeId, onChange }) {
  return (
    <nav className="mf-screener-cat-tabs" aria-label="Fund categories">
      <div className="mf-screener-cat-tabs-scroll">
        {options.map((opt) => {
          const active = opt.id === activeId;
          return (
            <button
              key={opt.id}
              type="button"
              className={`mf-screener-cat-tab${active ? ' mf-screener-cat-tab-active' : ''}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => onChange(opt.id)}
            >
              <span className="mf-screener-cat-tab-label">{opt.label}</span>
              <span className="mf-screener-cat-tab-count">{opt.count}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
