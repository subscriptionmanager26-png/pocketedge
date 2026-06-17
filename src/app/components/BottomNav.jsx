import React from 'react';
import { LayoutDashboard, Search, PlusCircle, User, Trophy, Lock } from 'lucide-react';
import { edgeX } from '../../designTokens';
import { CAMPAIGN_UI_ENABLED } from '../../campaignFlags';

const tabs = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'search', label: 'Discover', icon: Search, waitlistLocked: true },
  { id: 'leaderboard', label: 'Challenge', icon: Trophy, campaignOnly: true },
  { id: 'create', label: 'Create', icon: PlusCircle },
  { id: 'account', label: 'Account', icon: User },
].filter((tab) => CAMPAIGN_UI_ENABLED || !tab.campaignOnly);

export default function BottomNav({ activeTab, onNavigate, accessLimited = false }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 w-full bg-[#F7F7F5]/95 backdrop-blur-xl border-t border-neutral-200/60 safe-area-pb">
      <div className={`flex items-center justify-around h-16 ${edgeX}`}>
        {tabs.map(({ id, label, icon: Icon, waitlistLocked }) => {
          const active = activeTab === id;
          const locked = accessLimited && waitlistLocked;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${
                active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <span className="relative">
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : ''}`} />
                {locked && (
                  <Lock
                    className="absolute -right-1.5 -top-1 w-2.5 h-2.5 text-neutral-500"
                    aria-hidden
                  />
                )}
              </span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
