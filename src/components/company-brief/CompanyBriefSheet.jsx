import { Fragment, useState } from 'react';
import './CompanyBriefSheet.css';

function emphasize(text, { strongPhrases = [], em = [], strongInBody } = {}) {
  if (!text) return null;
  const markers = [];
  for (const phrase of strongPhrases) {
    if (phrase) markers.push({ phrase, type: 'strong' });
  }
  if (strongInBody) markers.push({ phrase: strongInBody, type: 'strong' });
  for (const phrase of em) {
    if (phrase) markers.push({ phrase, type: 'em' });
  }
  if (!markers.length) return text;

  markers.sort((a, b) => b.phrase.length - a.phrase.length);
  const pattern = new RegExp(
    `(${markers.map((m) => m.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
  const typeByPhrase = new Map(markers.map((m) => [m.phrase, m.type]));
  return String(text)
    .split(pattern)
    .map((part, i) => {
      const kind = typeByPhrase.get(part);
      if (kind === 'strong') return <strong key={i}>{part}</strong>;
      if (kind === 'em') return <em key={i}>{part}</em>;
      return <Fragment key={i}>{part}</Fragment>;
    });
}

function BriefRow({ title, body, tone, em, strongInBody }) {
  const className = ['cb-row', tone === 'risk' ? 'risk' : '', tone === 'good' ? 'good' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className}>
      <div className="cb-row-ico" aria-hidden>
        <span />
      </div>
      <div className="cb-row-body">
        {title ? <strong>{title}</strong> : null}
        {title ? ' — ' : null}
        {emphasize(body, { em, strongInBody })}
      </div>
    </div>
  );
}

function Note({ text, bold }) {
  if (!text) return null;
  if (!bold || !text.includes(bold)) {
    return <p className="cb-note">{text}</p>;
  }
  const [before, ...rest] = text.split(bold);
  const after = rest.join(bold);
  return (
    <p className="cb-note">
      {before}
      <b>{bold}</b>
      {after}
    </p>
  );
}

function Block({ num, title, wide, children }) {
  if (!children) return null;
  return (
    <section className={`cb-block${wide ? ' wide' : ''}`}>
      <div className="cb-block-head">
        <span className="cb-block-num">{num}</span>
        <span className="cb-block-title">{title}</span>
      </div>
      {children}
    </section>
  );
}

function hasRows(section) {
  if (!section) return false;
  if (Array.isArray(section)) return section.length > 0;
  if (Array.isArray(section.rows)) return section.rows.length > 0;
  return false;
}

/**
 * Reusable Company Brief sheet — A4 print template with stacked mobile layout.
 * Empty sections are omitted so Screener-sourced briefs stay compact.
 */
export default function CompanyBriefSheet({ brief, printReady = false }) {
  const [logoHidden, setLogoHidden] = useState(false);
  if (!brief) return null;

  const sections = brief.sections ?? {};
  const nameParts = String(brief.legalName || brief.name).split(/\s+/);
  const last = nameParts.pop();
  const first = nameParts.join(' ');

  const products = sections.products;
  const productRows = Array.isArray(products) ? products : products?.rows;
  const productTitle = Array.isArray(products)
    ? 'Products / Services'
    : products?.title || 'Products / Services';

  const customers = sections.customers;
  const customerRows = customers?.rows;
  const businessModel = sections.businessModel;
  const modelRows = businessModel?.rows;
  const modelSteps = businessModel?.steps ?? [];
  const modelTitle = businessModel?.title || 'Business Model';
  const moats = sections.moats;
  const growth = sections.growth;
  const risks = sections.risks;

  let nextNum = 1;
  const num = () => String(nextNum++).padStart(2, '0');

  return (
    <div className="cb-root">
      <div className={`cb-stage${printReady ? ' print-ready' : ''}`}>
        <article className="cb-sheet">
          <div className="cb-topbar">
            <div className="cb-logo">
              <div className="cb-logo-mark">pe</div>
              <div className="cb-logo-text">
                PocketEdge <span>· Company Brief</span>
              </div>
            </div>
          </div>

          <header className="cb-hero">
            <div className="cb-hero-main">
              {brief.logoUrl && !logoHidden ? (
                <img
                  className="cb-company-logo"
                  src={brief.logoUrl}
                  alt={`${brief.name} logo`}
                  width={44}
                  height={44}
                  onError={() => setLogoHidden(true)}
                />
              ) : null}
              <div className="cb-hero-copy">
                {brief.kicker ? <div className="cb-hero-kicker">{brief.kicker}</div> : null}
                <h1>
                  {first ? (
                    <>
                      {first} <em>{last}</em>
                    </>
                  ) : (
                    last
                  )}
                </h1>
                {brief.tagline ? <p className="cb-hero-sub">{brief.tagline}</p> : null}
              </div>
            </div>
            {(brief.facts ?? []).length ? (
              <div className="cb-facts">
                {brief.facts.map((fact) => (
                  <span key={fact.label} className="cb-fact">
                    <b>{fact.label}</b> {fact.value}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          <div className="cb-grid">
            {sections.executiveSummary?.prose ? (
              <Block num={num()} title="Executive Summary" wide>
                <p className="cb-prose">
                  {emphasize(sections.executiveSummary.prose, {
                    strongPhrases: sections.executiveSummary.strongPhrases,
                  })}
                </p>
                {(sections.executiveSummary.tags ?? []).length ? (
                  <div className="cb-tags">
                    {sections.executiveSummary.tags.map((tag) => (
                      <span key={tag} className="cb-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Block>
            ) : null}

            {hasRows(productRows) ? (
              <Block num={num()} title={productTitle} wide={!hasRows(customerRows) && !hasRows(modelRows)}>
                <div className="cb-rows">
                  {productRows.map((row, i) => (
                    <BriefRow key={row.title || i} {...row} />
                  ))}
                </div>
              </Block>
            ) : null}

            {hasRows(customerRows) ? (
              <Block num={num()} title="Key Customers">
                <div className="cb-rows">
                  {customerRows.map((row) => (
                    <BriefRow key={row.title} {...row} />
                  ))}
                </div>
                <Note {...customers.note} />
              </Block>
            ) : null}

            {hasRows(modelRows) || modelSteps.length ? (
              <Block num={num()} title={modelTitle}>
                {modelSteps.length ? (
                  <div className="cb-flow">
                    {modelSteps.map((label, i) => (
                      <Fragment key={label}>
                        {i > 0 ? (
                          <div className="cb-step-arrow" aria-hidden>
                            →
                          </div>
                        ) : null}
                        <div className="cb-step">
                          <div className="n">{i + 1}</div>
                          <div className="t">{label}</div>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                ) : null}
                {hasRows(modelRows) ? (
                  <div className="cb-rows">
                    {modelRows.map((row, i) => (
                      <BriefRow key={i} {...row} />
                    ))}
                  </div>
                ) : null}
              </Block>
            ) : null}

            {hasRows(moats) ? (
              <Block num={num()} title="Moats & Advantages">
                <div className="cb-rows">
                  {moats.map((row, i) => (
                    <BriefRow key={i} {...row} />
                  ))}
                </div>
              </Block>
            ) : null}

            {hasRows(growth) ? (
              <Block num={num()} title="Growth Drivers">
                <div className="cb-rows">
                  {growth.map((row, i) => (
                    <BriefRow key={i} {...row} />
                  ))}
                </div>
              </Block>
            ) : null}

            {hasRows(risks) ? (
              <Block num={num()} title="Key Risks">
                <div className="cb-rows">
                  {risks.map((row, i) => (
                    <BriefRow key={i} {...row} />
                  ))}
                </div>
              </Block>
            ) : null}
          </div>

          <footer className="cb-footer">
            <div>
              <h3>{brief.footer?.title ?? 'Know what you own'}</h3>
              <p>
                {brief.footer?.subtitle ?? 'Plain-language company primers for everyday investors.'}
              </p>
            </div>
            <div className="cb-footer-brand">pocketedge.in</div>
          </footer>
        </article>
      </div>

      <div className="cb-meta-bar">
        <span>Company brief · Print → PDF (margins: none)</span>
        <span className="pe">pocketedge.in</span>
      </div>
    </div>
  );
}
