export default function App() {
  return (
    <div className="min-h-screen bg-pe-canvas text-pe-text">
      <header className="border-b border-pe-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <p className="text-sm font-medium tracking-wide text-pe-text-secondary">
            PocketEdge Social
          </p>
          <a
            href="https://www.pocketedge.in"
            className="text-sm text-pe-text-muted transition hover:text-pe-text"
          >
            Back to PocketEdge
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-pe-text-muted">social.pocketedge</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Community investing, coming soon.
        </h1>
        <p className="mt-4 max-w-xl text-pe-text-secondary">
          This is the dedicated social surface for PocketEdge — feeds, profiles, and
          portfolio conversations. It lives in the same repo as the main app and deploys
          independently to its own subdomain.
        </p>
      </main>
    </div>
  );
}
