const RAIL_CARD =
  'relative z-0 flex h-full w-[min(260px,78vw)] min-w-[min(260px,78vw)] shrink-0 flex-col overflow-hidden rounded-[20px] bg-white p-4 shadow-[0_6px_24px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)]';

const RAIL_SCROLL =
  'flex gap-3 overflow-x-auto px-4 py-3 md:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const PLACEHOLDER_COPY = {
  insights: [
    { title: 'Why this moved today', line: 'AI brief on the catalyst behind the latest move.' },
    { title: 'What to watch next', line: 'Key levels, flows, and near-term catalysts.' },
    { title: 'Thesis check', line: 'How the story stacks up vs last quarter.' },
  ],
  posts: [
    { title: 'Top pick for next quarter', line: 'Full thesis with entry zones and risks.' },
    { title: 'How I size this name', line: 'Position sizing framework from active investors.' },
    { title: 'Bull vs bear debate', line: 'Two sharp takes — unlock to join in.' },
    { title: 'Multibagger checklist', line: 'The filters pros run before they buy.' },
  ],
  holders: [
    { title: 'Aarav Mehta', line: 'Holds in Growth Core · +24% YTD' },
    { title: 'Priya Shah', line: 'Holds in Concentrated Alpha' },
    { title: 'Rohan Kapoor', line: 'Added this week · public book' },
    { title: 'Neha Iyer', line: 'Long-term holder · 3 portfolios' },
  ],
  news: [
    { title: 'Earnings preview', line: 'Street expectations and what matters.' },
    { title: 'Sector flows update', line: 'Where smart money is rotating.' },
    { title: 'Regulatory watch', line: 'Policy moves that could move the name.' },
    { title: 'Peer comparison', line: 'Relative performance vs closest rivals.' },
  ],
  corporate: [
    { title: 'Upcoming dividend', line: 'Ex-date and expected payout.' },
    { title: 'Board meeting', line: 'Agenda highlights for investors.' },
    { title: 'Split / bonus', line: 'Corporate action timeline.' },
  ],
};

/**
 * Fixed-count blurred placeholder rail for guest security pages.
 * Every security shows the same card count regardless of real data.
 */
export default function GuestBlurredRail({ kind = 'posts', height = 160 }) {
  const items = PLACEHOLDER_COPY[kind] ?? PLACEHOLDER_COPY.posts;

  return (
    <div className={`${RAIL_SCROLL} pointer-events-none select-none`} aria-hidden>
      {items.map((item, index) => (
        <div key={`${kind}-${index}`} style={{ height }} className="shrink-0">
          <div className={`${RAIL_CARD} blur-[5px]`}>
            <div className="mb-2 h-2.5 w-16 rounded bg-pe-border/80" />
            <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-pe-text">
              {item.title}
            </p>
            <p className="mt-2 line-clamp-3 flex-1 text-[12px] leading-relaxed text-pe-text-secondary">
              {item.line}
            </p>
            <div className="mt-3 h-2.5 w-20 rounded bg-pe-border/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
