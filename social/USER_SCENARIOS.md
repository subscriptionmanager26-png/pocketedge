# social.pocketedge — user scenarios

Expected user actions and system responses for every screen in the social product.

**Visual screens:** [design.pocketedge.in/#scenarios](https://design.pocketedge.in/#scenarios)  
**Status key:** `built` = in app today · `partial` = UI exists, logic incomplete · `spec` = design-only, not built

---

## 1. Acquisition & auth

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| landing | Marketing home (logged out) | Scroll; tap Get started or Sign in | Hero, feed preview, disclosure promise; CTAs route to auth | built |
| login | Login | Continue with Google or magic-link email | Session created; returning user → For You feed | built |
| signup | Sign up | Accept terms; Google or email | Account created → onboarding welcome | built |

---

## 2. Post-login onboarding

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| onboard-welcome | Welcome | Tap Continue | Explain skin-in-the-game; advance to profile setup | built |
| onboard-profile | Profile setup | Set name, @handle, bio, avatar | Handle validated; Continue when required fields valid | built |
| onboard-follow | Follow investors | Follow ≥3 suggested users | Counter updates; Continue unlocks at 3 | built |
| onboard-topics | Follow topics | Select interest topics | Topics saved; feeds seeded | built |
| onboard-portfolio | First portfolio (optional) | Create portfolio or Skip | Holdings enable disclosure; skip → empty portfolio prompt | built |
| onboard-disclosure | Disclosure agreement | Read rules; agree; Enter feed | `onboarding_completed`; land on For You feed | built |

---

## 3. Feed & posts

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| feed-for-you | For You feed | Scroll; tap author, ticker, post | Ranked posts with XIRR + disclosure; deep links work | built |
| feed-following-empty | Following feed (empty) | Switch to Following | Empty state + link to Search | built |
| compose-post | Compose text post | FAB → write $TICKER thesis → Post | Post at top of feed; disclosure strip on tickers | built |
| compose-image | Compose with image | Add image + caption → Post | Image card in feed; ticker disclosure still applies | built |
| post-detail | Post detail | Open post; like; read comments | Full body + comments; shell back on mobile | built |
| add-comment | Add comment | Type comment → Reply | Comment appended; ticker disclosure on comment | built |
| ticker-disclosure | Ticker mini-card | Tap $TICKER | Desktop popover / mobile bottom sheet with position | built |

---

## 4. Search & discovery

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| search-landing | Search (no query) | Browse trending sections | Follow topics/people; navigate to profile | built |
| search-people | Search people | Query + tap / Follow | Filtered list; follow persists | built |
| search-stocks | Search stocks | Tap stock row | → Markets stock detail | built |
| follow-user | Follow / unfollow | Follow on profile or search | Toggle updates Following feed + activity | built |

---

## 5. Markets & portfolio tab

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| portfolio-holdings | Portfolio — holdings | View allocation; tap holding | Metrics + Summary/News/Trades/Posts tabs | built |
| portfolio-watchlist | Create watchlist | New list → add symbols | Watchlist saved in selector | built |
| markets-movers | Markets movers | Filter tab; tap stock | Sparkline list → stock detail | built |
| stock-detail | Stock detail | Switch community tabs | Posts/trades/news for symbol | built |

---

## 6. Profile & portfolios

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| profile-own | Own profile — edit | Edit About; Public preview toggle | Inline edits; preview matches public view | built |
| profile-public | Public profile (other) | View tabs; Follow | Read-only hero; holdings + XIRR visible | built |
| portfolio-add | Add portfolio | Add portfolio → name/thesis | New row in list → detail for holdings | built |
| portfolio-edit | Edit holdings | Add/update/remove lines | Trades auto-logged; activity updated | built |

---

## 7. Activity & notifications

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| activity-unread | Activity unread badge | Open Activity tab | Badge clears; two sections of items | built |
| activity-post-tap | Activity → post | Tap row | Post detail; marked read | built |

---

## 8. Settings & account

| ID | Scenario | User action | Expected result | Status |
|----|----------|-------------|-----------------|--------|
| settings | Settings | Open from profile menu | Notifications, accounts, legal | built |
| logout | Log out | Confirm logout | Session cleared → marketing home | built |

---

## Journey map (happy path)

```
Landing → Sign up → Onboarding (5 steps) → For You feed
    → Follow people (Search) → Following feed fills
    → Compose post ($TICKER) → Post detail + comments
    → Add portfolio + holdings → Trades tab + Activity
    → Markets stock detail → Follow community on a symbol
```

---

## Screen inventory

All 32 scenarios are implemented in the social app (mock auth + localStorage persistence).

| Dev bypass | URL |
|------------|-----|
| Skip auth | `https://social.pocketedge.in/?skipAuth=1` |

When implementing backend auth, replace mock session in `social/src/lib/sessionStore.js` with Supabase.
