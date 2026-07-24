/**
 * Full hand-authored Company Briefs (all template sections).
 * First batch of 10 — no Market Cap / FY Revenue fact tags.
 */

function brief(partial) {
  return {
    logoUrl: `/asset-logos/stock/${partial.symbol}/icon-256.png?v=3`,
    footer: {
      title: 'Know what you own',
      subtitle: 'Plain-language company primers for everyday investors.',
    },
    source: 'curated',
    ...partial,
  };
}

export const FULL_CURATED_BRIEFS = {
  RELIANCE: brief({
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    legalName: 'Reliance Industries Limited',
    kicker: 'Energy · Conglomerate',
    tagline:
      'India’s largest private-sector conglomerate spanning Oil-to-Chemicals, digital services (Jio), retail, media, and a build-out in new energy.',
    facts: [
      { label: 'Industry', value: 'Refineries & Marketing' },
      { label: 'Sector', value: 'Energy' },
      { label: 'Website', value: 'ril.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Reliance Industries is a diversified Indian conglomerate founded by Dhirubhai Ambani and led by Mukesh Ambani. Its cash engine remains Oil-to-Chemicals (refining, fuels, petrochemicals), while consumer platforms — Jio digital services and Reliance Retail — now contribute a large share of group earnings. The company is also investing in renewables, batteries, and green hydrogen as a longer-cycle new-energy bet.',
        strongPhrases: ['Oil-to-Chemicals', 'Jio', 'Reliance Retail'],
        tags: ['O2C', 'Jio', 'Retail', 'New Energy'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Oil-to-Chemicals (O2C)',
            body: 'Integrated refining, transportation fuels, and petrochemicals from Jamnagar-scale assets.',
          },
          {
            title: 'Oil & gas',
            body: 'Exploration and production, including deepwater gas from the KG basin.',
          },
          {
            title: 'Digital services (Jio)',
            body: 'Mobile connectivity, broadband, and digital apps across a mass Indian subscriber base.',
          },
          {
            title: 'Retail',
            body: 'Omni-channel grocery, electronics, fashion & lifestyle across 20,000+ stores.',
          },
          {
            title: 'Media & new energy',
            body: 'JioStar entertainment/sports; solar, battery, and hydrogen giga-complex build-out.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Fuel & petrochemical buyers',
            body: 'Domestic marketers, exporters, and industrial chemical customers.',
          },
          {
            title: 'Jio consumers & enterprises',
            body: 'Mass retail subscribers plus SME / enterprise connectivity users.',
          },
          {
            title: 'Retail shoppers',
            body: 'Households buying grocery, electronics, and fashion in stores and online.',
          },
        ],
        note: {
          text: 'Group cash flows mix industrial commodity cycles with consumer subscription and retail spend.',
          bold: 'industrial commodity cycles',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Produce', 'Distribute', 'Platform', 'Reinvest'],
        rows: [
          {
            title: 'O2C cash engine',
            body: 'Run large integrated assets; monetise cracks, product slate, and domestic placement.',
          },
          {
            title: 'Consumer platforms',
            body: 'Scale Jio and Retail; earn from connectivity ARPU, store throughput, and digital commerce.',
          },
          {
            title: 'Capital allocation',
            body: 'Recycle O2C/digital cash into retail scale and new-energy capacity.',
          },
        ],
      },
      moats: [
        {
          title: 'Scale assets',
          body: 'World-scale refining/petchem complexity is hard and slow to replicate.',
          tone: 'good',
        },
        {
          title: 'Jio network effects',
          body: 'Largest Indian telecom franchise with deep device and app ecosystem reach.',
          tone: 'good',
        },
        {
          title: 'Retail density',
          body: 'Nationwide store footprint plus supplier leverage across categories.',
          tone: 'good',
        },
        {
          title: 'Balance-sheet power',
          body: 'Ability to fund multi-year platform and energy bets at conglomerate scale.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Retail and digital commerce expansion across grocery, electronics, and fashion.',
        },
        {
          title: null,
          body: 'Jio ARPU / subscriber monetisation and enterprise connectivity.',
        },
        {
          title: null,
          body: 'O2C optimisation toward higher-value materials amid energy-market volatility.',
        },
        {
          title: null,
          body: 'New-energy giga manufacturing (solar, batteries, electrolysers) as a multi-year option.',
        },
      ],
      risks: [
        {
          title: 'Commodity cycle',
          body: 'O2C earnings swing with global fuel cracks, feedstock, and geopolitics.',
          tone: 'risk',
        },
        {
          title: 'Execution intensity',
          body: 'Retail digital build-out and new-energy capex can pressure near-term margins.',
          tone: 'risk',
        },
        {
          title: 'Regulatory & competitive',
          body: 'Telecom, retail, and energy remain heavily policy- and competition-exposed.',
          tone: 'risk',
        },
        {
          title: 'Complexity',
          body: 'Conglomerate structure makes segment attribution and capital discipline harder to track.',
          tone: 'risk',
        },
      ],
    },
  }),

  TCS: brief({
    symbol: 'TCS',
    name: 'TCS',
    legalName: 'Tata Consultancy Services Limited',
    kicker: 'Information Technology · IT Services',
    tagline:
      'Global IT services and consulting firm — Tata Group flagship helping large enterprises run and transform technology estates.',
    facts: [
      { label: 'Industry', value: 'Computers - Software & Consulting' },
      { label: 'Sector', value: 'Information Technology' },
      { label: 'Website', value: 'tcs.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Tata Consultancy Services is India’s largest IT services company and a core Tata Group franchise. It sells consulting-led technology and engineering services to large global enterprises, with deep strength in BFSI and a broad industry mix. The model is people-plus-IP: long-running client relationships, large delivery capacity in India and overseas, and an expanding digital / AI services portfolio.',
        strongPhrases: ['consulting-led', 'BFSI'],
        tags: ['IT Services', 'Tata Group', 'Global clients'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Application & infrastructure services',
            body: 'Build, run, and modernise enterprise applications and IT operations.',
          },
          {
            title: 'Consulting & transformation',
            body: 'Business and technology consulting for cloud, data, and process change.',
          },
          {
            title: 'Digital & engineering',
            body: 'Cloud migration, AI/analytics, cybersecurity, IoT, and product engineering.',
          },
          {
            title: 'Industry solutions',
            body: 'Domain offerings for BFSI, retail, life sciences, manufacturing, and more.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Global enterprises',
            body: 'Fortune-scale clients across North America, Europe, and other markets.',
          },
          {
            title: 'BFSI institutions',
            body: 'Banks, insurers, and capital-markets firms — typically the largest vertical.',
          },
          {
            title: 'Industry verticals',
            body: 'Consumer, healthcare, manufacturing, telecom, energy, and public sector.',
          },
        ],
        note: {
          text: 'Revenue is predominantly B2B multi-year outsourcing and transformation contracts.',
          bold: 'B2B',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Win', 'Staff', 'Deliver', 'Expand'],
        rows: [
          {
            title: 'Land large accounts',
            body: 'Compete on domain depth, delivery scale, and trusted brand.',
          },
          {
            title: 'Utilise talent',
            body: 'Bill consultants and engineers on time-and-materials or outcome contracts.',
          },
          {
            title: 'Expand wallet share',
            body: 'Cross-sell digital, cloud, and engineering work inside existing clients.',
          },
        ],
      },
      moats: [
        {
          title: 'Scale & brand',
          body: 'One of the few Indian IT majors that can staff and run mega-deals globally.',
          tone: 'good',
        },
        {
          title: 'Client stickiness',
          body: 'Mission-critical systems create high switching costs once embedded.',
          tone: 'good',
        },
        {
          title: 'Tata governance halo',
          body: 'Group affiliation supports trust with boards and regulated clients.',
          tone: 'good',
        },
        {
          title: 'Vertical mix',
          body: 'Diversified industry exposure reduces dependence on any single end-market.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'AI, cloud, and cybersecurity services attached to large transformation programmes.',
        },
        {
          title: null,
          body: 'Deeper wallet share in BFSI and consumer verticals.',
        },
        {
          title: null,
          body: 'Engineering and product services for tech-native and industrial clients.',
        },
        {
          title: null,
          body: 'Geographic expansion in Europe and emerging markets alongside US strength.',
        },
      ],
      risks: [
        {
          title: 'Discretionary spend',
          body: 'Client IT budgets freeze quickly in US/Europe slowdowns.',
          tone: 'risk',
        },
        {
          title: 'Wage & utilisation',
          body: 'Margins depend on utilisation, pyramid, and attrition discipline.',
          tone: 'risk',
        },
        {
          title: 'Competition',
          body: 'Accenture, Infosys, Cognizant, and global consultancies fight for the same deals.',
          tone: 'risk',
        },
        {
          title: 'Tech disruption',
          body: 'GenAI may compress traditional application-maintenance effort over time.',
          tone: 'risk',
        },
      ],
    },
  }),

  HDFCBANK: brief({
    symbol: 'HDFCBANK',
    name: 'HDFC Bank',
    legalName: 'HDFC Bank Limited',
    kicker: 'Financial Services · Private Sector Bank',
    tagline:
      'India’s largest private-sector bank by assets — retail and wholesale banking across deposits, loans, payments, and related financial services.',
    facts: [
      { label: 'Industry', value: 'Private Sector Bank' },
      { label: 'Sector', value: 'Financial Services' },
      { label: 'Website', value: 'hdfcbank.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'HDFC Bank is a systemically important Indian private bank formed from the HDFC franchise and later merger with HDFC Ltd. It earns primarily from the spread between deposits and loans, plus fees from cards, payments, and third-party distribution. Scale, underwriting culture, and branch/digital reach make it a core proxy for formal Indian credit growth.',
        strongPhrases: ['systemically important', 'spread between deposits and loans'],
        tags: ['Private bank', 'Retail credit', 'Payments'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Retail loans',
            body: 'Home loans, auto, personal, and other consumer credit.',
          },
          {
            title: 'Wholesale banking',
            body: 'Working capital, term loans, and treasury services for corporates.',
          },
          {
            title: 'Deposits & payments',
            body: 'CASA and term deposits, cards, UPI/merchant acquiring.',
          },
          {
            title: 'Fee & distribution',
            body: 'Insurance, mutual funds, and other third-party products.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Households',
            body: 'Salaried and self-employed borrowers and depositors nationwide.',
          },
          {
            title: 'SMEs & mid-market',
            body: 'Business banking clients needing working capital and trade services.',
          },
          {
            title: 'Large corporates',
            body: 'Treasury, cash management, and wholesale credit relationships.',
          },
        ],
        note: {
          text: 'Funding franchise (deposits) is as important as the loan book for bank economics.',
          bold: 'Funding franchise',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Gather', 'Lend', 'Fee', 'Manage risk'],
        rows: [
          {
            title: 'Net interest margin',
            body: 'Borrow cheap via deposits; lend across retail and wholesale books.',
          },
          {
            title: 'Fee income',
            body: 'Cards, payments, and distribution add non-interest revenue.',
          },
          {
            title: 'Credit costs',
            body: 'Underwriting and collections determine long-run return on equity.',
          },
        ],
      },
      moats: [
        {
          title: 'Deposit franchise',
          body: 'Deep CASA and brand trust lower funding costs versus many peers.',
          tone: 'good',
        },
        {
          title: 'Distribution',
          body: 'Wide branch + digital footprint supports continuous origination.',
          tone: 'good',
        },
        {
          title: 'Underwriting culture',
          body: 'Historically strong asset quality reputation in Indian private banking.',
          tone: 'good',
        },
        {
          title: 'Scale advantages',
          body: 'Technology and compliance costs spread over a very large book.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Continued formalisation of Indian household and SME credit.',
        },
        {
          title: null,
          body: 'Payments and fee income as digital transaction volumes rise.',
        },
        {
          title: null,
          body: 'Cross-sell across the merged HDFC home-loan and banking customer base.',
        },
        {
          title: null,
          body: 'Rural and semi-urban deepening alongside metro franchise strength.',
        },
      ],
      risks: [
        {
          title: 'Credit cycle',
          body: 'Asset quality can worsen if rates, growth, or unsecured credit sour.',
          tone: 'risk',
        },
        {
          title: 'Margin pressure',
          body: 'Deposit competition and rate moves can compress NIMs.',
          tone: 'risk',
        },
        {
          title: 'Regulatory capital',
          body: 'RBI rules on capital, liquidity, and unsecured lending constrain growth pace.',
          tone: 'risk',
        },
        {
          title: 'Integration & execution',
          body: 'Post-merger franchise alignment remains a multi-year operating task.',
          tone: 'risk',
        },
      ],
    },
  }),

  INFY: brief({
    symbol: 'INFY',
    name: 'Infosys',
    legalName: 'Infosys Limited',
    kicker: 'Information Technology · IT Services',
    tagline:
      'Second-largest Indian IT services company — consulting, outsourcing, and digital engineering for global enterprises.',
    facts: [
      { label: 'Industry', value: 'Computers - Software & Consulting' },
      { label: 'Sector', value: 'Information Technology' },
      { label: 'Website', value: 'infosys.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Infosys provides consulting, technology outsourcing, and next-generation digital services to large global clients. It positions itself as a transformation partner — cloud, data/AI, customer experience, and cybersecurity — while still earning a large base from application development and maintenance. Brand, delivery scale, and a strong balance sheet keep it in the top tier of Indian IT.',
        strongPhrases: ['transformation partner', 'digital services'],
        tags: ['IT Services', 'Digital', 'Global delivery'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Digital services',
            body: 'CX, AI/analytics, cloud migration, IoT, and cybersecurity programmes.',
          },
          {
            title: 'Core application services',
            body: 'Build, maintain, and modernise enterprise applications.',
          },
          {
            title: 'Consulting',
            body: 'Strategy-to-execution advisory tied to technology change.',
          },
          {
            title: 'Engineering & platforms',
            body: 'Product engineering and proprietary/partner platforms that accelerate delivery.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Fortune / global 2000',
            body: 'Large enterprises in North America and Europe dominate the book.',
          },
          {
            title: 'Financial services',
            body: 'Banks and insurers remain a core vertical.',
          },
          {
            title: 'Industry verticals',
            body: 'Retail, manufacturing, energy, telecom, and healthcare clients.',
          },
        ],
        note: {
          text: 'Like peers, Infosys depends on multi-year B2B outsourcing relationships.',
          bold: 'B2B outsourcing',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Sell', 'Deliver', 'Automate', 'Renew'],
        rows: [
          {
            title: 'Services revenue',
            body: 'Bill skilled teams for projects and managed services.',
          },
          {
            title: 'Productivity levers',
            body: 'Use tools, platforms, and GenAI to protect margins as wage costs rise.',
          },
          {
            title: 'Account mining',
            body: 'Grow existing clients with digital and consulting attachments.',
          },
        ],
      },
      moats: [
        {
          title: 'Brand & references',
          body: 'Long track record with large Western enterprises.',
          tone: 'good',
        },
        {
          title: 'Global delivery',
          body: 'Scaled India-plus-nearshore model that competitors struggle to match cheaply.',
          tone: 'good',
        },
        {
          title: 'Balance sheet',
          body: 'Cash-rich profile supports client confidence and capital returns.',
          tone: 'good',
        },
        {
          title: 'Digital mix shift',
          body: 'Higher share of digital work versus pure legacy maintenance.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'GenAI-enabled services and productivity offerings inside large accounts.',
        },
        {
          title: null,
          body: 'Cloud and cybersecurity programmes as enterprises refresh estates.',
        },
        {
          title: null,
          body: 'Industry packages that shorten sales cycles in BFSI and manufacturing.',
        },
        {
          title: null,
          body: 'Selective geographic expansion beyond the US core.',
        },
      ],
      risks: [
        {
          title: 'Macro IT spend',
          body: 'Deal pipelines slow when US clients cut discretionary projects.',
          tone: 'risk',
        },
        {
          title: 'Pricing pressure',
          body: 'Clients push vendors on rates; automation races margins the other way.',
          tone: 'risk',
        },
        {
          title: 'Talent',
          body: 'Hiring, skilling, and attrition affect delivery quality and cost.',
          tone: 'risk',
        },
        {
          title: 'Peer competition',
          body: 'TCS, Accenture, and others bid aggressively for the same transformations.',
          tone: 'risk',
        },
      ],
    },
  }),

  DATAPATTNS: brief({
    symbol: 'DATAPATTNS',
    name: 'Data Patterns',
    legalName: 'Data Patterns (India) Limited',
    kicker: 'Industrials · Aerospace & Defense',
    tagline:
      'IP-led defence and aerospace electronics — radars, electronic warfare, avionics, satellites, and test systems designed and built in India.',
    facts: [
      { label: 'Industry', value: 'Aerospace & Defense' },
      { label: 'Sector', value: 'Industrials' },
      { label: 'Website', value: 'datapatternsindia.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Data Patterns is a vertically integrated defence and aerospace electronics company with 35+ years in high-reliability systems. It designs and manufactures radars, electronic warfare, communications, avionics, satellite, and test equipment using reusable hardware/software building blocks. Customers are primarily MoD, DRDO, DPSUs, and increasingly export buyers — aligned with India’s indigenisation push.',
        strongPhrases: ['vertically integrated', 'building blocks'],
        tags: ['Defence electronics', 'IP-led', 'Make in India'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Radars',
            body: 'Search, track, and precision-approach radar systems for defence platforms.',
          },
          {
            title: 'Electronic warfare',
            body: 'EW suites and related subsystems for aircraft, ships, and ground systems.',
          },
          {
            title: 'Avionics & communications',
            body: 'Mission electronics for fighters, helicopters, and related platforms.',
          },
          {
            title: 'Satellites & test',
            body: 'Space electronics and specialised test/qualification equipment.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Ministry of Defence / armed forces',
            body: 'End users of mission systems and upgrades.',
          },
          {
            title: 'DRDO labs',
            body: 'Development partners on indigenous programmes.',
          },
          {
            title: 'DPSUs & integrators',
            body: 'HAL, BEL, and other platform primes integrating subsystems.',
          },
          {
            title: 'Export customers',
            body: 'Select international military programmes buying finished systems.',
          },
        ],
        note: {
          text: 'Nearly all demand ultimately traces to government defence budgets and programme timing.',
          bold: 'government defence budgets',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Design IP', 'Qualify', 'Produce', 'Support'],
        rows: [
          {
            title: 'IP-led development',
            body: 'Invest early in reusable blocks; bid ready products when tenders open.',
          },
          {
            title: 'Platform lock-in',
            body: 'Get designed into programmes (e.g. Tejas, BrahMos) for multi-decade production/spares.',
          },
          {
            title: 'Avoid pure build-to-print',
            body: 'Prefer higher-margin owned designs over low-value integration work.',
          },
        ],
      },
      moats: [
        {
          title: 'Owned IP library',
          body: 'Reusable certified blocks shorten delivery versus many global OEMs.',
          tone: 'good',
        },
        {
          title: 'Vertical integration',
          body: 'Design, prototype, qualify, and manufacture largely in-house.',
          tone: 'good',
        },
        {
          title: 'Certification barriers',
          body: 'Defence quals (e.g. CEMILAC) create high switching costs.',
          tone: 'good',
        },
        {
          title: 'Indigenisation preference',
          body: 'IDDM / Atmanirbhar rules favour Indian-designed electronics.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Larger full-system wins in radar and electronic warfare.',
        },
        {
          title: null,
          body: 'Repeat production lots and upgrades on platforms already designed-in.',
        },
        {
          title: null,
          body: 'Export expansion into Europe and other allied markets.',
        },
        {
          title: null,
          body: 'India’s rising defence capex and import-substitution pipeline.',
        },
      ],
      risks: [
        {
          title: 'Single-buyer risk',
          body: 'Indian government procurement drives most revenue.',
          tone: 'risk',
        },
        {
          title: 'Lumpiness',
          body: 'Inspections, SAT delays, and tender timing create volatile quarters.',
          tone: 'risk',
        },
        {
          title: 'Working capital',
          body: 'Long inventory and receivable cycles lock cash as the company scales.',
          tone: 'risk',
        },
        {
          title: 'Imported components',
          body: 'Specialised FPGAs/RF parts face lead-time and geopolitics risk.',
          tone: 'risk',
        },
      ],
    },
  }),

  TITAN: brief({
    symbol: 'TITAN',
    name: 'Titan',
    legalName: 'Titan Company Limited',
    kicker: 'Consumer Discretionary · Jewellery & Watches',
    tagline:
      'Tata Group lifestyle company — trusted brands across jewellery (Tanishq), watches, eyewear, and adjacent categories.',
    facts: [
      { label: 'Industry', value: 'Gems, Jewellery And Watches' },
      { label: 'Sector', value: 'Consumer Discretionary' },
      { label: 'Website', value: 'titancompany.in' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Titan is among India’s most respected lifestyle companies, founded as a Tata–TIDCO joint venture. Jewellery (especially Tanishq) dominates earnings, while watches, eyewear, fragrances, and dresswear broaden the brand portfolio. The core idea is trust and design in categories that were long dominated by the unorganised sector.',
        strongPhrases: ['Tanishq', 'trust and design'],
        tags: ['Tata Group', 'Jewellery', 'Watches', 'Eyewear'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Jewellery',
            body: 'Tanishq and related brands — studded and gold jewellery via stores and omni-channel.',
          },
          {
            title: 'Watches & wearables',
            body: 'Titan and other watch brands across price points, plus wearables.',
          },
          {
            title: 'Eyewear',
            body: 'Titan Eye+ spectacles, lenses, and related retail.',
          },
          {
            title: 'Adjacencies',
            body: 'Fragrances, fashion accessories, and Indian dresswear expansion.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Aspirational households',
            body: 'Wedding, gifting, and everyday jewellery buyers seeking purity/trust.',
          },
          {
            title: 'Watch & eyewear consumers',
            body: 'Mass-premium and premium lifestyle buyers.',
          },
          {
            title: 'International diaspora / luxury',
            body: 'Overseas jewellery and watch demand, including GCC expansion.',
          },
        ],
        note: {
          text: 'Jewellery purchase decisions are heavily trust- and occasion-driven in India.',
          bold: 'trust-',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Brand', 'Retail', 'Turn gold', 'Repeat'],
        rows: [
          {
            title: 'Brand + store network',
            body: 'Drive footfall to company and franchise stores; sell high-ASP jewellery.',
          },
          {
            title: 'Gold economics',
            body: 'Manage gold price, making charges, and inventory turns carefully.',
          },
          {
            title: 'Category expansion',
            body: 'Cross-sell watches, eyewear, and lifestyle lines to the same consumer.',
          },
        ],
      },
      moats: [
        {
          title: 'Trust brand',
          body: 'Tanishq purity/assurance moat in a historically opaque category.',
          tone: 'good',
        },
        {
          title: 'Retail network',
          body: 'Deep national presence that regional jewellers struggle to match.',
          tone: 'good',
        },
        {
          title: 'Tata association',
          body: 'Governance and brand halo support premium positioning.',
          tone: 'good',
        },
        {
          title: 'Design & marketing',
          body: 'Continuous collections and wedding-season brand strength.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Formalisation and hallmarking shift share from unorganised jewellers.',
        },
        {
          title: null,
          body: 'Tier-2/3 store expansion and omni-channel jewellery.',
        },
        {
          title: null,
          body: 'International jewellery/watches (including GCC / diaspora markets).',
        },
        {
          title: null,
          body: 'Premiumisation across watches, eyewear, and dresswear.',
        },
      ],
      risks: [
        {
          title: 'Gold price & regulation',
          body: 'Bullion rules, import constraints, and gold volatility hit demand and inventory.',
          tone: 'risk',
        },
        {
          title: 'Discretionary cycle',
          body: 'Wedding/gifting spend slows in weak consumer environments.',
          tone: 'risk',
        },
        {
          title: 'Competition',
          body: 'Regional jewellers and other organised chains fight on making charges and designs.',
          tone: 'risk',
        },
        {
          title: 'Concentration',
          body: 'Jewellery still dominates the P&L versus watches/eyewear.',
          tone: 'risk',
        },
      ],
    },
  }),

  ASIANPAINT: brief({
    symbol: 'ASIANPAINT',
    name: 'Asian Paints',
    legalName: 'Asian Paints Limited',
    kicker: 'Consumer Discretionary · Paints',
    tagline:
      'India’s leading decorative paints and home-décor company — brand, dealer network, and supply chain as the core advantage.',
    facts: [
      { label: 'Industry', value: 'Paints' },
      { label: 'Sector', value: 'Consumer Discretionary' },
      { label: 'Website', value: 'asianpaints.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Asian Paints is India’s largest decorative paints company and an expanding home-décor platform (waterproofing, furnishings, kitchens, and related products). For decades it invested in a dense dealer network and rapid replenishment rather than chasing only industrial contracts. That distribution machine — plus brand recall — is the heart of the business.',
        strongPhrases: ['decorative paints', 'dealer network'],
        tags: ['Paints', 'Home décor', 'Distribution'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Decorative paints',
            body: 'Interior and exterior emulsions, enamels, and textures for homes.',
          },
          {
            title: 'Waterproofing & construction chemicals',
            body: 'Related home-protection products sold through the same network.',
          },
          {
            title: 'Home décor adjacencies',
            body: 'Wall coverings, furnishings, kitchens, sanitaryware, and lighting.',
          },
          {
            title: 'Services',
            body: 'Painting services and colour consultancy that reinforce brand preference.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Homeowners & painters',
            body: 'End consumers and applicators who specify brand at the counter.',
          },
          {
            title: 'Dealers & distributors',
            body: 'Lakhs of retail touchpoints that stock and push Asian Paints SKUs.',
          },
          {
            title: 'Projects / institutional',
            body: 'Builders and commercial projects — secondary to retail decorative.',
          },
        ],
        note: {
          text: 'The dealer is often the decisive customer in decorative paints.',
          bold: 'dealer',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Make', 'Reach', 'Replenish', 'Brand'],
        rows: [
          {
            title: 'Network-led demand',
            body: 'Win shelf space and painter loyalty; pull consumers via brand.',
          },
          {
            title: 'Supply chain speed',
            body: 'Frequent dealer replenishment keeps inventory turns high.',
          },
          {
            title: 'Premium mix',
            body: 'Shift volumes toward higher emulsions and décor adjacencies.',
          },
        ],
      },
      moats: [
        {
          title: 'Dealer density',
          body: 'Nationwide network built over decades; slow and costly to copy.',
          tone: 'good',
        },
        {
          title: 'Brand preference',
          body: 'Top-of-mind paint brand for Indian households.',
          tone: 'good',
        },
        {
          title: 'Supply chain',
          body: 'Colour and SKU availability at the counter beats many rivals.',
          tone: 'good',
        },
        {
          title: 'Data & forecasting',
          body: 'Long experience matching regional demand to inventory.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Premiumisation within decorative paints.',
        },
        {
          title: null,
          body: 'Home-décor category expansion beyond the paint can.',
        },
        {
          title: null,
          body: 'Waterproofing and construction-chemicals attach rates.',
        },
        {
          title: null,
          body: 'Rural and smaller-town network deepening.',
        },
      ],
      risks: [
        {
          title: 'New competitive capital',
          body: 'Well-funded entrants (e.g. conglomerate paint bets) can pressure share and incentives.',
          tone: 'risk',
        },
        {
          title: 'Input costs',
          body: 'Crude-linked raw materials can squeeze margins if pricing lags.',
          tone: 'risk',
        },
        {
          title: 'Real-estate cycle',
          body: 'Repainting and new-home demand track housing and renovation activity.',
          tone: 'risk',
        },
        {
          title: 'Channel conflict',
          body: 'Décor expansion must not alienate the core dealer franchise.',
          tone: 'risk',
        },
      ],
    },
  }),

  MARUTI: brief({
    symbol: 'MARUTI',
    name: 'Maruti Suzuki',
    legalName: 'Maruti Suzuki India Limited',
    kicker: 'Consumer Discretionary · Passenger Vehicles',
    tagline:
      'India’s passenger-vehicle market leader — manufacturing and selling cars with Suzuki Motor as majority parent.',
    facts: [
      { label: 'Industry', value: 'Passenger Cars & Utility Vehicles' },
      { label: 'Sector', value: 'Consumer Discretionary' },
      { label: 'Website', value: 'marutisuzuki.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Maruti Suzuki is India’s largest passenger-vehicle manufacturer by volume and Suzuki Motor’s biggest subsidiary. It designs, builds, and sells cars through a vast dealer network, spanning compact hatchbacks, sedans, and a growing utility-vehicle mix. Scale in manufacturing, service reach, and entry-level brand trust remain its defining advantages.',
        strongPhrases: ['largest passenger-vehicle manufacturer', 'Suzuki Motor'],
        tags: ['PV leader', 'Suzuki parent', 'Dealerships'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Passenger cars',
            body: 'Compact and mini hatchbacks that built the franchise.',
          },
          {
            title: 'Utility vehicles',
            body: 'SUV/UV portfolio that is a rising share of domestic sales.',
          },
          {
            title: 'Vans & LCV adjacency',
            body: 'Multipurpose and light commercial offerings.',
          },
          {
            title: 'Aftersales & OEM sales',
            body: 'Service, spares, and vehicle sales to other OEMs.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'First-time & mass buyers',
            body: 'Households entering or upgrading within affordable PV segments.',
          },
          {
            title: 'UV aspirational buyers',
            body: 'Customers shifting from hatchbacks into compact SUVs.',
          },
          {
            title: 'Fleet / institutional',
            body: 'Taxi, corporate, and government fleets.',
          },
        ],
        note: {
          text: 'Dealers are the primary retail interface; Maruti’s network density is a competitive weapon.',
          bold: 'network density',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Build', 'Distribute', 'Finance', 'Service'],
        rows: [
          {
            title: 'Manufacture at scale',
            body: 'High-volume plants keep unit costs competitive.',
          },
          {
            title: 'Dealer retail',
            body: 'Sell through one of India’s densest auto retail networks.',
          },
          {
            title: 'Lifecycle income',
            body: 'Service, spares, and accessories extend value beyond the first sale.',
          },
        ],
      },
      moats: [
        {
          title: 'Volume leadership',
          body: 'Scale manufacturing and purchasing power in the Indian PV market.',
          tone: 'good',
        },
        {
          title: 'Dealer & service reach',
          body: 'Nationwide sales and service reassure first-time buyers.',
          tone: 'good',
        },
        {
          title: 'Suzuki technology',
          body: 'Access to parent powertrains, platforms, and global engineering.',
          tone: 'good',
        },
        {
          title: 'Brand trust',
          body: 'Resale value and reliability perception in mass segments.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'UV / SUV mix shift as Indian preference moves beyond hatchbacks.',
        },
        {
          title: null,
          body: 'New model pipeline and capacity debottlenecking.',
        },
        {
          title: null,
          body: 'CNG and fuel-efficient powertrains for cost-sensitive buyers.',
        },
        {
          title: null,
          body: 'Export volumes via Suzuki’s global network.',
        },
      ],
      risks: [
        {
          title: 'Segment mix',
          body: 'Historical hatchback strength can lag if UV competition intensifies.',
          tone: 'risk',
        },
        {
          title: 'Input & commodity costs',
          body: 'Steel, precious metals, and logistics inflate bill of materials.',
          tone: 'risk',
        },
        {
          title: 'Regulatory / EV transition',
          body: 'Emission norms and electrification require sustained product investment.',
          tone: 'risk',
        },
        {
          title: 'Parent dependence',
          body: 'Platform and technology roadmap is tightly linked to Suzuki.',
          tone: 'risk',
        },
      ],
    },
  }),

  DIXON: brief({
    symbol: 'DIXON',
    name: 'Dixon Technologies',
    legalName: 'Dixon Technologies (India) Limited',
    kicker: 'Consumer Discretionary · Electronics Manufacturing',
    tagline:
      'Leading Indian EMS / ODM company — mobiles, consumer electronics, and appliances manufactured for global and domestic brands.',
    facts: [
      { label: 'Industry', value: 'Consumer Electronics' },
      { label: 'Sector', value: 'Consumer Discretionary' },
      { label: 'Website', value: 'dixoninfo.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Dixon Technologies is a scaled electronics manufacturing services company that assembles and increasingly designs products for brand owners. Mobiles and related EMS dominate revenue, with consumer electronics, lighting, and appliances as additional verticals. The strategic push is from pure assembly toward backward-integrated components (displays, cameras) and exports — while staying a relatively neutral multi-OEM partner.',
        strongPhrases: ['electronics manufacturing services', 'backward-integrated'],
        tags: ['EMS', 'Mobiles', 'ODM', 'PLI-era'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Mobile & EMS',
            body: 'Feature phones, smartphones, IT hardware, wearables, and related EMS.',
          },
          {
            title: 'Consumer electronics',
            body: 'LED/smart TVs, monitors, and display-related assemblies.',
          },
          {
            title: 'Appliances & lighting',
            body: 'Home appliances, lighting, and security/CCTV products.',
          },
          {
            title: 'Components / JVs',
            body: 'Moving into display modules, camera modules, and other sub-assemblies.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Global smartphone OEMs',
            body: 'Samsung and other large brands outsourcing India manufacturing.',
          },
          {
            title: 'Domestic electronics brands',
            body: 'TV, appliance, and lighting brands seeking ODM/OEM capacity.',
          },
          {
            title: 'Export channels',
            body: 'Overseas buyers as Dixon builds export-oriented capacity.',
          },
        ],
        note: {
          text: 'Dixon is largely B2B manufacturing for brand owners, not a consumer brand itself.',
          bold: 'B2B manufacturing',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Contract', 'Assemble', 'Localise', 'Export'],
        rows: [
          {
            title: 'EMS / ODM fees',
            body: 'Earn conversion margins on manufacturing; materials often largely pass-through.',
          },
          {
            title: 'Scale utilisation',
            body: 'Fill plants with multi-OEM volumes to leverage fixed costs.',
          },
          {
            title: 'Value-chain climb',
            body: 'Capture more BOM via components and design to defend margins.',
          },
        ],
      },
      moats: [
        {
          title: 'Neutral multi-OEM stance',
          body: 'Can serve competing brands — harder for captive OEM-aligned plants.',
          tone: 'good',
        },
        {
          title: 'Scale in mobiles EMS',
          body: 'Among India’s largest by smartphone manufacturing throughput.',
          tone: 'good',
        },
        {
          title: 'Execution track record',
          body: 'Ability to ramp large OEM programmes quickly.',
          tone: 'good',
        },
        {
          title: 'Policy alignment',
          body: 'Positioned for India electronics localisation and export ambitions.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Smartphone premiumisation and new OEM / JV volumes (e.g. Vivo-related plans).',
        },
        {
          title: null,
          body: 'Backward integration into displays and camera modules.',
        },
        {
          title: null,
          body: 'IT hardware and export-oriented manufacturing.',
        },
        {
          title: null,
          body: 'Diversification beyond mobiles into higher-value EMS niches.',
        },
      ],
      risks: [
        {
          title: 'Customer concentration',
          body: 'Mobile OEM mix means a few clients can swing volumes.',
          tone: 'risk',
        },
        {
          title: 'Thin EMS margins',
          body: 'Assembly economics are competitive; PLI fade can compress profitability.',
          tone: 'risk',
        },
        {
          title: 'Component inflation',
          body: 'Memory and other shortages can hit volumes even when costs are pass-through.',
          tone: 'risk',
        },
        {
          title: 'Competition',
          body: 'Other EMS players and OEM captive capacity fight for the same programmes.',
          tone: 'risk',
        },
      ],
    },
  }),

  PIDILITIND: brief({
    symbol: 'PIDILITIND',
    name: 'Pidilite',
    legalName: 'Pidilite Industries Limited',
    kicker: 'Commodities · Specialty Chemicals',
    tagline:
      'India’s adhesives and sealants leader — Fevicol and a wide DIY / construction-chemicals portfolio sold through deep trade channels.',
    facts: [
      { label: 'Industry', value: 'Specialty Chemicals' },
      { label: 'Sector', value: 'Commodities' },
      { label: 'Website', value: 'pidilite.com' },
    ],
    sections: {
      executiveSummary: {
        prose:
          'Pidilite manufactures adhesives, sealants, construction chemicals, art materials, and related specialty products. Fevicol made white adhesive a branded category in India; other brands (M-Seal, Dr. Fixit, Fevikwik, Fevicryl) extend the franchise. Roughly four-fifths of revenue is consumer & bazaar (trade), with the rest in B2B industrial products — powered by R&D and an unusually deep distributor network.',
        strongPhrases: ['Fevicol', 'consumer & bazaar'],
        tags: ['Adhesives', 'Construction chemicals', 'Brand-led'],
      },
      products: {
        title: 'Products / Services',
        rows: [
          {
            title: 'Adhesives & sealants',
            body: 'Fevicol and related adhesives — the core franchise.',
          },
          {
            title: 'Construction & paint chemicals',
            body: 'Waterproofing and construction chemicals (e.g. Dr. Fixit, Roff).',
          },
          {
            title: 'Art, craft & DIY',
            body: 'Fevicryl and hobby/DIY products for consumers and students.',
          },
          {
            title: 'Industrial adhesives & resins',
            body: 'B2B adhesives, resins, and pigment preparations.',
          },
        ],
      },
      customers: {
        rows: [
          {
            title: 'Carpenters & applicators',
            body: 'Tradespeople who specify Fevicol on the job — the classic demand driver.',
          },
          {
            title: 'Retail trade',
            body: 'Hardware and paint dealers across towns and cities.',
          },
          {
            title: 'Households / DIY',
            body: 'Consumers buying sealants, crafts, and repair products.',
          },
          {
            title: 'Industrial buyers',
            body: 'Manufacturers needing adhesives and specialty chemicals.',
          },
        ],
        note: {
          text: 'Influencing the carpenter often matters more than advertising to the homeowner.',
          bold: 'carpenter',
        },
      },
      businessModel: {
        title: 'Business Model',
        steps: ['Formulate', 'Brand', 'Distribute', 'Train'],
        rows: [
          {
            title: 'Brand premium',
            body: 'Charge for trust and performance in categories that look like commodities.',
          },
          {
            title: 'Trade reach',
            body: 'Push thousands of SKUs through a nationwide dealer network.',
          },
          {
            title: 'Applicator lock-in',
            body: 'Training and relationships keep Fevicol specified on site.',
          },
        ],
      },
      moats: [
        {
          title: 'Category-defining brands',
          body: 'Fevicol is synonymous with adhesive for millions of Indians.',
          tone: 'good',
        },
        {
          title: 'Applicator relationships',
          body: 'Decades of carpenter engagement create switching costs.',
          tone: 'good',
        },
        {
          title: 'Distribution depth',
          body: 'Very wide town and dealer coverage versus unorganised peers.',
          tone: 'good',
        },
        {
          title: 'Portfolio breadth',
          body: 'Many brands across adhesives, waterproofing, and crafts.',
          tone: 'good',
        },
      ],
      growth: [
        {
          title: null,
          body: 'Construction chemicals and waterproofing penetration.',
        },
        {
          title: null,
          body: 'Premiumisation within adhesives and new specialty niches (joinery, electronics/EV adhesives).',
        },
        {
          title: null,
          body: 'Share gain from unorganised players during raw-material volatility.',
        },
        {
          title: null,
          body: 'Rural and smaller-town distribution deepening.',
        },
      ],
      risks: [
        {
          title: 'Raw materials',
          body: 'VAM and other inputs can spike and compress margins before pricing catches up.',
          tone: 'risk',
        },
        {
          title: 'Competition',
          body: 'Organised chemical and paint majors push into adhesives and waterproofing.',
          tone: 'risk',
        },
        {
          title: 'Real-estate / construction',
          body: 'Building activity influences construction-chemical demand.',
          tone: 'risk',
        },
        {
          title: 'Category maturity',
          body: 'Core white adhesive is already highly penetrated in many urban markets.',
          tone: 'risk',
        },
      ],
    },
  }),
};
