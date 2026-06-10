import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import BasketCard from '../components/BasketCard';
import {
  catalogBaskets,
  formatCurrency,
  formatPercent,
  getBasketById,
} from '../basketCatalog';
import { navigateApp } from '../appRoute';
import { MAX_USER_BASKETS } from '../basketStore';
import {
  computeInvestmentMetrics,
  loadTrackedInvestments,
  subscribeInvestments,
} from '../investmentStore';
import AppPageLayout from '../components/AppPageLayout';

const CARD_GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
const SECTION_DIVIDER = 'pt-5 border-t border-pe-border';

function formatInvestedSince(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DashboardPage({ userBaskets }) {
  const [tracked, setTracked] = useState(loadTrackedInvestments);

  useEffect(() => subscribeInvestments(setTracked), []);

  const investments = useMemo(
    () =>
      tracked
        .map((inv) => {
          const basket = getBasketById(inv.basketId, userBaskets);
          if (!basket) return null;
          const { currentValue, returnPct } = computeInvestmentMetrics(basket, inv);
          return {
            ...inv,
            basket,
            currentValue,
            returnPct,
          };
        })
        .filter(Boolean),
    [tracked, userBaskets]
  );

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalReturn = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  const openBasket = (id) => navigateApp({ tab: 'basket', basketId: id });

  return (
    <AppPageLayout>
      <PageHeader title="Dashboard" align="left" className="!mb-0" />

      <div className={`${CARD_GRID} lg:grid-cols-4`}>
        <StatCard label="Portfolio value" value={formatCurrency(totalCurrent)} />
        <StatCard label="Total invested" value={formatCurrency(totalInvested)} />
        <StatCard
          label="Overall return"
          value={formatPercent(totalReturn)}
          valueClassName={totalReturn >= 0 ? 'text-pe-positive' : 'text-pe-negative'}
        />
        <StatCard
          label="Open positions"
          value={String(investments.length)}
          detail={`${userBaskets.length} of ${MAX_USER_BASKETS} baskets created`}
        />
      </div>

      <section className={SECTION_DIVIDER}>
        <div className="mb-3">
          <h2 className="pe-section-title">Invested baskets</h2>
          <p className="pe-body-s mt-1">
            Baskets you&apos;re paper-tracking — amounts and estimated returns at a glance.
          </p>
        </div>
        {investments.length === 0 ? (
          <EmptyState
            message="No tracked baskets yet"
            hint="Open a basket and use Invest and Track"
            onAction={() => navigateApp({ tab: 'search' })}
          />
        ) : (
          <div className={CARD_GRID}>
            {investments.map((inv) => (
              <InvestedBasketCard
                key={inv.basketId}
                investment={inv}
                onClick={() => openBasket(inv.basketId)}
              />
            ))}
          </div>
        )}
      </section>

      <section className={SECTION_DIVIDER}>
        <div className="mb-3">
          <h2 className="pe-section-title">Baskets you created</h2>
          <p className="pe-body-s mt-1">
            Portfolios you&apos;ve published on PocketEdge.
          </p>
        </div>
        {userBaskets.length === 0 ? (
          <EmptyState
            message="No baskets created"
            hint="Build your first basket and share it"
            onAction={() => navigateApp({ tab: 'create' })}
          />
        ) : (
          <div className={CARD_GRID}>
            {userBaskets.map((basket) => (
              <BasketCard
                key={basket.id}
                basket={basket}
                subtitle={`${basket.weightingType === 'equal' ? 'Equal' : 'Custom'} weight · Returns ${formatPercent(basket.stats?.cagr ?? 0)}`}
                onClick={() => openBasket(basket.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className={SECTION_DIVIDER}>
        <div className="mb-3">
          <h2 className="pe-section-title">Trending</h2>
          <p className="pe-body-s mt-1">
            Popular baskets on the platform right now.
          </p>
        </div>
        <div className={CARD_GRID}>
          {catalogBaskets.slice(0, 3).map((basket) => (
            <BasketCard
              key={basket.id}
              basket={basket}
              onClick={() => openBasket(basket.id)}
            />
          ))}
        </div>
      </section>
    </AppPageLayout>
  );
}

function StatCard({ label, value, detail, valueClassName = 'text-pe-text' }) {
  return (
    <div className="pe-card p-4 sm:p-5 h-full">
      <p className="pe-label font-medium text-pe-text-secondary">{label}</p>
      <p className={`pe-stat mt-1 ${valueClassName}`}>{value}</p>
      {detail && <p className="pe-body-s mt-1.5">{detail}</p>}
    </div>
  );
}

function InvestedBasketCard({ investment, onClick }) {
  const { basket, investedAmount, currentValue, returnPct, since } = investment;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-full text-left pe-card p-4 sm:p-5 pe-card-hover"
    >
      <h3 className="pe-card-title sm:text-lg">{basket.name}</h3>
      <p className="pe-body-s mt-1">
        Invested since {formatInvestedSince(since)}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-3 pt-3 border-t border-pe-border/60">
        <div>
          <dt className="pe-label">Amount invested</dt>
          <dd className="pe-body font-semibold text-pe-text mt-0.5 tabular-nums">
            {formatCurrency(investedAmount)}
          </dd>
        </div>
        <div>
          <dt className="pe-label">Current value</dt>
          <dd className="pe-body font-semibold text-pe-text mt-0.5 tabular-nums">
            {formatCurrency(currentValue)}
          </dd>
        </div>
        <div>
          <dt className="pe-label">Return</dt>
          <dd
            className={`pe-body font-semibold mt-0.5 tabular-nums ${
              returnPct >= 0 ? 'text-pe-positive' : 'text-pe-negative'
            }`}
          >
            {formatPercent(returnPct)}
          </dd>
        </div>
      </dl>
    </button>
  );
}

function EmptyState({ message, hint, onAction }) {
  return (
    <div className="pe-card border-dashed p-5 text-left">
      <p className="text-base text-neutral-700">{message}</p>
      <p className="text-sm text-neutral-500 mt-1 mb-3">{hint}</p>
      <button
        type="button"
        onClick={onAction}
        className="text-sm font-semibold text-neutral-900 hover:text-neutral-600"
      >
        Get started →
      </button>
    </div>
  );
}
