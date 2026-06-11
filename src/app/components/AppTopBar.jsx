import React from 'react';
import { Lock } from 'lucide-react';
import SiteHeader from '../../components/SiteHeader';
import { navigateApp } from '../appRoute';
import NotificationBell from './NotificationBell';

const tabs = [
  { id: 'dashboard', label: 'Home' },
  { id: 'search', label: 'Search', waitlistLocked: true },
  { id: 'leaderboard', label: 'Challenge' },
  { id: 'create', label: 'Create' },
  { id: 'account', label: 'Account' },
];

export default function AppTopBar({ activeTab, onNavigate, accessLimited = false }) {
  const goHome = () => {
    navigateApp({ tab: 'dashboard' });
    onNavigate('dashboard');
  };

  return (
    <SiteHeader onLogoClick={goHome} embedded sticky={false}>
      <NotificationBell />
      <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
        {tabs.map(({ id, label, waitlistLocked }) => {
          const active = activeTab === id;
          const locked = accessLimited && waitlistLocked;
          const displayLabel = id === 'dashboard' && !accessLimited ? 'Dashboard' : label;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`inline-flex items-center gap-1.5 text-base transition-colors whitespace-nowrap ${
                active
                  ? 'font-semibold text-neutral-900'
                  : 'font-normal text-neutral-600 hover:text-neutral-900'
              } ${locked ? 'text-neutral-500' : ''}`}
            >
              {displayLabel}
              {locked && <Lock className="w-3.5 h-3.5" aria-label="Waitlist required" />}
            </button>
          );
        })}
      </nav>
    </SiteHeader>
  );
}
