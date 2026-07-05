import { useMemo, useState } from 'react';
import { SCENARIO_PHASES, SOCIAL_USER_SCENARIOS } from '../../socialUserScenarios';
import { ScenarioScreenPreview, StatusPill } from './ScenarioScreens';

export default function SocialScenariosSection() {
  const [phaseFilter, setPhaseFilter] = useState('all');

  const filtered = useMemo(() => {
    if (phaseFilter === 'all') return SOCIAL_USER_SCENARIOS;
    return SOCIAL_USER_SCENARIOS.filter((s) => s.phase === phaseFilter);
  }, [phaseFilter]);

  const counts = useMemo(() => {
    const c = { built: 0, partial: 0, spec: 0 };
    SOCIAL_USER_SCENARIOS.forEach((s) => {
      c[s.status] = (c[s.status] ?? 0) + 1;
    });
    return c;
  }, []);

  return (
    <section id="scenarios" className="scroll-mt-24">
      <h2 className="font-serif text-2xl font-bold text-pe-text">User scenarios</h2>
      <p className="mt-2 max-w-3xl text-[15px] leading-6 text-pe-text-secondary">
        Every screen and flow in social.pocketedge — user action, expected system response, and a wireframe preview.
        Full matrix in{' '}
        <a href="/social-user-scenarios.md" className="font-semibold text-pe-link hover:underline">
          social-user-scenarios.md
        </a>
        .
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
        <span className="rounded-full bg-pe-positive/10 px-2.5 py-1 font-semibold text-pe-positive">
          {counts.built} built
        </span>
        <span className="rounded-full bg-pe-warning/10 px-2.5 py-1 font-semibold text-pe-warning">
          {counts.partial} partial
        </span>
        <span className="rounded-full bg-pe-surface px-2.5 py-1 font-semibold text-pe-text-muted">
          {counts.spec} spec
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <PhaseChip active={phaseFilter === 'all'} onClick={() => setPhaseFilter('all')} label="All" />
        {SCENARIO_PHASES.map(({ id, label }) => (
          <PhaseChip key={id} active={phaseFilter === id} onClick={() => setPhaseFilter(id)} label={label} />
        ))}
      </div>

      <div className="mt-8 space-y-8">
        {SCENARIO_PHASES.filter((p) => phaseFilter === 'all' || phaseFilter === p.id).map((phase) => {
          const items = filtered.filter((s) => s.phase === phase.id);
          if (items.length === 0) return null;
          return (
            <div key={phase.id}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">{phase.label}</h3>
              <div className="mt-4 space-y-6">
                {items.map((scenario) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PhaseChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
        active ? 'bg-pe-accent text-white' : 'bg-pe-surface text-pe-text-secondary hover:text-pe-text'
      }`}
    >
      {label}
    </button>
  );
}

function ScenarioCard({ scenario }) {
  return (
    <article className="overflow-hidden rounded-xl border border-pe-border bg-pe-canvas">
      <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
        <div className="border-b border-pe-border p-5 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-serif text-lg font-bold text-pe-text">{scenario.name}</h4>
            <StatusPill status={scenario.status} />
            <code className="rounded bg-pe-surface px-1.5 py-0.5 font-mono text-[11px] text-pe-text-muted">
              {scenario.id}
            </code>
          </div>

          <dl className="mt-4 space-y-3 text-[14px]">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">Preconditions</dt>
              <dd className="mt-1 leading-relaxed text-pe-text-secondary">{scenario.preconditions}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">User action</dt>
              <dd className="mt-1 leading-relaxed text-pe-text">{scenario.userAction}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-pe-text-muted">Expected result</dt>
              <dd className="mt-1 leading-relaxed text-pe-text-secondary">{scenario.expectedResult}</dd>
            </div>
          </dl>
        </div>

        <div className="flex items-center justify-center bg-pe-surface/50 p-5">
          <ScenarioScreenPreview screen={scenario.screen} />
        </div>
      </div>
    </article>
  );
}
