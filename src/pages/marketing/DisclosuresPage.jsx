import { Link } from 'react-router-dom';
import MarketingShell from '../../components/MarketingShell';
import ResourcesPageHeader from '../../components/ResourcesPageHeader';
import { disclosuresPath } from '../../lib/routes';
import { useSeoMeta } from '../../hooks/useSeoMeta';

const DOCS = [
  {
    id: 'privacy',
    title: 'Privacy policy',
    href: disclosuresPath('privacy'),
    body: 'How we collect, use, and protect your personal information.',
  },
  {
    id: 'terms',
    title: 'Terms and conditions',
    href: disclosuresPath('terms'),
    body: 'Rules for using PocketEdge, accounts, and community features.',
  },
  {
    id: 'terms-of-service',
    title: 'Terms of service',
    href: disclosuresPath('terms-of-service'),
    body: 'Service availability, acceptable use, and liability limits.',
  },
];

const LEGAL = {
  privacy: {
    title: 'Privacy policy',
    updated: 'July 2026',
    sections: [
      {
        heading: 'What we collect',
        body: 'Account details you provide (such as name and email via Google sign-in), portfolio and engagement data you create on PocketEdge, and basic technical logs needed to run and secure the product.',
      },
      {
        heading: 'How we use it',
        body: 'To operate the service, personalize your experience, improve product quality, prevent abuse, and communicate important account updates. We do not sell your personal information.',
      },
      {
        heading: 'Sharing',
        body: 'We use trusted processors (for example authentication, hosting, and analytics) solely to deliver PocketEdge. Content you choose to publish may be visible to other users or visitors as designed by the product.',
      },
      {
        heading: 'Your choices',
        body: 'You may request access, correction, or deletion of account data subject to legal and operational requirements. Contact us through in-app support or the email listed on pocketedge.in.',
      },
    ],
  },
  terms: {
    title: 'Terms and conditions',
    updated: 'July 2026',
    sections: [
      {
        heading: 'Using PocketEdge',
        body: 'PocketEdge provides market information, community discussion, and portfolio tools for informational purposes. Nothing on the platform is investment advice, a solicitation, or a recommendation to buy or sell any security.',
      },
      {
        heading: 'Your responsibilities',
        body: 'You are responsible for the accuracy of information you submit, for keeping your account secure, and for complying with applicable laws. Do not post unlawful, misleading, or abusive content.',
      },
      {
        heading: 'Market data',
        body: 'Prices, returns, news, and AI-generated summaries may be delayed, incomplete, or incorrect. Always verify critical information with primary sources and licensed advisors before making decisions.',
      },
      {
        heading: 'Changes',
        body: 'We may update these terms as the product evolves. Continued use after changes are posted constitutes acceptance of the revised terms.',
      },
    ],
  },
  'terms-of-service': {
    title: 'Terms of service',
    updated: 'July 2026',
    sections: [
      {
        heading: 'Service scope',
        body: 'PocketEdge is provided on an “as is” and “as available” basis. Features may change, pause, or be discontinued. We aim for high availability but do not guarantee uninterrupted access.',
      },
      {
        heading: 'Acceptable use',
        body: 'You may not scrape, reverse engineer, overload, or misuse the service; impersonate others; or use PocketEdge to distribute spam or malware.',
      },
      {
        heading: 'Limitation of liability',
        body: 'To the fullest extent permitted by law, PocketEdge and its operators are not liable for investment losses, decisions made using platform content, or indirect / consequential damages arising from use of the service.',
      },
      {
        heading: 'Contact',
        body: 'Questions about these terms can be sent via the contact options on pocketedge.in.',
      },
    ],
  },
};

function LegalDoc({ section }) {
  const doc = LEGAL[section];
  if (!doc) {
    return (
      <p className="text-sm text-pe-text-muted">
        Document not found.{' '}
        <Link to={disclosuresPath()} className="font-semibold text-pe-accent hover:underline">
          Back to disclosures
        </Link>
      </p>
    );
  }

  return (
    <article>
      <Link
        to={disclosuresPath()}
        className="inline-flex text-[13px] font-medium text-[var(--fv-text-secondary)] transition hover:text-[var(--fv-accent)]"
      >
        ← All disclosures
      </Link>
      <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-[var(--fv-text)] md:text-[28px]">
        {doc.title}
      </h1>
      <p className="fv-caption mt-1.5">Last updated {doc.updated}</p>
      <div className="mt-8 space-y-6">
        {doc.sections.map((block) => (
          <section key={block.heading}>
            <h2 className="text-[16px] font-semibold text-[var(--fv-text)]">{block.heading}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--fv-text-secondary)]">
              {block.body}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}

export default function DisclosuresPage({ section = null }) {
  const sectionPath = section ? `/disclosures/${section}` : '/disclosures';
  useSeoMeta({
    title: section === 'privacy'
      ? 'Privacy policy'
      : section === 'terms' || section === 'terms-of-service'
        ? 'Terms'
        : 'Legal & policies',
    description:
      'Privacy, terms, and how PocketEdge operates as an information platform — not as a broker or advisor.',
    path: sectionPath,
  });
  return (
    <MarketingShell>
      {section ? (
        <LegalDoc section={section} />
      ) : (
        <>
          <ResourcesPageHeader
            title="Legal & policies"
            subtitle="Privacy, terms, and how PocketEdge operates as an information platform — not as a broker or advisor."
            className="mb-8"
          />

          <ul className="space-y-3">
            {DOCS.map((doc) => (
              <li key={doc.id}>
                <Link
                  to={doc.href}
                  className="fv-card block rounded-[20px] px-5 py-4 shadow-[var(--fv-shadow)] transition duration-150 hover:shadow-[var(--fv-shadow-hover)]"
                >
                  <p className="text-[15px] font-semibold text-[var(--fv-text)]">{doc.title}</p>
                  <p className="mt-1 text-sm text-[var(--fv-text-secondary)]">{doc.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </MarketingShell>
  );
}
