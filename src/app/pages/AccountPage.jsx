import React from 'react';
import { LogOut } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { signOut } from '../../supabase';
import AboutYouSection from '../components/AboutYouSection';
import AppPageLayout from '../components/AppPageLayout';

export default function AccountPage({ user, userId = 'local', onProfileSaved }) {
  const handleSignOut = async () => {
    await signOut();
    const url = new URL(window.location.href);
    url.search = '';
    window.location.href = url.pathname;
  };

  return (
    <AppPageLayout narrow>
      <PageHeader eyebrow="Profile" title="Account" align="left" className="!mb-0" />

      <AboutYouSection user={user} userId={userId} onSaved={onProfileSaved} />

      <button
        type="button"
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-pe-border/80 text-pe-text-secondary hover:text-pe-text hover:border-neutral-300 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </AppPageLayout>
  );
}
