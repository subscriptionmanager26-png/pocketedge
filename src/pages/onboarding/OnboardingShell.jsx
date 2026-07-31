import { ArrowLeft } from 'lucide-react';
import AuthLayoutHeader from '../../components/AuthLayoutHeader';

export const primaryBtnClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-40';

export const sectionLabelClass =
  'text-[12px] font-bold uppercase tracking-[0.08em] text-pe-text-muted';

/** Auth chrome shared with signup / fund-review onboarding. */
export default function OnboardingShell({
  children,
  onBack,
  badge = 'Setup',
  footer,
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-pe-canvas text-pe-text">
      <AuthLayoutHeader badge={badge} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-feed px-4 py-6 md:py-8">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : null}
          {children}
        </div>
      </div>

      {footer ? (
        <footer className="shrink-0 border-t border-pe-border bg-pe-canvas px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-feed">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
