import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { disclosuresPath } from '../lib/routes';

const ROWS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'accounts', label: 'Connected accounts' },
  {
    id: 'disclosure',
    label: 'Disclosure policy',
    href: disclosuresPath(),
  },
  {
    id: 'legal',
    label: 'Terms & privacy',
    href: disclosuresPath('privacy'),
  },
];

export default function SettingsPage({ onLogout }) {
  return (
    <div className="px-4 pb-10 pt-4 md:px-6">
      <h1 className="text-[22px] font-semibold tracking-tight text-pe-text">Settings</h1>
      <p className="mt-1 text-[14px] text-pe-text-muted">Preferences and account</p>

      <div className="fv-card mt-5 overflow-hidden rounded-[20px] shadow-[var(--fv-shadow)]">
        {ROWS.map((row, index) => {
          const rowClass =
            'flex w-full items-center justify-between px-4 py-4 text-left text-[15px] text-pe-text transition hover:bg-black/[0.03]';
          const divider = index > 0 ? 'border-t border-[var(--fv-border,#ececec)]' : '';
          if (row.href) {
            return (
              <Link key={row.id} to={row.href} className={`${rowClass} ${divider}`}>
                {row.label}
                <ChevronRight className="h-4 w-4 text-pe-text-muted" />
              </Link>
            );
          }
          return (
            <button key={row.id} type="button" className={`${rowClass} ${divider}`}>
              {row.label}
              <ChevronRight className="h-4 w-4 text-pe-text-muted" />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mt-6 w-full rounded-[14px] bg-pe-negative/8 py-3 text-[15px] font-semibold text-pe-negative transition hover:bg-pe-negative/12"
      >
        Log out
      </button>
    </div>
  );
}
