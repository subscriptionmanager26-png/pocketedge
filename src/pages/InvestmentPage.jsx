import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import NewsList from '../components/NewsList';
import {
  DiscussionsList,
  HoldersList,
  INVESTMENT_TABS,
} from '../components/InvestmentSections';
import {
  getFund,
  getFundNews,
} from '../data/fundData';
import { getFundDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import { getFundAssetType } from '../lib/assetTypes';
import {
  marketFundToDetail,
  resolveMarketFund,
} from '../lib/marketDataApi';
import { fetchAssetHolders } from '../lib/assetHoldersApi';
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

  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getFundDiscussions(fundId) : []
  );
  const [holders, setHolders] = useState([]);
  const [holdersLoading, setHoldersLoading] = useState(true);
  const news = getFundNews(fundId);

  useEffect(() => {
    let cancelled = false;
    setHoldersLoading(true);
    fetchAssetHolders(fundId, { kind: 'fund' })
      .then((rows) => {
        if (!cancelled) setHolders(rows);
      })
      .catch(() => {
        if (!cancelled) setHolders([]);
      })
      .finally(() => {
        if (!cancelled) setHoldersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fundId]);

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
        logoIconUrl={fund.logoIconUrl}
        assetType="fund"
        assetKey={fund.id ?? fundId}
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
        <HoldersList
          holders={holders}
          loading={holdersLoading}
          onOpenProfile={onOpenProfile}
          emptyMessage="No disclosed holders yet."
        />
      )}

      {tab === 'news' && (
        <div>
          {news.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
          ) : (
            <NewsList items={news} />
          )}
        </div>
      )}
    </div>
  );
}
