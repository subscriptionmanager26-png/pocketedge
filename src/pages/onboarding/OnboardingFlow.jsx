import { useCallback, useState } from 'react';
import { setOnboardingComplete } from '../../lib/sessionStore';
import { buildLiveHoldings } from '../../lib/portfolioEdit';
import { resolvePortfolioAssets } from '../../lib/portfolioAssetUniverse';
import { mergeOnboardingHoldings } from '../../lib/portfolioImportMerge';
import {
  createDraftPortfolio,
  saveSocialPortfolio,
} from '../../lib/socialPortfolioApi';
import { analyzeHoldings, summarizeAnalysis } from './onboardingAnalysis';
import AttractStep from './AttractStep';
import ExcelStep from './ExcelStep';
import MethodStep from './MethodStep';
import ManualStep from './ManualStep';
import ScreenshotStep from './ScreenshotStep';
import MoreSourcesStep from './MoreSourcesStep';
import ConfirmInvestedStep from './ConfirmInvestedStep';
import AnalysisStep, { AnalyzingStep } from './AnalysisStep';

const STEPS = {
  attract: 'attract',
  method: 'method',
  manual: 'manual',
  excel: 'excel',
  screenshot: 'screenshot',
  moreSources: 'moreSources',
  confirmInvested: 'confirmInvested',
  analyzing: 'analyzing',
  analysis: 'analysis',
};

/** First-time portfolio form-check onboarding. */
export default function OnboardingFlow({ userId, onComplete }) {
  const [step, setStep] = useState(STEPS.attract);
  const [holdings, setHoldings] = useState([]);
  const [sources, setSources] = useState([]);
  const [excelDraft, setExcelDraft] = useState(null);
  const [screenshotDraft, setScreenshotDraft] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');

  const skipToApp = useCallback(() => {
    if (userId) setOnboardingComplete(userId);
    onComplete?.();
  }, [userId, onComplete]);

  const acceptImport = useCallback((nextHoldings, nextSource) => {
    setHoldings((prev) => mergeOnboardingHoldings(prev, nextHoldings));
    setSources((prev) => (prev.includes(nextSource) ? prev : [...prev, nextSource]));
    if (nextSource === 'zerodha-excel') setExcelDraft(null);
    if (nextSource === 'screenshot') {
      setScreenshotDraft((prev) => {
        (prev?.shots ?? []).forEach((shot) => {
          if (shot?.url) URL.revokeObjectURL(shot.url);
        });
        return null;
      });
    }
    setStep(STEPS.moreSources);
  }, []);

  const runAnalysis = useCallback(async (nextHoldings) => {
    setHoldings(nextHoldings);
    setStep(STEPS.analyzing);

    const assetsByKey = await resolvePortfolioAssets(nextHoldings.map((h) => h.ticker));
    const marked = nextHoldings.map((h) => {
      const ticker = String(h.ticker ?? '')
        .trim()
        .toUpperCase()
        .replace(/\.NS$/i, '');
      const asset = assetsByKey.get(h.ticker) || assetsByKey.get(ticker);
      return {
        ...h,
        ticker,
        name: asset?.kind === 'fund' ? asset.name : h.name,
        unmapped: !asset,
      };
    });

    const analysed = await analyzeHoldings(marked);
    // Preserve unmapped flag through analysis (DMA treat as unsure form).
    const withFlags = analysed.map((row, i) => ({
      ...row,
      unmapped: Boolean(marked[i]?.unmapped),
      form: marked[i]?.unmapped ? 'unsure' : row.form,
    }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    const nextSummary = summarizeAnalysis(withFlags);
    setRows(withFlags);
    setSummary(nextSummary);
    setUnmappedCount(nextSummary.unmappedCount ?? 0);
    setStep(STEPS.analysis);
  }, []);

  const finish = async () => {
    if (!userId || finishing) return;
    setFinishing(true);
    setFinishError('');

    try {
      const sourceRows = rows.length
        ? rows
        : holdings.map((h) => ({
            ...h,
            ticker: String(h.ticker ?? '').trim().toUpperCase(),
          }));
      const editRows = sourceRows.map((h) => ({
        id: crypto.randomUUID(),
        ticker: h.ticker,
        name: h.name ?? '',
        invested: String(h.invested ?? h.qty * h.avg),
        qty: String(h.qty),
        avg: String(h.avg ?? ''),
      }));

      const assetsByKey = await resolvePortfolioAssets(editRows.map((r) => r.ticker));
      const built = buildLiveHoldings(editRows, assetsByKey);

      const draft = await createDraftPortfolio(userId);
      await saveSocialPortfolio(userId, draft.id, {
        kind: 'live',
        isDraft: false,
        name: 'My portfolio',
        objective: '',
        thesis: '',
        holdings: built,
        tickers: built.map((h) => h.ticker),
      });

      setOnboardingComplete(userId);
      onComplete?.();
    } catch (err) {
      console.error(err);
      setFinishError(
        err?.message
          ? `Could not save portfolio (${err.message}). Entering anyway.`
          : 'Could not save portfolio. Entering anyway.'
      );
      setOnboardingComplete(userId);
      window.setTimeout(() => onComplete?.(), 1200);
    } finally {
      setFinishing(false);
    }
  };

  if (step === STEPS.attract) {
    return <AttractStep onContinue={() => setStep(STEPS.method)} onSkip={skipToApp} />;
  }

  if (step === STEPS.method) {
    return (
      <MethodStep
        onBack={() => setStep(STEPS.attract)}
        onManual={() => setStep(STEPS.manual)}
        onExcel={() => setStep(STEPS.excel)}
        onScreenshot={() => setStep(STEPS.screenshot)}
      />
    );
  }

  if (step === STEPS.manual) {
    return (
      <ManualStep
        onBack={() => setStep(STEPS.method)}
        onSubmit={(next) => acceptImport(next, 'manual')}
      />
    );
  }

  if (step === STEPS.excel) {
    return (
      <ExcelStep
        draft={excelDraft}
        onDraftChange={setExcelDraft}
        onBack={() => setStep(holdings.length ? STEPS.moreSources : STEPS.method)}
        onSubmit={(next) => acceptImport(next, 'zerodha-excel')}
      />
    );
  }

  if (step === STEPS.screenshot) {
    return (
      <ScreenshotStep
        draft={screenshotDraft}
        onDraftChange={setScreenshotDraft}
        onBack={() => setStep(holdings.length ? STEPS.moreSources : STEPS.method)}
        onSubmit={(next) => acceptImport(next, 'screenshot')}
      />
    );
  }

  if (step === STEPS.moreSources) {
    return (
      <MoreSourcesStep
        holdingCount={holdings.length}
        onBack={() => setStep(STEPS.method)}
        onAddExcel={() => setStep(STEPS.excel)}
        onAddScreenshot={() => setStep(STEPS.screenshot)}
        onContinue={() => setStep(STEPS.confirmInvested)}
      />
    );
  }

  if (step === STEPS.confirmInvested) {
    return (
      <ConfirmInvestedStep
        holdings={holdings}
        onBack={() => setStep(STEPS.moreSources)}
        onChangeHoldings={setHoldings}
        onConfirm={() => void runAnalysis(holdings)}
      />
    );
  }

  if (step === STEPS.analyzing) {
    return <AnalyzingStep holdings={holdings} />;
  }

  return (
    <AnalysisStep
      summary={summary}
      unmappedCount={unmappedCount}
      finishing={finishing}
      finishError={finishError}
      onFinish={finish}
    />
  );
}
