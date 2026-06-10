import React from 'react';
import SiteHeader from '../../components/SiteHeader';
import { navigateApp } from '../appRoute';
import NotificationBell from './NotificationBell';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'search', label: 'Search' },
  { id: 'leaderboard', label: 'Challenge' },
  { id: 'create', label: 'Create' },
  { id: 'account', label: 'Account' },
];

export default function AppTopBar({ activeTab, onNavigate }) {
  const goHome = () => {
    navigateApp({ tab: 'dashboard' });
    onNavigate('dashboard');
  };

  return (
    <SiteHeader onLogoClick={goHome} embedded sticky={false}>
      <NotificationBell />
      <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
        {tabs.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`text-base transition-colors whitespace-nowrap ${
                active
                  ? 'font-semibold text-neutral-900'
                  : 'font-normal text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </SiteHeader>
  );
}
