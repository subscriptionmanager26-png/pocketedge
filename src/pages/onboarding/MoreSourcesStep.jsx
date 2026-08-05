import { ArrowRight, Camera, FileSpreadsheet, Plus } from 'lucide-react';
import OnboardingShell, { primaryBtnClass } from './OnboardingShell';

/** After a successful import: only ask whether to add another source. */
export default function MoreSourcesStep({
  holdingCount,
  onAddExcel,
  onAddScreenshot,
  onContinue,
  onBack,
}) {
  return (
    <OnboardingShell onBack={onBack} badge="Sources">
      <p className="text-center text-[40px] font-bold tabular-nums tracking-tight text-pe-text md:text-[48px]">
        {holdingCount}
      </p>
      <p className="mt-1 text-center text-[15px] font-semibold text-pe-text-secondary">
        holding{holdingCount === 1 ? '' : 's'} so far
      </p>
      <p className="mt-6 text-center text-[18px] font-bold text-pe-text">
        Upload more?
      </p>

      <div className="mt-5 grid gap-3">
        <SourceBtn
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="Excel"
          onClick={onAddExcel}
        />
        <SourceBtn
          icon={<Camera className="h-5 w-5" />}
          label="Screenshot"
          onClick={onAddScreenshot}
        />
      </div>

      <div className="mt-10">
        <button type="button" onClick={onContinue} className={primaryBtnClass}>
          <span>I’m done</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </OnboardingShell>
  );
}

function SourceBtn({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-pe-border-strong bg-white px-4 py-4 text-left transition hover:border-pe-accent hover:bg-pe-accent-wash/40"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-pe-surface text-pe-accent">
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-semibold text-pe-text">{label}</span>
      <Plus className="h-4 w-4 text-pe-text-muted" />
    </button>
  );
}
