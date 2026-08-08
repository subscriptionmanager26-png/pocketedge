import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ImagePlus, Plus } from 'lucide-react';
import {
  countFilledHoldings,
  sumTotalInvested,
  validateHoldingsRows,
} from './HoldingsEditTable';
import { screenshotDedupeKey } from './importDedupe';
import { parseZerodhaHoldingsScreenshots } from './onboardingHoldings';
import OnboardingShell, { primaryBtnClass } from './OnboardingShell';

function makeShot(file) {
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    url: URL.createObjectURL(file),
    dedupeKey: screenshotDedupeKey(file),
  };
}

function formatInr(value) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

const EMPTY_DRAFT = { shots: [], rows: [] };

export default function ScreenshotStep({ draft, onDraftChange, onBack, onSubmit }) {
  const inputRef = useRef(null);
  const draftRef = useRef(draft ?? EMPTY_DRAFT);
  draftRef.current = draft ?? EMPTY_DRAFT;

  const [phase, setPhase] = useState('upload'); // upload | reading | review
  const [progress, setProgress] = useState({
    percent: 0,
    current: 0,
    total: 0,
    fileName: '',
  });
  const [error, setError] = useState('');

  const shots = draft?.shots ?? [];
  const rows = draft?.rows ?? [];

  // Restore review UI / resume OCR when returning with an existing draft.
  useEffect(() => {
    if (validateHoldingsRows(rows).ok) {
      setPhase('review');
      return;
    }
    if (shots.length) {
      void readShots(shots);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  const validated = validateHoldingsRows(rows);
  const ready = validated.ok;
  const holdingCount = countFilledHoldings(rows);
  const invested = sumTotalInvested(rows);

  const readShots = async (nextShots) => {
    if (!nextShots.length) return;
    setError('');
    setPhase('reading');
    setProgress({
      percent: 0,
      current: 1,
      total: nextShots.length,
      fileName: nextShots[0]?.name || '',
    });

    try {
      const parsed = await parseZerodhaHoldingsScreenshots(
        nextShots.map((shot) => shot.file),
        {
          onProgress: (next) => {
            if (typeof next === 'number') {
              setProgress((prev) => ({ ...prev, percent: next }));
              return;
            }
            setProgress({
              percent: next.percent ?? 0,
              current: next.current ?? 0,
              total: next.total ?? nextShots.length,
              fileName: next.fileName ?? '',
            });
          },
        }
      );
      if (!parsed.length) {
        throw new Error('No holdings found. Try a clearer Zerodha Kite screenshot.');
      }
      const check = validateHoldingsRows(parsed);
      if (!check.ok) {
        throw new Error(check.message || 'Could not read holdings from those screenshots.');
      }
      onDraftChange?.({ shots: nextShots, rows: parsed });
      setPhase('review');
    } catch (err) {
      const hasDraft = (draftRef.current.rows?.length ?? 0) > 0;
      setPhase(hasDraft ? 'review' : 'upload');
      setError(err?.message || 'Could not read those screenshots.');
    }
  };

  const addFiles = (fileList) => {
    const incoming = [...(fileList ?? [])].filter((file) => file.type?.startsWith('image/'));
    if (!incoming.length) {
      setError('Please choose PNG or JPG screenshots.');
      return;
    }

    const currentShots = draftRef.current.shots ?? [];
    const seen = new Set(currentShots.map((shot) => shot.dedupeKey));
    const unique = [];
    let skipped = 0;
    for (const file of incoming) {
      const key = screenshotDedupeKey(file);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      unique.push(makeShot(file));
    }

    if (!unique.length) {
      setError(
        skipped === 1
          ? 'That screenshot is already added.'
          : 'Those screenshots are already added.'
      );
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setError(
      skipped
        ? `Skipped ${skipped} duplicate screenshot${skipped === 1 ? '' : 's'}.`
        : ''
    );
    const merged = [...currentShots, ...unique];
    // Persist shots immediately so Back keeps them even mid-read.
    onDraftChange?.({ shots: merged, rows: draftRef.current.rows ?? [] });
    void readShots(merged);
    if (inputRef.current) inputRef.current.value = '';
  };

  const submit = () => {
    const result = validateHoldingsRows(rows);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    onSubmit(result.holdings, 'screenshot');
  };

  if (phase === 'reading') {
    return (
      <OnboardingShell badge={null}>
        <p className="text-center text-2xl font-bold text-pe-text">Reading screenshots…</p>
        <p className="mt-2 text-center text-sm text-pe-text-muted">
          {Math.max(1, progress.current)} / {Math.max(1, progress.total || shots.length)}
        </p>
        <div className="mx-auto mt-8 h-2 w-full max-w-xs overflow-hidden rounded-full bg-pe-surface">
          <div
            className="h-full rounded-full bg-pe-accent transition-all duration-300"
            style={{ width: `${Math.max(2, progress.percent)}%` }}
          />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      onBack={onBack}
      badge={null}
      footer={
        <>
          {error ? <p className="mb-2 text-[12px] text-pe-negative">{error}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className={primaryBtnClass}
          >
            <span>Analyse holdings</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      }
    >
      <p className="text-center text-2xl font-bold text-pe-text md:text-3xl">Screenshots</p>
      <p className="mt-2 text-center text-sm text-pe-text-muted">Zerodha Kite only</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />

      {ready ? (
        <div className="mt-8 space-y-3">
          <div className="rounded-2xl border border-pe-border bg-white px-4 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <p className="text-[13px] font-semibold text-pe-text-muted">
              {shots.length} screenshot{shots.length === 1 ? '' : 's'}
            </p>
            <div className="mt-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
                Holdings
              </p>
              <p className="mt-1 text-[22px] font-bold tabular-nums tracking-tight text-pe-text">
                {holdingCount}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-pe-border-strong bg-white px-4 py-5 text-[15px] font-semibold text-pe-text transition hover:border-pe-accent hover:bg-pe-accent-wash/40"
          >
            <Plus className="h-5 w-5 text-pe-accent" />
            Add More
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
          className="mt-8 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-pe-border-strong bg-pe-surface px-5 py-12 text-center transition hover:border-pe-accent hover:bg-pe-accent-wash"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-pe-accent shadow-sm">
            <ImagePlus className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-pe-text">Drop or browse</p>
          <p className="mt-1 text-sm text-pe-text-muted">PNG · JPG</p>
        </button>
      )}
    </OnboardingShell>
  );
}
