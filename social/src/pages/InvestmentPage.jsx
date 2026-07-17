import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import Avatar from '../components/Avatar';
import NewsList from '../components/NewsList';
import {
  BlurredSection,
  DiscussionsList,
  HoldersBlurPreview,
  INVESTMENT_TABS,
  NewsBlurPreview,
  TRACK_FUND_LOCK,
} from '../components/InvestmentSections';
import {
  getFund,
  getFundHolders,
  getFundNews,
} from '../data/fundData';
import { hasFundAccess } from '../lib/assetAccess';
import { getFundDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import { getFundAssetType } from '../lib/assetTypes';
import {
  marketFundToDetail,
  resolveMarketFund,
} from '../lib/marketDataApi';
import { formatPrice } from '../lib/format';
import { getPersonSync } from '../lib/socialIdentity';
import { isDevMockMode } from '../lib/appMode';

export default function InvestmentPage({
  fundId,
  onBack,
  onOpenProfile,
}) {
  const seedFund = getFund(fundId);
  const [marketFund, setMarketFund] = useState(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const fund =
    seedFund ??
    marketFund ??
    ({
      id: fundId,
      name: fundId,
      category: 'Mutual Fund',
      nav: null,
    });
  const [tab, setTab] = useState('insights');

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);

    (async () => {
      try {
        if (seedFund) {
          if (!cancelled) setMarketLoading(false);
          return;
        }
        const found = await resolveMarketFund(fundId);
        if (!cancelled) setMarketFund(found ? marketFundToDetail(found) : null);
      } finally {
        if (!cancelled) setMarketLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fundId, seedFund]);

  const hasAccess = hasFundAccess(fundId);
  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getFundDiscussions(fundId) : []
  );
  const holders = getFundHolders(fundId);
  const news = getFundNews(fundId);

  useEffect(() => {
    let cancelled = false;
    if (isDevMockMode()) {
      setDiscussions(getFundDiscussions(fundId));
      return undefined;
    }
    const keys = [fundId, fund?.name].filter(Boolean);
    loadPostsMentioning(keys)
      .then((posts) => {
        if (!cancelled) setDiscussions(posts);
      })
      .catch(() => {
        if (!cancelled) setDiscussions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fundId, fund?.name]);

  // Holders & News are open to everyone for now (was: !hasAccess).
  const holdersLocked = false && !hasAccess;
  const hasResolvedFund = Boolean(seedFund || marketFund);

  if (!marketLoading && !hasResolvedFund) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Fund not found.</div>
    );
  }

  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </PageHeader>

      <AssetProductHeader
        name={fund.name}
        type={getFundAssetType()}
        price={marketLoading && fund.nav == null ? '…' : fund.nav}
        changePct={fund.changePct}
        previousClose={fund.previousClose}
        change={fund.change}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'insights' && (
        <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
          No insights yet - daily AI summaries will appear here.
        </p>
      )}

      {tab === 'discussions' && (
        <DiscussionsList
          posts={discussions}
          onOpenProfile={onOpenProfile}
          emptyMessage="No posts yet - posts about this fund will show up here."
        />
      )}

      {tab === 'holders' && (
        <BlurredSection
          locked={holdersLocked}
          lock={TRACK_FUND_LOCK}
          preview={<HoldersBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <div className="divide-y divide-pe-border">
            {holders.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No disclosed holders yet.</p>
            ) : (
              holders.map((userId) => {
                const person = getPersonSync(userId) ?? {
                  id: userId,
                  name: 'Member',
                  handle: 'member',
                  avatar: 'M',
                };
                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => onOpenProfile?.(userId)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-pe-surface/50"
                  >
                    <Avatar person={person} />
                    <div>
                      <p className="text-[15px] font-semibold text-pe-text">{person.name}</p>
                      <p className="text-sm text-pe-text-muted">@{person.handle} · holds in portfolio</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </BlurredSection>
      )}

      {tab === 'news' && (
        <BlurredSection
          locked={holdersLocked}
          lock={TRACK_FUND_LOCK}
          preview={<NewsBlurPreview />}
        >
          <div>
            {news.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
            ) : (
              <NewsList items={news} />
            )}
          </div>
        </BlurredSection>
      )}
    </div>
  );
}
