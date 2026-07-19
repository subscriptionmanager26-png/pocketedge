/** Remove demo localStorage written before production-only mode. */

const MOCK_USER_ID_RE = /^(u_me|u_\w+|u\d+)$/i;

function isMockUserId(id) {
  return MOCK_USER_ID_RE.test(String(id ?? ''));
}

function storeHasMockAuthors(key, listKey = 'reviews') {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.[listKey];
    if (!Array.isArray(items)) return false;
    return items.some((item) => isMockUserId(item?.authorId));
  } catch {
    return false;
  }
}

function followingHasMockIds() {
  try {
    const raw = localStorage.getItem('pe_social_following');
    if (!raw) return false;
    const ids = JSON.parse(raw);
    return Array.isArray(ids) && ids.some((id) => isMockUserId(id));
  } catch {
    return false;
  }
}

export function flushDemoLocalData() {
  if (storeHasMockAuthors('pe_social_fund_reviews')) {
    localStorage.removeItem('pe_social_fund_reviews');
    localStorage.removeItem('pe_social_community_reviews_unlocked');
  }
  if (followingHasMockIds()) {
    localStorage.removeItem('pe_social_following');
  }
  if (localStorage.getItem('pe_social_topics')) {
    localStorage.removeItem('pe_social_topics');
  }
  if (localStorage.getItem('pe_portfolio_social_v2')) {
    localStorage.removeItem('pe_portfolio_social_v2');
    localStorage.removeItem('pe_portfolio_comments_read_v2');
  }
}
