import { BarChart2, FileText, Image, IndianRupee } from 'lucide-react';

export default function ThesisComposer({ onCompose, currentUser }) {
  const initial =
    currentUser?.avatar ||
    (currentUser?.name || '?').slice(0, 1).toUpperCase();

  const open = () => onCompose?.();

  return (
    <div className="fv-card mx-3 mt-3 mb-4 rounded-[20px] p-4 shadow-[var(--fv-shadow)] md:mx-6 md:mt-4 md:mb-0 md:p-6">
      <div className="flex items-center gap-2.5 md:items-start md:gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fv-accent)] text-[12px] font-semibold text-white md:h-11 md:w-11 md:text-[15px]">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={open}
            className="w-full cursor-text py-1.5 text-left text-[15px] leading-snug text-[var(--fv-text-muted)] md:min-h-[52px] md:rounded-[16px] md:px-1 md:py-2 md:text-[16px] md:leading-relaxed"
            aria-label="Compose post"
          >
            What&apos;s on your mind?
          </button>

          <div className="mt-1 flex items-center justify-between gap-2 md:mt-3 md:border-t md:border-[var(--fv-border)] md:pt-3">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={open}
                className="fv-attach-chip px-2 py-1.5 md:px-3"
                aria-label="Add ticker"
              >
                <IndianRupee className="h-4 w-4 md:h-[18px] md:w-[18px]" strokeWidth={2} />
                <span className="hidden md:inline">Ticker</span>
              </button>
              <button
                type="button"
                onClick={open}
                className="fv-attach-chip px-2 py-1.5 md:px-3"
                aria-label="Add image"
              >
                <Image className="h-4 w-4 md:h-[18px] md:w-[18px]" strokeWidth={2} />
                <span className="hidden md:inline">Image</span>
              </button>
              <button
                type="button"
                onClick={open}
                className="fv-attach-chip px-2 py-1.5 md:px-3"
                aria-label="Add poll"
              >
                <BarChart2 className="h-4 w-4 md:h-[18px] md:w-[18px]" strokeWidth={2} />
                <span className="hidden md:inline">Poll</span>
              </button>
              <button
                type="button"
                onClick={open}
                className="fv-attach-chip px-2 py-1.5 md:px-3"
                aria-label="Add article"
              >
                <FileText className="h-4 w-4 md:h-[18px] md:w-[18px]" strokeWidth={2} />
                <span className="hidden md:inline">Article</span>
              </button>
            </div>
            <button
              type="button"
              onClick={open}
              className="fv-btn-primary h-8 px-3.5 text-[13px] md:h-10 md:px-5 md:text-[14px]"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
