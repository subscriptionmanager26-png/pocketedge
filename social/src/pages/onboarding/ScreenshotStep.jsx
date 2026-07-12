import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ImagePlus, Trash2, X } from 'lucide-react';
import HoldingsEditTable, {
  emptyHoldingRow,
  validateHoldingsRows,
} from './HoldingsEditTable';
import { parseZerodhaHoldingsScreenshots } from './onboardingHoldings';
import OnboardingShell, { primaryBtnClass, sectionLabelClass } from './OnboardingShell';

function makeShot(file) {
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    url: URL.createObjectURL(file),
  };
}

export default function ScreenshotStep({ onBack, onSubmit }) {
  const inputRef = useRef(null);
  const [shots, setShots] = useState([]);
  const [phase, setPhase] = useState('upload');
  const [progress, setProgress] = useState({
    percent: 0,
    current: 0,
    total: 0,
    fileName: '',
  });
  const [rows, setRows] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke on unmount only
  }, []);

  const addFiles = (fileList) => {
    const next = [...(fileList ?? [])].filter((file) => file.type?.startsWith('image/'));
    if (!next.length) {
      setError('Please choose PNG or JPG screenshots.');
      return;
    }
    setError('');
    setShots((prev) => [...prev, ...next.map(makeShot)]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeShot = (id) => {
    setShots((prev) => {
      const target = prev.find((shot) => shot.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((shot) => shot.id !== id);
    });
  };

  const goBackFromReview = () => {
    setPhase('upload');
    setRows([]);
    setFieldErrors({});
    setError('');
    setProgress({ percent: 0, current: 0, total: 0, fileName: '' });
  };

  const handleNext = async () => {
    if (!shots.length) {
      setError('Add at least one Zerodha Kite holdings screenshot.');
      return;
    }

    setError('');
    setPhase('reading');
    setProgress({
      percent: 0,
      current: 1,
      total: shots.length,
      fileName: shots[0]?.name || '',
    });

    try {
      const parsed = await parseZerodhaHoldingsScreenshots(
        shots.map((shot) => shot.file),
        {
          onProgress: (next) => {
            if (typeof next === 'number') {
              setProgress((prev) => ({ ...prev, percent: next }));
              return;
            }
            setProgress({
              percent: next.percent ?? 0,
              current: next.current ?? 0,
              total: next.total ?? shots.length,
              fileName: next.fileName ?? '',
            });
          },
        }
      );
      if (!parsed.length) {
        throw new Error('No holdings found. Use clear Zerodha Kite holdings screenshots.');
      }
      setRows(parsed);
      setPhase('review');
    } catch (err) {
      setPhase('upload');
      setError(err?.message || 'Could not read those screenshots.');
    }
  };

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const analyse = () => {
    const result = validateHoldingsRows(rows);
    setFieldErrors(result.errors);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    onSubmit(result.holdings, 'zerodha-screenshot');
  };

  if (phase === 'reading') {
    return (
      <OnboardingShell badge="OCR">
        <p className="text-2xl font-bold text-pe-text md:text-3xl">
          Reading your screenshots
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
          Parsing {shots.length} Zerodha screenshot{shots.length === 1 ? '' : 's'} on your
          device into one holdings summary…
        </p>
        <div className="mt-10">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <p className="font-semibold text-pe-text">
              Screenshot {Math.max(1, progress.current)} of {Math.max(1, progress.total || shots.length)}
            </p>
            <p className="tabular-nums text-pe-text-muted">{Math.round(progress.percent)}%</p>
          </div>
          {progress.fileName ? (
            <p className="mt-1 truncate text-[12px] text-pe-text-muted">{progress.fileName}</p>
          ) : null}

          <div className="relative mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-pe-surface">
              <div
                className="h-full rounded-full bg-pe-accent transition-all duration-300"
                style={{ width: `${Math.max(2, progress.percent)}%` }}
              />
            </div>
            {(progress.total || shots.length) > 1 ? (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
                {Array.from({ length: progress.total || shots.length }).map((_, index) => {
                  const done = progress.percent >= ((index + 1) / (progress.total || shots.length)) * 100;
                  const active = progress.current === index + 1;
                  return (
                    <span
                      key={`mile-${index}`}
                      className={`h-2.5 w-2.5 rounded-full border-2 border-pe-canvas ${
                        done || active ? 'bg-pe-accent' : 'bg-pe-border-strong'
                      }`}
                      aria-hidden
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-center text-[12px] text-pe-text-muted">
            Each marker is one screenshot — progress moves forward across the batch.
          </p>
        </div>
      </OnboardingShell>
    );
  }

  if (phase === 'review') {
    return (
      <OnboardingShell
        onBack={goBackFromReview}
        badge="Summary"
        footer={
          <>
            {error ? <p className="mb-2 text-[13px] text-pe-negative">{error}</p> : null}
            <button type="button" onClick={analyse} className={primaryBtnClass}>
              <span>Analyse the portfolio</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        }
      >
        <p className="text-2xl font-bold text-pe-text md:text-3xl">
          Review your holdings summary
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
          Parsed from {shots.length} screenshot{shots.length === 1 ? '' : 's'}. Edit
          anything that looks off, then analyse.
        </p>

        <div className="mt-8 border-t border-pe-border pt-8">
          <HoldingsEditTable
            rows={rows}
            fieldErrors={fieldErrors}
            onUpdateRow={updateRow}
            onRemoveRow={(id) =>
              setRows((prev) =>
                prev.length === 1 ? prev : prev.filter((row) => row.id !== id)
              )
            }
            onAddRow={() => setRows((prev) => [...prev, emptyHoldingRow()])}
            hint="Same table as portfolio edit — search ticker, total invested, and quantity."
          />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      onBack={onBack}
      badge="Screenshot"
      footer={
        <>
          {error ? <p className="mb-2 text-[13px] text-pe-negative">{error}</p> : null}
          <button
            type="button"
            onClick={handleNext}
            disabled={!shots.length}
            className={primaryBtnClass}
          >
            <span>Next</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      }
    >
      <p className="text-2xl font-bold text-pe-text md:text-3xl">
        Upload holdings screenshots
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-pe-text-secondary">
        Add one or more Zerodha Kite holdings screenshots. Parsing runs on your device —
        images are not uploaded to our servers.
      </p>

      <div className="mt-8 border-t border-pe-border pt-8">
        <p className={sectionLabelClass}>How to capture</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] text-pe-text-secondary">
          <li>Zerodha Kite → Holdings</li>
          <li>Capture each screen of the list (symbols, qty, invested visible)</li>
          <li>Upload all screenshots below, then tap Next</li>
        </ol>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
            className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-pe-border-strong bg-pe-surface px-5 py-10 text-center transition hover:border-pe-accent hover:bg-pe-accent-wash"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-pe-accent-wash text-pe-accent">
              <ImagePlus className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-pe-text">
              Drop screenshots or browse
            </p>
            <p className="mt-1 text-sm text-pe-text-muted">
              Multiple PNG / JPG · Zerodha Kite
            </p>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => addFiles(event.target.files)}
          />
        </div>

        {shots.length > 0 ? (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <p className={sectionLabelClass}>
                {shots.length} screenshot{shots.length === 1 ? '' : 's'} selected
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[13px] font-semibold text-pe-accent hover:text-pe-accent-pressed"
              >
                Add more
              </button>
            </div>
            <ul className="mt-3 space-y-3">
              {shots.map((shot) => (
                <li
                  key={shot.id}
                  className="overflow-hidden rounded-lg border border-pe-border"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-pe-border bg-pe-surface px-3 py-2">
                    <p className="min-w-0 truncate text-[13px] font-medium text-pe-text">
                      {shot.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeShot(shot.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-pe-text-muted hover:bg-pe-canvas hover:text-pe-negative"
                      aria-label={`Remove ${shot.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <img
                    src={shot.url}
                    alt={shot.name}
                    className="max-h-40 w-full object-contain bg-pe-canvas"
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                shots.forEach((shot) => URL.revokeObjectURL(shot.url));
                setShots([]);
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-pe-text-secondary hover:text-pe-negative"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        ) : null}
      </div>
    </OnboardingShell>
  );
}
