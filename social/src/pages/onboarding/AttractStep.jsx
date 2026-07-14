import { ArrowRight } from 'lucide-react';
import { FormStatusIcon } from '../../components/FormStatusIcons';
import OnboardingShell, { primaryBtnClass, sectionLabelClass } from './OnboardingShell';

export default function AttractStep({ onContinue }) {
  return (
    <OnboardingShell
      badge="Portfolio check"
      footer={
        <>
          <button type="button" onClick={onContinue} className={primaryBtnClass}>
            <span>Check my portfolio</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="mt-3 text-center text-[13px] text-pe-text-muted">
            Takes about a minute. You can edit holdings anytime after.
          </p>
        </>
      }
    >
      <p className="text-2xl font-bold text-pe-text md:text-3xl">
        Is your portfolio actually in form?
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        Add your holdings once. We classify stocks, ETFs, and mutual funds with the
        daily 50/200 DMA momentum screen - so you know what is in form, and what is
        off track.
      </p>

      <div className="mt-8 border-t border-pe-border pt-8">
        <p className={sectionLabelClass}>What you&apos;ll see</p>
        <div className="mt-3 divide-y divide-pe-border rounded-lg border border-pe-border">
          <SignalRow
            form="in_form"
            label="In Form"
            hint="Bullish - above both DMAs with a rising 200 DMA"
          />
          <SignalRow
            form="out_of_form"
            label="Out of Form"
            hint="Bearish - below both DMAs with a falling 200 DMA"
          />
          <SignalRow
            form="unsure"
            label="Neutral"
            hint="Mixed signal or insufficient price history"
          />
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-pe-accent-border bg-pe-accent-wash px-4 py-3 text-[15px] text-pe-text-secondary">
        Upload one or more Zerodha Kite holdings screenshots, or add holdings manually -
        your choice.
      </div>
    </OnboardingShell>
  );
}

function SignalRow({ form, label, hint }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 first:rounded-t-lg last:rounded-b-lg">
      <FormStatusIcon form={form} className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-[15px] font-semibold text-pe-text">{label}</p>
        <p className="text-sm text-pe-text-muted">{hint}</p>
      </div>
    </div>
  );
}
