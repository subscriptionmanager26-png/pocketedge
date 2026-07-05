# social.pocketedge design guide

Living reference for the social product at [social.pocketedge.in](https://social.pocketedge.in).

**Visual guide:** [design.pocketedge.in](https://design.pocketedge.in)  
**Cursor rule:** `.cursor/rules/social-design.mdc`

---

## Design intent

Substack-inspired editorial social network for investors:

- Light, reading-first canvas with warm neutrals and a single orange accent.
- UI chrome in **Inter 15px**; post and profile copy in **Source Serif 4**.
- One fixed-height header band per screen; underline tabs for navigation within a view.
- Holdings disclosure is first-class: tickers, trade pills, and portfolio context appear inline.

Reference implementations: `social/src/components/Shell.jsx`, `PageHeader.jsx`, `UnderlineTabs.jsx`, `ProfileHero.jsx`.

---

## Color tokens

Defined in `social/src/index.css` and `social/tailwind.config.js`. Always use `pe-*` Tailwind classes or CSS variables — never one-off hex in components.

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
| `pe-positive` | `#1a8917` | Gains |
| `pe-negative` | `#d93025` | Losses |
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

## Page header band (critical)

Every screen has **one primary header band** with fixed height:

| | Desktop | Mobile (below shell) |
|---|---------|----------------------|
| Height | `md:h-[72px]` | `h-14` (56px) |
| Position | `sticky top-0` | `sticky top-14` |

**Always use `PageHeader`** — never ad-hoc `py-3` / `py-4` sticky divs.

| Screen | Primary control in `PageHeader` |
|--------|----------------------------------|
| Feed | For You / Following |
| Search | `PageHeaderSearch` |
| Portfolio | `UnderlineTabs embedded` (Holdings, watchlists) |
| Markets | `UnderlineTabs embedded` + search in `PageHeaderRow` footer |
| Post detail | Back (desktop only — mobile uses shell back) |
| Own profile | User name (desktop only) |
| Public profile | Back (desktop only) |

Secondary filter rows (e.g. Posts / About / Portfolios / Trades on profile) use standalone `UnderlineTabs` **below** the hero — not in the primary band.

---

## Underline tabs

Use `UnderlineTabs` for every underline tab row. Use `embedded` prop when tabs live inside `PageHeader`.

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

Pass `mobileBack` to `Shell` from `App.jsx`. **Never duplicate back** in a mobile `PageHeader` — use `PageHeader desktopOnly` for desktop back/title.

---

## Interactions

- **Posts in feed:** body/image/See more → post detail; comments only on detail page.
- **Popovers on mobile:** prefer bottom sheets over absolute popovers that clip off-screen.
- **Compose FAB:** fixed bottom-right on mobile; does not overlap bottom nav.

---

## File map

| Path | Purpose |
|------|---------|
| `social/src/index.css` | CSS custom properties |
| `social/tailwind.config.js` | Tailwind `pe-*` + `max-w-feed` |
| `social/src/components/Shell.jsx` | App chrome, nav, mobile shell |
| `social/src/components/PageHeader.jsx` | Fixed header band |
| `social/src/components/UnderlineTabs.jsx` | Tab pattern |
| `social/src/components/ProfileHero.jsx` | Profile header |
| `social/src/pages/ProfilePage.jsx` | Profile tabs + portfolio editing |
| `social/src/pages/ActivityPage.jsx` | Activity feed |
| `.cursor/rules/social-design.mdc` | Agent-facing condensed rules |

---

## Common mistakes

1. Different header heights per page (`py-3` vs `py-5` vs no fixed height).
2. Inline tab markup instead of `UnderlineTabs`.
3. Mobile back in page content instead of shell logo slot.
4. Portfolio tabs styled differently from Markets tabs.
5. Duplicate sticky headers (shell + page both showing back or title).
6. Inconsistent `px-4` padding across pages.
7. Hardcoded colors instead of `pe-*` tokens.

---

## Local preview

```bash
cd social && npm run dev
```

Design guide (this doc as a page):

- Production: [design.pocketedge.in](https://design.pocketedge.in)
- Local: `http://localhost:5173/?design=social` (main app dev server)

Markdown download: `/social-design-guide.md`
