function formatCell(value, format) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'number') return value;
  if (format === 'currency') return `₹${Math.round(value).toLocaleString('en-IN')}`;
  if (format === 'percent') {
    return `${(value * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString('en-IN');
}

function ActionCard({ action }) {
  if (action.kind === 'connection_login') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
        <p className="font-semibold text-pe-text">Log in to {action.service}</p>
        {action.message ? <p className="mt-1 text-sm text-pe-text-secondary">{action.message}</p> : null}
        <a
          href={action.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-full bg-[var(--fv-accent,#ff6719)] px-4 py-2 text-[13px] font-medium text-white"
        >
          Log in
        </a>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-pe-border bg-pe-surface-secondary p-4 text-sm text-pe-text-secondary">
      Review the order proposal in the app to confirm or reject.
    </div>
  );
}

export default function AgentBlocks({ blocks = [], actions = [] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.kind === 'markdown') {
          return (
            <div key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-pe-text-secondary">
              {block.text}
            </div>
          );
        }
        if (block.kind === 'card') {
          return (
            <div key={i} className="rounded-xl border border-pe-border bg-white p-4">
              <p className="font-semibold text-pe-text">{block.title}</p>
              {block.body ? <p className="mt-1 text-sm text-pe-text-secondary">{block.body}</p> : null}
              {block.fields?.length ? (
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {block.fields.map((f) => (
                    <div key={f.label}>
                      <dt className="text-[11px] uppercase tracking-wide text-pe-text-secondary">{f.label}</dt>
                      <dd className="font-medium text-pe-text">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          );
        }
        if (block.kind === 'table') {
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-pe-border bg-white">
              {block.title ? (
                <p className="border-b border-pe-border px-4 py-2 text-sm font-medium">{block.title}</p>
              ) : null}
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-pe-text-secondary">
                      {block.columns.map((c) => (
                        <th key={c.key} className="border-b border-pe-border px-3 py-2">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-pe-border/60">
                        {block.columns.map((c) => (
                          <td key={c.key} className="px-3 py-2 text-pe-text">
                            {formatCell(row[c.key], c.format)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        return null;
      })}
      {actions.map((action, i) => (
        <ActionCard key={i} action={action} />
      ))}
    </div>
  );
}
