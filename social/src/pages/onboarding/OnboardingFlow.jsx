import { useCallback, useState } from 'react';
import { setOnboardingComplete } from '../../lib/sessionStore';
import { buildLiveHoldings } from '../../lib/portfolioEdit';
import { resolvePortfolioAssets } from '../../lib/portfolioAssetUniverse';
import {
  createDraftPortfolio,
  saveSocialPortfolio,
} from '../../lib/socialPortfolioApi';
import { analyzeHoldings, summarizeAnalysis } from './onboardingAnalysis';
import AttractStep from './AttractStep';
import MethodStep from './MethodStep';
import ManualStep from './ManualStep';
import ScreenshotStep from './ScreenshotStep';
import AnalysisStep, { AnalyzingStep } from './AnalysisStep';

const STEPS = {
  attract: 'attract',
  method: 'method',
  manual: 'manual',
  screenshot: 'screenshot',
  analyzing: 'analyzing',
  analysis: 'analysis',
};

/** Portfolio form-check onboarding — replaces fund-review gate. */
export default function OnboardingFlow({ userId, onComplete }) {
  const [step, setStep] = useState(STEPS.attract);
  const [holdings, setHoldings] = useState([]);
  const [source, setSource] = useState('manual');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');

  const runAnalysis = useCallback(async (nextHoldings, nextSource) => {
    setHoldings(nextHoldings);
    setSource(nextSource);
    setStep(STEPS.analyzing);
    const analysed = await analyzeHoldings(nextHoldings);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRows(analysed);
    setSummary(summarizeAnalysis(analysed));
    setStep(STEPS.analysis);
  }, []);

  const finish = async () => {
    if (!userId || finishing) return;
    setFinishing(true);
    setFinishError('');

    try {
      const editRows = holdings.map((h) => ({
        id: crypto.randomUUID(),
        ticker: h.ticker,
        invested: String(h.qty * h.avg),
        qty: String(h.qty),
      }));

      const assetsByKey = await resolvePortfolioAssets(holdings.map((h) => h.ticker));
      const built = buildLiveHoldings(editRows, assetsByKey);

      const draft = await createDraftPortfolio(userId);
      await saveSocialPortfolio(userId, draft.id, {
        kind: 'live',
        isDraft: false,
        name: 'My portfolio',
        objective: 'Built during onboarding',
        thesis: 'Checking form vs 50 and 200 day moving averages.',
        holdings: built,
        tickers: built.map((h) => h.ticker),
      });

      setOnboardingComplete(userId);
      onComplete?.();
    } catch (err) {
      // Still unlock the app if save fails — user can add portfolio later.
      console.error(err);
      setFinishError(
        err?.message
          ? `Could not save portfolio (${err.message}). Entering anyway — you can add it from Profile.`
          : 'Could not save portfolio. Entering anyway — you can add it from Profile.'
      );
      setOnboardingComplete(userId);
      window.setTimeout(() => onComplete?.(), 1200);
    } finally {
      setFinishing(false);
    }
  };

  if (step === STEPS.attract) {
    return <AttractStep onContinue={() => setStep(STEPS.method)} />;
  }

  if (step === STEPS.method) {
    return (
      <MethodStep
        onBack={() => setStep(STEPS.attract)}
        onManual={() => setStep(STEPS.manual)}
        onScreenshot={() => setStep(STEPS.screenshot)}
      />
    );
  }

  if (step === STEPS.manual) {
    return (
      <ManualStep onBack={() => setStep(STEPS.method)} onSubmit={runAnalysis} />
    );
  }

  if (step === STEPS.screenshot) {
    return (
      <ScreenshotStep onBack={() => setStep(STEPS.method)} onSubmit={runAnalysis} />
    );
  }

  if (step === STEPS.analyzing) {
    return <AnalyzingStep holdings={holdings} />;
  }

  return (
    <AnalysisStep
      rows={rows}
      summary={summary}
      source={source}
      finishing={finishing}
      finishError={finishError}
      onFinish={finish}
    />
  );
}
