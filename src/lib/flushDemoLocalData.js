/** Remove demo localStorage written before production-only mode. */

const MOCK_USER_ID_RE = /^(u_me|u_\w+|u\d+)$/i;

function isMockUserId(id) {
  return MOCK_USER_ID_RE.test(String(id ?? ''));
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
