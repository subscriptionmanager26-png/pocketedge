/**
 * Company Brief library — Learning → Resources.
 * Add a new entry here and it appears on /learning and /learning/:symbol.
 */

export const COMPANY_BRIEFS = [
  {
    symbol: 'TIPSFILMS',
    slug: 'tipsfilms',
    name: 'Tips Films',
    legalName: 'Tips Films Limited',
    kicker: 'Media & Entertainment · Film Production',
    tagline:
      'Film production, distribution & library monetisation — transitioning intellectual property from theatrical releases to long-tail satellite and OTT syndication.',
    logoUrl:
      'https://zweqxjeuwwfrlpbuuayg.supabase.co/storage/v1/object/public/asset-logos/stock/TIPSFILMS/icon-256.png',
    facts: [
      { label: 'Mkt Cap', value: '₹178 Cr' },
      { label: 'FY26 Ops Rev', value: '₹158 Cr' },
      { label: 'Industry', value: 'Film Production & Distribution' },
      { label: 'ISIN', value: 'INE0LQS01015' },
      { label: 'Exchange', value: 'NSE / BSE' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Tips Films is the film arm of the Tips house—producing and distributing Hindi and regional content, and monetising an extensive copyright library across theatrical, satellite, and OTT windows. Originally incorporated in 2009, the entity was strategically demerged from Tips Industries to create a pure-play film business (music sits with Tips Music). Led by Ramesh S. Taurani, the company leverages decades of expertise in packaging franchise hits.',
        strongPhrases: ['strategically demerged', 'Ramesh S. Taurani'],
        tags: ['Incorp. 2009', 'Pure-play Demerger', 'Hindi + Regional'],
      },
      products: [
        {
          title: 'Film production',
          body: 'Hindi & regional theatrical features; expanding Punjabi / Marathi slate.',
        },
        {
          title: 'Distribution & rights',
          body: 'Theatrical (domestic & overseas), satellite, and digital / OTT.',
        },
        {
          title: 'Library monetisation',
          body: 'Ongoing commercial exploitation of owned film IPR.',
        },
        {
          title: 'Web-series',
          body: 'Long-form premium content crafted exclusively for digital platforms.',
        },
      ],
      customers: {
        rows: [
          {
            title: 'Exhibitors & distributors',
            body: 'Multiplex & single-screen theatre chains globally.',
          },
          {
            title: 'Broadcasters',
            body: 'Satellite / TV networks buying exclusive broadcast rights.',
          },
          {
            title: 'OTT platforms',
            body: 'Streaming giants licensing new theatrical titles and catalogue.',
          },
          {
            title: 'Co-producers',
            body: 'Risk-sharing financial partners (e.g., Northern Light Films).',
          },
        ],
        note: {
          text: 'Revenue collected via B2B rights buyers and exhibition partners — not direct-to-consumer tickets.',
          bold: 'B2B rights buyers',
        },
      },
      businessModel: {
        steps: ['Greenlight', 'Theatrical', 'Windows', 'Library'],
        rows: [
          {
            title: 'Finance development & production',
            body: '→ execute release → license to satellite / OTT.',
          },
          {
            title: null,
            body: 'Own IPR in perpetuity, generating long-tail cash flows well after box office exit.',
            strongInBody: 'long-tail cash flows',
          },
          {
            title: null,
            body: 'Revenue is intrinsically release-timed and lumpy; annual slate performance outweighs any single quarter.',
            strongInBody: 'release-timed and lumpy',
          },
        ],
      },
      moats: [
        {
          title: '~50 owned films',
          body: 'in perpetuity, creating library annuity independent of new releases.',
          tone: 'good',
        },
        {
          title: null,
          body: 'Franchise heritage: Race, Raaz, Raja Hindustani, plus National Award pedigree.',
          tone: 'good',
          em: ['Race', 'Raaz', 'Raja Hindustani'],
        },
        {
          title: null,
          body: 'Promoter strength and established relationships in casting & packaging star-led projects.',
          tone: 'good',
        },
        {
          title: null,
          body: 'High Tips brand recall operating as a de-risked, pure-play film P&L.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Scaling to 5–6 productions / year to create a steadier, predictable release cadence.',
          strongInBody: '5–6 productions / year',
        },
        {
          title: null,
          body: 'Robust pipeline: Dhawan film, Punjabi feature, action thriller co-pro; Race 4 & Bhoot Police 2 in scripting.',
          em: ['Race 4', 'Bhoot Police 2'],
        },
        {
          title: null,
          body: 'Deeper OTT & satellite monetisation cycles for both new titles and historical catalogue.',
        },
        {
          title: null,
          body: 'Expanding regional footprint (Punjabi / Marathi) and targeting overseas theatrical markets.',
        },
      ],
      risks: [
        {
          title: 'Hit risk',
          body: 'A few titles drive the entire year; a single flop significantly impacts P&L.',
          tone: 'risk',
        },
        {
          title: 'Lumpiness',
          body: 'Overheads persist during quiet periods (e.g., Q1 vs Q2 revenue swung from ₹95 Cr to ₹2 Cr).',
          tone: 'risk',
        },
        {
          title: null,
          body: 'Vulnerabilities to cast availability, theatrical release clashes, and digital piracy.',
          tone: 'risk',
        },
        {
          title: null,
          body: 'Currently loss-making (~₹15.8 Cr in FY26) with micro-cap equity liquidity constraints.',
          tone: 'risk',
        },
      ],
    },
    footer: {
      title: 'Know what you own',
      subtitle: 'Plain-language company primers for everyday investors.',
    },
  },
];

const BY_SYMBOL = new Map(COMPANY_BRIEFS.map((b) => [b.symbol.toUpperCase(), b]));

export function listCompanyBriefs() {
  return COMPANY_BRIEFS;
}

export function getCompanyBrief(symbol) {
  const key = String(symbol ?? '')
    .trim()
    .toUpperCase();
  return BY_SYMBOL.get(key) ?? null;
}
