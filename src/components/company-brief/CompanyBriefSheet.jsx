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

/**
 * Reusable Company Brief sheet — matches the A4 print template,
 * with a real single-column layout on mobile (no transform scale).
 */
export default function CompanyBriefSheet({ brief, printReady = false }) {
  const [logoHidden, setLogoHidden] = useState(false);
  if (!brief) return null;

  const { sections } = brief;
  const nameParts = String(brief.legalName || brief.name).split(/\s+/);
  const last = nameParts.pop();
  const first = nameParts.join(' ');

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
                <div className="cb-hero-kicker">{brief.kicker}</div>
                <h1>
                  {first ? (
                    <>
                      {first} <em>{last}</em>
                    </>
                  ) : (
                    last
                  )}
                </h1>
                <p className="cb-hero-sub">{brief.tagline}</p>
              </div>
            </div>
            <div className="cb-facts">
              {(brief.facts ?? []).map((fact) => (
                <span key={fact.label} className="cb-fact">
                  <b>{fact.label}</b> {fact.value}
                </span>
              ))}
            </div>
          </header>

          <div className="cb-grid">
            <section className="cb-block wide">
              <div className="cb-block-head">
                <span className="cb-block-num">01</span>
                <span className="cb-block-title">Executive Summary</span>
              </div>
              <p className="cb-prose">
                {emphasize(sections.executiveSummary.prose, {
                  strongPhrases: sections.executiveSummary.strongPhrases,
                })}
              </p>
              <div className="cb-tags">
                {(sections.executiveSummary.tags ?? []).map((tag) => (
                  <span key={tag} className="cb-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="cb-block">
              <div className="cb-block-head">
                <span className="cb-block-num">02</span>
                <span className="cb-block-title">Products / Services</span>
              </div>
              <div className="cb-rows">
                {sections.products.map((row) => (
                  <BriefRow key={row.title} {...row} />
                ))}
              </div>
            </section>

            <section className="cb-block">
              <div className="cb-block-head">
                <span className="cb-block-num">03</span>
                <span className="cb-block-title">Key Customers</span>
              </div>
              <div className="cb-rows">
                {sections.customers.rows.map((row) => (
                  <BriefRow key={row.title} {...row} />
                ))}
              </div>
              <Note {...sections.customers.note} />
            </section>

            <section className="cb-block">
              <div className="cb-block-head">
                <span className="cb-block-num">04</span>
                <span className="cb-block-title">Business Model</span>
              </div>
              <div className="cb-flow">
                {sections.businessModel.steps.map((label, i) => (
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
              <div className="cb-rows">
                {sections.businessModel.rows.map((row, i) => (
                  <BriefRow key={i} {...row} />
                ))}
              </div>
            </section>

            <section className="cb-block">
              <div className="cb-block-head">
                <span className="cb-block-num">05</span>
                <span className="cb-block-title">Moats &amp; Advantages</span>
              </div>
              <div className="cb-rows">
                {sections.moats.map((row, i) => (
                  <BriefRow key={i} {...row} />
                ))}
              </div>
            </section>

            <section className="cb-block">
              <div className="cb-block-head">
                <span className="cb-block-num">06</span>
                <span className="cb-block-title">Growth Drivers</span>
              </div>
              <div className="cb-rows">
                {sections.growth.map((row, i) => (
                  <BriefRow key={i} {...row} />
                ))}
              </div>
            </section>

            <section className="cb-block">
              <div className="cb-block-head">
                <span className="cb-block-num">07</span>
                <span className="cb-block-title">Key Risks</span>
              </div>
              <div className="cb-rows">
                {sections.risks.map((row, i) => (
                  <BriefRow key={i} {...row} />
                ))}
              </div>
            </section>
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
        <span>A4 portrait · one page · Print → PDF (margins: none)</span>
        <span className="pe">pocketedge.in</span>
      </div>
    </div>
  );
}
