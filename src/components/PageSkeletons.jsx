function Bone({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-pe-surface ${className}`} aria-hidden="true" />;
}

export function FeedPostSkeleton() {
  return (
    <article className="border-b border-pe-border px-4 py-5">
      <div className="flex items-start gap-3">
        <Bone className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-4 w-36" />
          <Bone className="h-3 w-24" />
          <Bone className="mt-3 h-4 w-full" />
          <Bone className="h-4 w-5/6" />
          <Bone className="h-4 w-2/3" />
          <div className="mt-4 flex gap-6">
            <Bone className="h-4 w-8" />
            <Bone className="h-4 w-8" />
            <Bone className="h-4 w-8" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function FeedSkeleton({ count = 4 }) {
  return (
    <div aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: count }, (_, i) => (
        <FeedPostSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <div className="border-b border-pe-border px-4 py-6">
        <div className="flex items-start gap-4">
          <Bone className="h-16 w-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-6 w-40" />
            <Bone className="h-4 w-28" />
            <Bone className="h-4 w-3/4 max-w-[280px]" />
          </div>
        </div>
        <div className="mt-5 flex gap-6">
          <Bone className="h-4 w-16" />
          <Bone className="h-4 w-16" />
          <Bone className="h-4 w-16" />
        </div>
      </div>
      <div className="flex gap-1 border-b border-pe-border px-4 py-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Bone key={i} className="h-9 flex-1 rounded-md" />
        ))}
      </div>
      <div className="space-y-3 px-4 py-6">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
        <Bone className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function MarketsListSkeleton({ rows = 8 }) {
  return (
    <div className="divide-y divide-pe-border" aria-busy="true" aria-label="Loading market data">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-3.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-4 w-24" />
            <Bone className="h-3 w-40" />
          </div>
          <div className="space-y-1.5 text-right">
            <Bone className="ml-auto h-4 w-16" />
            <Bone className="ml-auto h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading post">
      <FeedPostSkeleton />
      <div className="space-y-3 border-t border-pe-border px-4 py-5">
        <Bone className="h-4 w-28" />
        <div className="flex gap-3">
          <Bone className="h-9 w-9 shrink-0 rounded-full" />
          <Bone className="h-9 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function MarketDetailSkeleton({ titleHint = 'Loading…' }) {
  return (
    <div aria-busy="true" aria-label={titleHint}>
      <section className="border-b border-pe-border px-4 py-5">
        <Bone className="mb-2 h-6 w-16 rounded-full" />
        <Bone className="h-8 w-48" />
        <Bone className="mt-2 h-4 w-24" />
        <Bone className="mt-4 h-9 w-32" />
      </section>
      <div className="flex gap-1 border-b border-pe-border px-4 py-2">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-9 flex-1 rounded-md" />
        ))}
      </div>
      <div className="space-y-3 px-4 py-6">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
        <Bone className="h-4 w-2/3" />
        <Bone className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function RouteFallbackSkeleton() {
  return (
    <div className="px-4 py-8" aria-busy="true" aria-label="Loading page">
      <Bone className="h-6 w-40" />
      <Bone className="mt-4 h-4 w-full" />
      <Bone className="mt-2 h-4 w-5/6" />
      <Bone className="mt-2 h-4 w-2/3" />
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
