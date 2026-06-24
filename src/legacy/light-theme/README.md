# PocketEdge — Legacy Light Theme (backup)

This folder preserves the **pre–June 2026 institutional dark redesign** (warm Cesto-style light UI).

Production now ships the dark theme (`theme-redesign` on `<html>`, tokens in `src/index.css`).

## Contents

| File | Description |
|------|-------------|
| `tokens.css` | Original `:root` CSS variables (`#F7F7F5` canvas, dark text, etc.) |
| `components.css` | Original component-layer rules (`pe-nav`, `pe-btn-primary`, …) |
| `palette.snapshot.js` | Original `designTokens.js` palette hex values |

## Restore locally (dev only)

1. Open `http://localhost:5173/?legacy=1` — toggles `theme-legacy` and disables the dark theme class.
2. Or manually:
   - Copy `tokens.css` `:root` block into `src/index.css` (replace current `:root`)
   - Copy `components.css` overrides into `src/index.css` `@layer components`
   - Remove `theme-redesign` from `initAppTheme()` in `src/redesignFlags.js`

## Git history

The last commit before the dark theme ship is also available via:

```bash
git log --oneline -- src/index.css src/LandingPage.jsx
```
