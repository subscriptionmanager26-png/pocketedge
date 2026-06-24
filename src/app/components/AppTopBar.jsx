import React from 'react';
import SiteHeader from '../../components/SiteHeader';
import { navigateApp } from '../appRoute';
import NotificationBell from './NotificationBell';
import { CAMPAIGN_UI_ENABLED } from '../../campaignFlags';

const tabs = [
  { id: 'dashboard', label: 'Home' },
  { id: 'search', label: 'Discover' },
  { id: 'leaderboard', label: 'Challenge', campaignOnly: true },
  { id: 'create', label: 'Create' },
  { id: 'account', label: 'Account' },
].filter((tab) => CAMPAIGN_UI_ENABLED || !tab.campaignOnly);

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
          const displayLabel = id === 'dashboard' ? 'Dashboard' : label;

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
              {displayLabel}
            </button>
          );
        })}
      </nav>
    </SiteHeader>
  );
}
