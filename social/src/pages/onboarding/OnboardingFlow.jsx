import { useMemo, useState } from 'react';
import {
  CURRENT_USER,
  PEOPLE,
  TOPICS,
  addUserPortfolio,
} from '../../data/mockData';
import { setFollowedTopicSlugs, setFollowingIds } from '../../lib/socialGraphStore';
import { setOnboardingComplete } from '../../lib/sessionStore';
import { addReview } from '../../lib/reviewStore';
import { pickRandomCategory } from '../../data/fundData';
import FundReviewStep from './FundReviewStep';

const STEPS = ['welcome', 'profile', 'follow', 'topics', 'portfolio', 'fundReview', 'disclosure'];

const inputClass =
  'w-full rounded-lg border border-pe-border-strong bg-pe-canvas px-3 py-2.5 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent';

export default function OnboardingFlow({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [followIds, setFollowIds] = useState(() => new Set());
  const [topicSlugs, setTopicSlugs] = useState(() => new Set());
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioThesis, setPortfolioThesis] = useState('');
  const [assignedCategory] = useState(() => pickRandomCategory());
  const [fundId, setFundId] = useState('');
  const [fundRating, setFundRating] = useState(0);
  const [fundReviewLine, setFundReviewLine] = useState('');
  const [agreed, setAgreed] = useState(false);

  const step = STEPS[stepIndex];
  const suggestedPeople = useMemo(
    () => [...PEOPLE].sort((a, b) => b.xirr - a.xirr).slice(0, 5),
    []
  );

  const canContinue = useMemo(() => {
    if (step === 'profile') return displayName.trim().length >= 2 && /^[a-z0-9_]{3,20}$/.test(handle.trim());
    if (step === 'follow') return followIds.size >= 3;
    if (step === 'topics') return topicSlugs.size >= 1;
    if (step === 'fundReview') return Boolean(fundId) && fundRating >= 1;
    if (step === 'disclosure') return agreed;
    return true;
  }, [step, displayName, handle, followIds.size, topicSlugs.size, fundId, fundRating, agreed]);

  const next = () => {
    if (step === 'portfolio') {
      if (portfolioName.trim()) {
        addUserPortfolio(CURRENT_USER.id, {
          id: `pf_onboard_${Date.now()}`,
          name: portfolioName.trim(),
          objective: 'Long-term',
          thesis: portfolioThesis.trim(),
          totalValue: 0,
          invested: 0,
          totalPnlPct: 0,
          xirr: 0,
          holdings: [],
        });
      }
    }
    if (step === 'fundReview') {
      addReview({ fundId, rating: fundRating, body: fundReviewLine });
    }
    if (step === 'disclosure') {
      CURRENT_USER.name = displayName.trim();
      CURRENT_USER.handle = handle.trim();
      CURRENT_USER.bio = bio.trim() || CURRENT_USER.bio;
      setFollowingIds([...followIds]);
      setFollowedTopicSlugs([...topicSlugs]);
      setOnboardingComplete();
      onComplete?.();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const toggleFollow = (id) => {
    setFollowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTopic = (slug) => {
    setTopicSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-pe-canvas">
      <div className="mx-auto max-w-feed px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-pe-text-muted">
          Step {stepIndex + 1} of {STEPS.length}
        </p>

        {step === 'welcome' && (
          <>
            <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-pe-accent-wash text-3xl">
              📊
            </div>
            <h1 className="mt-5 font-serif text-2xl font-bold text-pe-text">Your investor network</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-pe-text-secondary">
              When someone mentions a stock, you&apos;ll see whether they actually hold it. Skin in the game,
              always.
            </p>
          </>
        )}

        {step === 'profile' && (
          <>
            <h1 className="mt-4 font-serif text-2xl font-bold text-pe-text">Set up your profile</h1>
            <div className="mt-6 space-y-3">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className={inputClass}
              />
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="@handle (letters, numbers, underscore)"
                className={inputClass}
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio (optional)"
                rows={3}
                className={inputClass}
              />
            </div>
          </>
        )}

        {step === 'follow' && (
          <>
            <h1 className="mt-4 font-serif text-2xl font-bold text-pe-text">Follow investors</h1>
            <p className="mt-2 text-[15px] text-pe-text-secondary">Pick at least 3 to seed your feed.</p>
            <div className="mt-5 space-y-2">
              {suggestedPeople.map((person) => {
                const selected = followIds.has(person.id);
                return (
                  <div
                    key={person.id}
                    className="flex items-center justify-between rounded-lg border border-pe-border px-3 py-3"
                  >
                    <div>
                      <p className="text-[15px] font-semibold text-pe-text">{person.name}</p>
                      <p className="text-sm text-pe-text-muted">@{person.handle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFollow(person.id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-bold ${
                        selected
                          ? 'border border-pe-border-strong bg-pe-canvas text-pe-text'
                          : 'bg-pe-accent text-white'
                      }`}
                    >
                      {selected ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-pe-text-muted">{followIds.size} of 3 minimum selected</p>
          </>
        )}

        {step === 'topics' && (
          <>
            <h1 className="mt-4 font-serif text-2xl font-bold text-pe-text">Topics you follow</h1>
            <p className="mt-2 text-[15px] text-pe-text-secondary">Shape your For You and Following feeds.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {TOPICS.map((topic) => {
                const selected = topicSlugs.has(topic.slug);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => toggleTopic(topic.slug)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                      selected
                        ? 'bg-pe-accent text-white'
                        : 'border border-pe-border-strong text-pe-text-secondary'
                    }`}
                  >
                    #{topic.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 'portfolio' && (
          <>
            <h1 className="mt-4 font-serif text-2xl font-bold text-pe-text">Add your first portfolio</h1>
            <p className="mt-2 text-[15px] text-pe-text-secondary">
              Required for $TICKER disclosure when you post. You can add holdings later.
            </p>
            <div className="mt-5 space-y-3">
              <input
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                placeholder="Portfolio name"
                className={inputClass}
              />
              <textarea
                value={portfolioThesis}
                onChange={(e) => setPortfolioThesis(e.target.value)}
                placeholder="Investment thesis"
                rows={3}
                className={inputClass}
              />
            </div>
          </>
        )}

        {step === 'fundReview' && (
          <FundReviewStep
            category={assignedCategory}
            selectedFundId={fundId}
            onSelectFund={setFundId}
            rating={fundRating}
            onRating={setFundRating}
            reviewLine={fundReviewLine}
            onReviewLine={setFundReviewLine}
          />
        )}

        {step === 'disclosure' && (
          <>
            <h1 className="mt-4 font-serif text-2xl font-bold text-pe-text">Disclosure agreement</h1>
            <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-pe-text-secondary">
              <li>• $TICKER mentions show your disclosed holdings</li>
              <li>• Portfolio edits log as trades on your profile</li>
              <li>• Misrepresentation may result in account action</li>
            </ul>
            <label className="mt-5 flex items-start gap-2 text-[15px] text-pe-text">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
              I understand and agree to disclose accurately
            </label>
          </>
        )}

        <div className="mt-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={next}
            disabled={!canContinue}
            className="w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
          >
            {step === 'disclosure' ? 'Enter feed' : step === 'portfolio' ? 'Continue' : 'Continue'}
          </button>
          {step === 'portfolio' && (
            <button type="button" onClick={next} className="py-2 text-[15px] font-semibold text-pe-text-muted">
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
