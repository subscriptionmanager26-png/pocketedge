import React from 'react';
import { Globe2, Target, Users } from 'lucide-react';
import GlobeHero from './GlobeHero';
import RequestInviteButton from '../RequestInviteButton';

export default function RedesignLandingHero() {
  return (
    <section className="pe-redesign-hero pe-redesign-hero--chrome relative min-h-[calc(100dvh-7rem)] bg-black overflow-hidden">
      <GlobeHero />

      <div className="pe-redesign-hero-ui">
        <main className="interactive-ui max-w-2xl mt-auto md:mt-20 z-10 pointer-events-none">
          <h1 className="pe-redesign-hero-title">
            Discover Global
            <br />
            Investment Portfolios.
          </h1>
          <div id="hero-invite" className="pointer-events-auto mt-8 md:mt-10">
            <RequestInviteButton size="large" variant="redesign" source="landing_hero" />
          </div>
        </main>

        <footer className="interactive-ui flex justify-between md:justify-start gap-2 md:gap-16 mt-auto pb-4 md:pb-8 w-full md:w-auto pr-4 md:pr-0">
          <div className="flex flex-col gap-2 md:gap-3">
            <Globe2 className="w-6 h-6 md:w-8 md:h-8 text-pe-text-muted" strokeWidth={1.25} />
            <span className="pe-redesign-feature-text">
              Global
              <br />
              Opportunities
            </span>
          </div>
          <div className="w-px h-10 md:h-16 bg-gray-800" />
          <div className="flex flex-col gap-2 md:gap-3">
            <Users className="w-6 h-6 md:w-8 md:h-8 text-pe-text-muted" strokeWidth={1.25} />
            <span className="pe-redesign-feature-text">
              Community
              <br />
              Portfolios
            </span>
          </div>
          <div className="w-px h-10 md:h-16 bg-gray-800" />
          <div className="flex flex-col gap-2 md:gap-3">
            <Target className="w-6 h-6 md:w-8 md:h-8 text-pe-text-muted" strokeWidth={1.25} />
            <span className="pe-redesign-feature-text">
              Smarter
              <br />
              Investing
            </span>
          </div>
        </footer>
      </div>
    </section>
  );
}
