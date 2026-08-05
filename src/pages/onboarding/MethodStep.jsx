import { Camera, FileSpreadsheet, Keyboard } from 'lucide-react';
import OnboardingShell from './OnboardingShell';

export default function MethodStep({ onManual, onScreenshot, onExcel, onBack }) {
  return (
    <OnboardingShell onBack={onBack} badge={null}>
      <p className="text-center text-2xl font-bold tracking-tight text-pe-text md:text-3xl">
        How do you want to enter your holdings?
      </p>

      <div className="mt-8 grid gap-3">
        <MethodCard
          icon={<FileSpreadsheet className="h-7 w-7" strokeWidth={1.75} />}
          title="Excel"
          hint="Zerodha only"
          onClick={onExcel}
        />
        <MethodCard
          icon={<Camera className="h-7 w-7" strokeWidth={1.75} />}
          title="Screenshot"
          hint="Zerodha Kite only"
          onClick={onScreenshot}
        />
        <MethodCard
          icon={<Keyboard className="h-7 w-7" strokeWidth={1.75} />}
          title="Manual"
          hint="Any broker"
          onClick={onManual}
          muted
        />
      </div>
    </OnboardingShell>
  );
}

function MethodCard({ icon, title, hint, onClick, muted = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-5 text-left transition active:scale-[0.99] ${
        muted
          ? 'border-pe-border bg-white hover:bg-pe-surface'
          : 'border-pe-accent-border bg-pe-accent-wash/50 hover:bg-pe-accent-wash'
      }`}
    >
      <span
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
          muted ? 'bg-pe-surface text-pe-text-secondary' : 'bg-white text-pe-accent'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[18px] font-bold text-pe-text">{title}</p>
        <p className="mt-0.5 text-[13px] font-medium text-pe-text-muted">{hint}</p>
      </div>
    </button>
  );
}
