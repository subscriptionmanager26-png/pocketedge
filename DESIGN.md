# social.pocketedge design guide

Living reference for the social product at [social.pocketedge.in](https://social.pocketedge.in).

**Visual guide:** [design.pocketedge.in](https://design.pocketedge.in)  
**User scenarios:** [design.pocketedge.in/#scenarios](https://design.pocketedge.in/#scenarios) · `social/USER_SCENARIOS.md`  
**Cursor rule:** `.cursor/rules/pocketedge-design.mdc`

---

## Design Language v1 (official)

**Official product design language** for PocketEdge shell surfaces (Feed, Portfolio, Ideas, Profile, Activity, and global chrome). Apply this when building or restyling any in-app page.

### Personality

Calm · Intelligent · Premium · Minimal · Trustworthy · Data-first · Human  

Never playful. Never colorful. Never noisy. Orange guides attention — it does not decorate.

### Surfaces & elevation

| Element | Spec |
|---------|------|
| Page canvas | `#FFFFFF` (pure white — **not** grey `#FAFAF8`) |
| Cards | `#FFFFFF` + shadow only — **no grey card fills, no heavy borders** |
| Card shadow | `0 6px 24px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)` |
| Card hover | `0 12px 36px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)` · 150ms |
| Card radius | **20px** desktop |
| Mobile feed lists | Edge-to-edge rows + hairline separators (optional; denser than floating cards) |
| Grouping | Spacing & hierarchy — not nested grey panels |

Tokens live under `.pe-feed-v1` in `src/index.css` and should be treated as the product standard for new shell UI. Prefer promoting patterns into shared `pe-*` usage when touching legacy surfaces.

### Typography (Inter)

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Display / profile name | 30–36px | 700 | Rare |
| Card title | 18px | 600 | e.g. post headlines |
| Body | 15px mobile / 16px desktop | 400 | line-height ~1.5–1.6 · max ~4 lines then collapse |
| Metadata | 13–14px | 500 | time, handle, secondary |
| Small labels | 11–12px | 500 | signal labels, captions — **prefer smaller for dense chips** |
| Floor | 12px for primary UI; 11px OK for tertiary chip labels |

### Color

| Role | Hex |
|------|-----|
| Accent | `#FF6719` |
| Primary text | `#171717` |
| Secondary text | `#6B7280` |
| Muted text | `#9CA3AF` |
| Hairline border | `#ECECEC` |
| Positive | `#16A34A` |
| Negative | `#DC2626` |
| Warning | `#D97706` |

### Components patterns

- **Primary button:** filled accent, height ~40–44, radius ~14, medium weight.
- **Ghost / Follow (mobile):** text accent; filled accent OK on desktop.
- **Stock pills:** soft green/red wash + `$TICKER +X.XX%` — not heavy bordered chips.
- **Icons:** Lucide stroke 2; custom signal icons sized like **AssetLogo `sm` (`h-8 w-8`)**.
- **Motion:** 100–150ms ease; no bounce.

### Guest / logged-out

Logged-out users see **blurred teasers**, not full content:

- Wrap teaser posts in `pointer-events-none select-none blur-[5px]` with `aria-hidden` on the blurred block.
- Show a **small number of hook posts** (seed: `src/data/guestFeedHooks.js`), then one clear **sign-in CTA** (`GuestSignInCta` hero).
- Do **not** put “Sign in to read” chips on every line.
- Same pattern elsewhere (portfolio metrics, security rails): blur the content, CTA unlocks it.
- Guest feed uses Design Language v1 post chrome (`FeedPostCard`), not a separate legacy layout.
- Hide composer and Follow actions while logged out.

### Reference implementation

| Path | Role |
|------|------|
| `src/pages/FeedDesignPage.jsx` | Feed layout (tabs, composer, posts; guest blur branch) |
| `src/components/feed-v1/*` | Top bar, post card, right rail |
| `src/components/PostCard.jsx` | Logged-in feed / profile / post-detail card (v1 shadow) |
| `src/components/SecurityIdeaCard.jsx` | Ideas discovery cards |
| `src/components/AssetProductHeader.jsx` + `AssetDetailSections.jsx` | Security detail (v1) |
| `src/index.css` → `.pe-feed-v1` | Design Language tokens |
| `src/components/GuestSignInCta.jsx` | Guest unlock CTA |

**Retired hubs:** Explore and Markets are no longer product destinations. `/explore`, `/search`, and `/markets` redirect to **Ideas**. Discovery is Ideas + global search. Asset detail URLs (`/stock`, `/etf`, `/fund`, `/index`, `/commodity`) remain.

Legacy editorial surfaces (Source Serif reading pages, old bordered grey cards) should migrate to v1 when touched — do not invent a third look.

---

## Design intent (legacy / editorial)

Substack-inspired editorial social network for investors (historical framing):

- Light, reading-first canvas with warm neutrals and a single orange accent.
- UI chrome in **Inter 15px**; post and profile copy in **Source Serif 4** on remaining reading-heavy legacy surfaces.
- One fixed-height header band per screen; underline tabs for navigation within a view.
- Holdings disclosure is first-class: tickers, trade pills, and portfolio context appear inline.

> **Canonical language:** Prefer **Design Language v1** above for all new and restyled shell work.

Reference implementations: `src/components/Shell.jsx`, `PageHeader.jsx`, `UnderlineTabs.jsx`, `ProfileHero.jsx`.

---

## Color tokens

Defined in `src/index.css` and `tailwind.config.js`. Always use `pe-*` Tailwind classes or CSS variables — never one-off hex in components.

| Token | Hex | Usage |
|-------|-----|-------|
| `pe-canvas` | `#ffffff` | Page background |
| `pe-surface` | `#f7f6f4` | Inputs, chips, subtle panels |
| `pe-text` | `#1a1a1a` | Primary UI text |
| `pe-text-secondary` | `#6b6b6b` | Secondary labels |
| `pe-text-muted` | `#8a8a8a` | Placeholders, meta |
| `pe-border` | `#ececec` | Dividers |
| `pe-border-strong` | `#e7e5e1` | Outlined buttons |
| `pe-accent` | `#ff6719` | Primary CTA, active tab underline |
| `pe-accent-pressed` | `#e5560e` | Hover on filled accent buttons |
| `pe-accent-wash` | `#fff7f2` | Highlight backgrounds |
| `pe-link` / `pe-ticker` | `#4a6fe3` | Links, ticker underlines |
| `pe-positive` | `#1a8917` | Gains (legacy); v1 prefers `#16A34A` for new surfaces |
| `pe-negative` | `#d93025` | Losses (legacy); v1 prefers `#DC2626` for new surfaces |
| `pe-ink` | `#1f1f1f` | Serif reading text |

---
## Typography

| Role | Family | Size | Weight | Class |
|------|--------|------|--------|-------|
| UI default | Inter | 15px | 400–700 | `text-[15px]` |
| Page / profile title | Source Serif 4 | 22–24px | 700 | `font-serif text-[22px] md:text-2xl font-bold` |
| Post body | Source Serif 4 | 16px | 400 | `font-serif text-base leading-6 text-pe-ink` |
| Meta / stats | Inter | 13–14px | 400–600 | `text-sm text-pe-text-muted` |
| Tab labels | Inter | 15px | 600 | `text-[15px] font-semibold` |

---

## Layout

### Desktop shell

- **Left sidebar:** 232px fixed width.
- **Logo mark:** 28px.
- **Nav items:** `min-h-12`, icons `h-6 w-6`, labels 15px semibold when active.
- **Feed column:** `max-w-feed` (40rem / 640px), always `px-4` horizontal padding.
- **Content bias:** middle column sits left; optional right whitespace (`md:mr-[420px]`) on wide screens.

### Mobile shell

- **Top bar:** 56px (`h-14`), sticky.
- **Page header:** 56px below shell (`top-14`); shell + page header = 112px stacked chrome.
- **Bottom nav:** avatar-only profile entry (not a labeled tab slot).

### Padding rule

All middle-column sections use **`px-4`**. Do not mix `px-5` or `px-6` in the main feed column.

---

## Page chrome under the global top bar

Shell owns **one** sticky top bar (`FeedTopBar`) and desktop right rail. Page bodies should **not** add a second sticky `PageHeader` band under it.

| Screen | In-content chrome |
|--------|-------------------|
| Feed | For You / Following filters in page body |
| Ideas | Discovery rails (no local search) |
| Portfolio | `UnderlineTabs` in content (list switcher) |
| Asset detail | `AssetProductHeader` + section rails; Shell `mobileBack` |
| Post detail | Shell back on mobile |
| Settings | Title + v1 card list |
| Profile | Hero + `UnderlineTabs` below; edit actions inline |

**One global search** lives in `FeedTopBar` only — people, topics, securities. Do not add per-page search fields on shell surfaces.

---

## Underline tabs

Use `UnderlineTabs` for in-content filter rows (portfolio lists, profile sections). Prefer non-sticky placement under the global top bar.

- Active: `text-pe-text` + 2px `bg-pe-accent` bottom bar.
- Inactive: `text-pe-text-muted hover:text-pe-text`.
- Never copy tab button markup inline.

---

## Profile

### ProfileHero

Shared hero above all profile tabs:

- XL avatar left; name + verified badge + optional Public/Private toggle on same row as name.
- `@handle` in muted 15px Inter.
- Bio in Source Serif 4.
- Stats row: Followers, Following, Assets influenced.

### Profile tabs

`Posts` · `About me` · `Portfolios` · `Trades`

- **Public/Private view toggle** sits inline with the display name (not in a separate edit bar).
- Portfolio list shows name + thesis only; **Add portfolio** as primary action.
- Portfolio detail editing is inline: name, objective, thesis, holdings add/update/remove.
- Trades auto-log when holdings change.
- No per-field privacy toggles — portfolios, holdings, and XIRR are always visible on public profiles.

---

## Activity feed

- Nav badge for unread activity from followed users and community events on held stocks.
- Feed types: posts, trades, portfolio changes.
- Read/unread state persisted in `activityStore.js`.

---

## Holdings disclosure

- Tickers use `pe-ticker` underline styling; tap opens `TickerMiniCard`.
- **Mobile:** bottom sheet (portal). **Desktop:** inline popover.
- Stop propagation on ticker taps so they do not open the parent post.
- Trade pills and “via” labels surface who influenced a position.

---

## Buttons

| Variant | Classes |
|---------|---------|
| Primary | `bg-pe-accent text-white hover:bg-pe-accent-pressed rounded-md px-4 py-2 text-sm font-bold` |
| Secondary | `border border-pe-border-strong bg-pe-canvas hover:bg-pe-surface rounded-md px-4 py-2 text-sm font-bold` |
| Following (active) | Same as secondary |
| Text / link | `text-pe-link` or `text-pe-accent font-semibold` |

---

## Mobile shell slots

**Left slot — exactly one of:**

1. Back button (post detail, public profile, stock detail)
2. Logo + feed dropdown
3. Logo alone

Pass `mobileBack` to `Shell` from `App.jsx`. **Never duplicate back** on mobile for asset detail / post detail / public profile — Shell owns the mobile back control.

---

## Shell chrome (constant)

Across **all** authenticated/landing shell pages:

| Region | Contents |
|--------|----------|
| Top bar | Search (global — anything) · Notifications · Profile menu |
| Search | One field in the top bar; filter pills appear after typing (optional narrowing) |
| Right rail (desktop) | Market Today · Trending · Top Discussions · People · Portfolio CTA |
| Left / bottom nav | Feed · Ideas · Portfolio only |

Implementation: `Shell.jsx` mounts `feed-v1/FeedTopBar` + `feed-v1/FeedRightRail`. Page bodies only fill the center column.

---

## Interactions

- **Posts in feed:** body/image/See more → post detail; comments only on detail page.
- **Popovers on mobile:** prefer bottom sheets over absolute popovers that clip off-screen.
- **Compose FAB:** fixed bottom-right on mobile; does not overlap bottom nav.

---

## File map

| Path | Purpose |
|------|---------|
| `src/index.css` | CSS custom properties + `.pe-feed-v1` tokens |
| `tailwind.config.js` | Tailwind `pe-*` + `max-w-feed` |
| `src/components/Shell.jsx` | App chrome, nav, top bar, right rail |
| `src/components/feed-v1/FeedTopBar.jsx` | Global search + notifications + profile |
| `src/components/UnderlineTabs.jsx` | In-content tab pattern |
| `src/components/ProfileHero.jsx` | Profile header |
| `src/pages/IdeasPage.jsx` | Discovery hub (replaces Explore/Markets) |
| `src/pages/ProfilePage.jsx` | Profile tabs + portfolio editing |
| `src/pages/ActivityPage.jsx` | Activity feed |
| `.cursor/rules/pocketedge-design.mdc` | Agent-facing Design Language v1 rules |

---

## Common mistakes

1. Adding a second sticky header under `FeedTopBar`.
2. Inline tab markup instead of `UnderlineTabs`.
3. Mobile back in page content instead of Shell `mobileBack`.
4. Per-page search fields (use global search only).
5. Linking to `/explore` or `/markets` as destinations (redirect to Ideas).
6. Inconsistent `px-4` / `md:px-6` padding across pages.
7. Hardcoded colors instead of `pe-*` / `--fv-*` tokens.
8. Claiming “Live” on the right rail while still on mock data.

---

## Local preview

```bash
npm run dev
```

Design guide (this doc as a page):

- Production: [design.pocketedge.in](https://design.pocketedge.in)
- Local: `http://localhost:5173/?design=social` (main app dev server)

Markdown download: `/social-design-guide.md`
