import { enrichBasket, getBasketReturn } from './basketCatalog';
import { subscribeToBasket } from './subscriptionStore';

const STORAGE_KEY = 'pocketedge_mock_investments';
const CHANGED_EVENT = 'pocketedge-investments-changed';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(investments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(investments));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function loadTrackedInvestments() {
  return read();
}

export function getTrackedInvestment(basketId) {
  return read().find((inv) => inv.basketId === basketId) ?? null;
}

export function trackInvestment(basketId, amount) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Enter a valid amount');
  }

  const investments = read();
  const idx = investments.findIndex((inv) => inv.basketId === basketId);
  const today = new Date().toISOString().slice(0, 10);

  if (idx >= 0) {
    investments[idx] = {
      ...investments[idx],
      investedAmount: investments[idx].investedAmount + parsed,
    };
  } else {
    investments.unshift({ basketId, investedAmount: parsed, since: today });
  }

  write(investments);
  subscribeToBasket(basketId);
  return investments[idx >= 0 ? idx : 0];
}

export function computeInvestmentMetrics(basket, investment) {
  const invested = investment.investedAmount;
  const enriched = enrichBasket(basket);
  const history = enriched?.navHistory;

  if (history?.length >= 2) {
    const startNav = history[0].nav;
    const endNav = history[history.length - 1].nav;
    const factor = startNav > 0 ? endNav / startNav : 1;
    const currentValue = Math.round(invested * factor);
    const returnPct = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;
    return { currentValue, returnPct };
  }

  const returnPct = getBasketReturn(basket);
  const currentValue = Math.round(invested * (1 + returnPct / 100));
  return { currentValue, returnPct };
}

export function subscribeInvestments(callback) {
  const handler = () => callback(read());
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}
