/**
 * PocketEdge design tokens — structured after Cesto’s brand kit
 * @see https://cesto.co/brand-kit
 *
 * Cesto uses Manrope (display), Geist (body), Barlow (labels).
 * PocketEdge uses Manrope + Inter (body) + Barlow on a warm light canvas.
 */

export const BRAND_REFERENCE = 'https://cesto.co/brand-kit';

export const CANVAS = '#000000';

export const edgeX = 'px-5 sm:px-8 lg:px-12';

/** Must match SiteHeader sticky offset when banner and nav are separate stickies */
export const BANNER_HEIGHT_CLASS = 'h-14 sm:h-16';
export const HEADER_BELOW_BANNER = 'top-14 sm:top-16';

export const content = `max-w-6xl mx-auto ${edgeX}`;

/** PocketEdge palette — institutional dark theme (June 2026) */
export const palette = {
  canvas: { hex: '#000000', token: 'bg-pe-canvas', usage: 'Page background' },
  surface: { hex: '#000000', token: 'bg-pe-surface', usage: 'Cards, inputs' },
  text: { hex: '#FFFFFF', token: 'text-pe-text', usage: 'Primary text' },
  textSecondary: { hex: '#A0A0A0', token: 'text-pe-text-secondary', usage: 'Body, labels' },
  textMuted: { hex: '#A0A0A0', token: 'text-pe-text-muted', usage: 'Captions, metadata' },
  border: { hex: '#1A1A1A', token: 'border-pe-border', usage: 'Borders, dividers' },
  accent: { hex: '#FFFFFF', token: 'text-pe-accent', usage: 'Primary accent — CTAs on dark canvas' },
  accentBright: { hex: '#FFFFFF', token: 'text-pe-accent-bright', usage: 'High-contrast accent' },
  positive: { hex: '#10B981', token: 'text-pe-positive', usage: 'Returns, success' },
  negative: { hex: '#F43F5E', token: 'text-pe-negative', usage: 'Losses, errors' },
  warning: { hex: '#F59E0B', token: 'text-pe-warning', usage: 'Highlights' },
};

/**
 * Type scale mapped to Cesto web styles (sizes adjusted for PocketEdge app density)
 */
export const typography = [
  {
    cesto: 'web-h2',
    name: 'Display',
    class: 'pe-display',
    sample: 'Create and Discover Investment Portfolios',
    usage: 'Landing hero only',
  },
  {
    cesto: 'web-h4',
    name: 'Page title',
    class: 'pe-title',
    sample: 'Dashboard',
    usage: 'PageHeader h1',
  },
  {
    cesto: 'web-h4',
    name: 'Section title',
    class: 'pe-section-title',
    sample: 'Invested baskets',
    usage: 'Dashboard / search sections',
  },
  {
    cesto: 'web-h4',
    name: 'Card title',
    class: 'pe-card-title',
    sample: 'US Tech Giants',
    usage: 'Basket cards, list rows',
  },
  {
    cesto: 'web-h5',
    name: 'Eyebrow / section label',
    class: 'pe-eyebrow',
    sample: 'Discover',
    usage: 'Optional kicker above page title',
  },
  {
    cesto: 'web-body',
    name: 'Body',
    class: 'pe-body',
    sample: 'Access investment portfolios built around themes.',
    usage: 'Descriptions, paragraphs — 16px',
  },
  {
    cesto: 'web-body-s',
    name: 'Body small',
    class: 'pe-body-s',
    sample: 'Physical infrastructure behind AI and cloud.',
    usage: 'Card descriptions, metadata — 14px',
  },
  {
    cesto: 'web-h6-regular',
    name: 'Field label',
    class: 'pe-label',
    sample: 'Amount invested',
    usage: 'Labeled metrics in cards',
  },
  {
    cesto: 'web-btn-label-s',
    name: 'Button label',
    class: 'pe-btn-label',
    sample: 'Get Started',
    usage: 'Primary / secondary buttons',
  },
  {
    cesto: 'web-h4',
    name: 'Stat value',
    class: 'pe-stat',
    sample: '₹3,11,125',
    usage: 'Metric highlights',
  },
];

export const layout = [
  { name: 'edgeX', value: 'px-5 sm:px-8 lg:px-12', usage: 'Horizontal page padding' },
  { name: 'content', value: 'max-w-6xl mx-auto + edgeX', usage: 'Landing content column' },
  { name: 'Card grid', value: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3', usage: 'Dashboard, search' },
  { name: 'App page', value: 'w-full max-w-6xl space-y-5 (left-aligned)', usage: 'AppPageLayout wrapper' },
  { name: 'Section gap', value: 'space-y-5', usage: 'Vertical rhythm in app pages' },
  { name: 'Section divider', value: 'pt-5 border-t border-pe-border', usage: 'Between dashboard sections' },
  { name: 'Basket image', value: 'aspect-[3/2] (desktop) · square card 2-col grid (mobile)', usage: 'Search — aspect-square cards on mobile' },
  {
    name: 'Label before value',
    value: 'Return label → return % (e.g. "4M Returns" then "+44.3%")',
    usage: 'All metrics: label always precedes or sits above the value',
  },
];

export const cssClasses = [
  { class: 'pe-page', desc: 'Full-page shell with canvas background' },
  { class: 'pe-card', desc: 'White surface card, rounded-2xl, border' },
  { class: 'pe-card-hover', desc: 'Interactive card hover state' },
  { class: 'pe-btn-primary', desc: 'Primary CTA — neutral fill, Barlow label' },
  { class: 'pe-btn-secondary', desc: 'Secondary CTA — muted fill' },
  { class: 'pe-input', desc: '16px body text input field' },
  { class: 'pe-display', desc: 'Manrope — landing display headings' },
  { class: 'pe-title', desc: 'Manrope — page title (app)' },
  { class: 'pe-section-title', desc: 'Manrope — section headings' },
  { class: 'pe-card-title', desc: 'Sans medium — card titles' },
  { class: 'pe-body / pe-body-s', desc: '16px / 14px body copy' },
  { class: 'pe-label', desc: 'Barlow — field labels & eyebrows' },
  { class: 'pe-btn-label', desc: 'Barlow medium — button text' },
  { class: 'pe-pill-active / pe-pill-inactive', desc: 'Filter chip states' },
  { class: 'text-pe-positive / text-pe-negative', desc: 'Return colours' },
];
