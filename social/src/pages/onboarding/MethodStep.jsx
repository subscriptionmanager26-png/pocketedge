import { Camera, Keyboard } from 'lucide-react';
import OnboardingShell, { sectionLabelClass } from './OnboardingShell';

export default function MethodStep({ onManual, onScreenshot, onBack }) {
  return (
    <OnboardingShell onBack={onBack} badge="Setup">
      <p className="text-2xl font-bold text-pe-text md:text-3xl">
        How do you want to add holdings?
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        Choose screenshot or manual — both run the same form check. Screenshot works for
        Zerodha Kite; manual works for any broker.
      </p>

      <div className="mt-8 border-t border-pe-border pt-8">
        <p className={sectionLabelClass}>Choose a path</p>
        <div className="mt-3 divide-y divide-pe-border rounded-lg border border-pe-border">
          <MethodRow
            icon={<Camera className="h-5 w-5 text-pe-accent" />}
            title="Zerodha screenshot"
            description="Upload Zerodha Kite holdings screenshots. We parse them locally into an editable summary."
            badge="Zerodha"
            onClick={onScreenshot}
          />
          <MethodRow
            icon={<Keyboard className="h-5 w-5 text-pe-text-secondary" />}
            title="Add manually"
            description="Enter ticker, total invested, and quantity yourself. Available to everyone, including Zerodha users."
            onClick={onManual}
          />
        </div>
      </div>
    </OnboardingShell>
  );
}

function MethodRow({ icon, title, description, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-pe-surface first:rounded-t-lg last:rounded-b-lg"
    >
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pe-surface">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-pe-text">{title}</p>
          {badge ? (
            <span className="rounded-md border border-pe-accent-border bg-pe-accent-wash px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pe-accent">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-pe-text-muted">{description}</p>
      </div>
    </button>
  );
}
