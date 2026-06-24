import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import SiteHeader from './components/SiteHeader';
import { content } from './designTokens';
import { legalPages } from './legalContent';
import { footerLegalLinks } from './mockData';
import { getLegalSlug, getLegalUrl } from './legalRoute';

export function LegalSiteHeader() {
  return (
    <SiteHeader logoHref="/" embedded sticky={false}>
      <a
        href="/"
        className="inline-flex items-center gap-2 text-sm text-pe-text-secondary hover:text-pe-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Back to home
      </a>
    </SiteHeader>
  );
}

export default function LegalPage() {
  const slug = getLegalSlug();
  const page = legalPages[slug];

  useEffect(() => {
    document.title = `${page.title} · PocketEdge`;
    return () => {
      document.title = 'PocketEdge';
    };
  }, [page.title]);

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-pe-text">
      <main className={`${content} py-10 sm:py-14 pb-16`}>
        <div className="max-w-3xl">
          <p className="pe-eyebrow">Legal</p>
          <h1 className="pe-title mt-2">{page.title}</h1>
          <p className="text-sm text-pe-text-secondary mt-2">Last updated {page.updated}</p>

          <div className="mt-10 space-y-8">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-semibold text-pe-text">{section.heading}</h2>
                <p className="mt-2 text-base text-pe-text-secondary leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>

          <nav
            className="mt-12 pt-8 border-t border-neutral-200"
            aria-label="Other legal pages"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-pe-text-muted mb-3">
              Legal
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {footerLegalLinks.map((link) => (
                <li key={link.slug}>
                  <a
                    href={getLegalUrl(link.slug)}
                    className={
                      link.slug === slug
                        ? 'text-pe-text font-medium'
                        : 'text-pe-text-secondary hover:text-pe-text transition-colors'
                    }
                    aria-current={link.slug === slug ? 'page' : undefined}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
    </div>
  );
}
