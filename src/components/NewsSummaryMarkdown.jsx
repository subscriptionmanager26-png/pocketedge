import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeNewsSummaryMarkdown } from '../lib/normalizeNewsSummaryMarkdown';

const markdownComponents = {
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-pe-text-secondary last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-pe-text-secondary last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-pe-text-secondary last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-pe-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-pe-link underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h3 className="mb-2 text-base font-semibold text-pe-text">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 text-base font-semibold text-pe-text">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-2 text-sm font-semibold text-pe-text">{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-pe-border-strong pl-3 text-sm italic text-pe-text-secondary last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded bg-pe-surface px-1 py-0.5 font-mono text-[13px] text-pe-text">{children}</code>
    ) : (
      <code className="block overflow-x-auto rounded-md bg-pe-surface p-3 font-mono text-[13px] text-pe-text">
        {children}
      </code>
    ),
  pre: ({ children }) => <pre className="mb-3 last:mb-0">{children}</pre>,
  hr: () => <hr className="my-4 border-pe-border" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto rounded-md border border-pe-border last:mb-0">
      <table className="min-w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-pe-surface">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-pe-border">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 font-semibold text-pe-text">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-pe-text-secondary">{children}</td>
  ),
};

export default function NewsSummaryMarkdown({ content, emptyLabel = 'No summary available.' }) {
  const trimmed = content?.trim();
  if (!trimmed) {
    return <p className="text-sm leading-relaxed text-pe-text-secondary">{emptyLabel}</p>;
  }

  const markdown = normalizeNewsSummaryMarkdown(trimmed);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {markdown}
    </ReactMarkdown>
  );
}
