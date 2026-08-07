export function Bone({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-pe-surface ${className}`} aria-hidden="true" />;
}

export function PortfolioCardSkeleton() {
  return (
    <article className="border-b border-pe-border px-4 py-5 md:py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-6 w-2/5 max-w-[200px]" />
          <Bone className="h-4 w-4/5 max-w-[280px]" />
        </div>
        <Bone className="h-6 w-14 shrink-0" />
      </div>

      <div className="mt-4 rounded-[12px] border border-pe-border bg-pe-surface px-3.5 py-3.5">
        <Bone className="h-3 w-40" />
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Bone className="h-4 w-24" />
              <Bone className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-5">
        <Bone className="h-4 w-8" />
        <Bone className="h-4 w-8" />
      </div>
    </article>
  );
}

export function PortfoliosListSkeleton({ count = 2 }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <PortfolioCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PortfolioPageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading portfolio">
      <div className="border-b border-pe-border px-4 py-5">
        <Bone className="h-4 w-28" />
        <Bone className="mt-3 h-9 w-44" />
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[10px] border border-pe-border bg-pe-surface px-3 py-3">
              <Bone className="h-3 w-16" />
              <Bone className="mt-2 h-5 w-20" />
            </div>
          ))}
        </div>
        <Bone className="mt-5 h-2 w-full rounded-full" />
        <div className="mt-4 flex gap-1 rounded-lg bg-pe-surface p-1">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-9 flex-1 rounded-md" />
          ))}
        </div>
      </div>

      <div className="divide-y divide-pe-border px-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-3.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bone className="h-4 w-24" />
              <Bone className="h-3 w-36" />
            </div>
            <Bone className="h-4 w-12" />
            <Bone className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioHoldingsSkeleton({ rows = 4 }) {
  return (
    <div className="divide-y divide-pe-border px-4" aria-busy="true" aria-label="Loading holdings">
      <div className="flex items-center justify-between gap-4 py-3.5">
        <div className="space-y-1.5">
          <Bone className="h-4 w-16" />
          <Bone className="h-3 w-12" />
        </div>
        <Bone className="h-5 w-14" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_88px_72px] items-center gap-2 py-3.5"
        >
          <div className="space-y-1.5">
            <Bone className="h-4 w-20" />
            <Bone className="h-3 w-32" />
          </div>
          <Bone className="ml-auto h-4 w-10" />
          <Bone className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
