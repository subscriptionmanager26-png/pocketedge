import { ArrowLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const ROWS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'accounts', label: 'Connected accounts' },
  { id: 'disclosure', label: 'Disclosure policy' },
  { id: 'legal', label: 'Terms & privacy' },
];

export default function SettingsPage({ onBack, onLogout }) {
  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </PageHeader>

      <div className="border-b border-pe-border px-4 py-5">
        <h1 className="font-serif text-2xl font-bold text-pe-text">Settings</h1>
      </div>

      <div className="divide-y divide-pe-border">
        {ROWS.map((row) => (
          <button
            key={row.id}
            type="button"
            className="flex w-full items-center justify-between px-4 py-4 text-left text-[15px] text-pe-text hover:bg-pe-surface/80"
          >
            {row.label}
            <ChevronRight className="h-4 w-4 text-pe-text-muted" />
          </button>
        ))}
      </div>

      <div className="border-t border-pe-border px-4 py-8">
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-md border border-pe-negative/30 bg-pe-negative/5 py-3 text-[15px] font-bold text-pe-negative hover:bg-pe-negative/10"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
