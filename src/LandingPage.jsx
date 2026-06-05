import React, { useState } from 'react';
import { Briefcase, ArrowRight, ChevronRight, Check } from 'lucide-react';
import {
  trendingBaskets,
  heroStats,
  platformStats,
  countries,
  featuredBaskets,
  howItWorks,
} from './mockData';
import { joinWaitlist } from './supabase';

function InviteForm({ className = '', id }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setMessage('');

    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      const result = await joinWaitlist(email, ref);
      setStatus(result?.status === 'already_joined' ? 'already' : 'success');
      setMessage(
        result?.status === 'already_joined'
          ? "You're already on the waitlist!"
          : "You're on the list! We'll be in touch."
      );
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className={className}>
      <form id={id} onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-xl">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          disabled={status === 'loading'}
          onChange={(e) => setEmail(e.target.value)}
          className="flex w-full border px-3 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm flex-1 h-14 text-base bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-500/50 rounded-xl"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-50 py-2 h-14 px-8 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
        >
          {status === 'loading' ? 'Joining...' : 'Request Invite'}
          {status !== 'loading' && <ArrowRight className="ml-2 w-5 h-5" />}
        </button>
      </form>
      {message && (
        <p
          className={`mt-3 text-sm flex items-center gap-2 ${
            status === 'error' ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {status !== 'error' && <Check className="w-4 h-4" />}
          {message}
        </p>
      )}
    </div>
  );
}

export default function LandingPage() {
  const scrollToInvite = () => {
    document.getElementById('hero-invite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.querySelector('#hero-invite input')?.focus(), 400);
  };
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="fixed top-0 w-full bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Briefcase className="w-5 h-5 text-black" />
              </div>
              <span className="text-2xl font-bold text-white">PocketEdge</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#baskets" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                Baskets
              </a>
              <a href="#countries" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                Countries
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                How it Works
              </a>
              <button
                onClick={scrollToInvite}
                className="bg-emerald-500 text-black px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-400 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Request Invite
              </button>
            </nav>
          </div>
        </div>
      </header>

      <section className="relative pt-32 pb-20 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-emerald-500/30 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-emerald-400">Now accepting early access requests</span>
              </div>
              <h1 className="text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  A place for hot investment ideas
                </span>
              </h1>
              <p className="text-xl text-zinc-400 leading-relaxed font-light">
                Access investment portfolio made by practitioners and follow them as easily
              </p>
              <InviteForm id="hero-invite" />
              <div className="flex items-center gap-8 pt-4">
                {heroStats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-zinc-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
              <div className="relative bg-[#111111] rounded-2xl shadow-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Trending Baskets</h3>
                </div>
                <div className="space-y-4">
                  {trendingBaskets.map((basket) => (
                    <div
                      key={basket.name}
                      className="group p-5 bg-white/5 rounded-xl border border-white/5 hover:border-emerald-500/30 hover:bg-[#151515] transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                            {basket.name}
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {basket.assets.map((asset) => (
                              <span
                                key={asset}
                                className="text-xs px-2 py-0.5 bg-white/5 border border-white/10 rounded text-zinc-400"
                              >
                                {asset}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-emerald-400 font-bold text-lg">{basket.return}</div>
                          <div className="text-xs text-zinc-500">30D</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 lg:px-8 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 gap-8 mb-12">
            {platformStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-zinc-500 font-light">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="countries" className="py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-4xl font-bold text-white tracking-tight">Invest Across 10 Countries</h2>
            <p className="text-xl text-zinc-400 font-light">
              Access global markets with 9 currencies and 15,000+ stocks &amp; ETFs
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {countries.map((country) => (
              <div
                key={country.name}
                className="bg-[#111111] border border-white/5 rounded-xl p-6 hover:border-emerald-500/30 transition-all text-center"
              >
                <div className="text-5xl mb-3">{country.flag}</div>
                <div className="text-sm font-medium text-white">{country.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="baskets" className="py-24 px-6 lg:px-8 bg-[#111111]/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-5xl font-bold text-white tracking-tight">Featured Investment Baskets</h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light">
              Explore curated portfolios designed by experts and top community investors
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {featuredBaskets.map((basket) => (
              <div
                key={basket.name}
                className="group bg-[#111111] border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                      {basket.name}
                    </h3>
                    <p className="text-sm text-zinc-500 font-light">{basket.description}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-emerald-400">{basket.return}</div>
                    <div className="text-xs text-zinc-500">30D</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {basket.assets.map((asset) => (
                    <span
                      key={asset}
                      className="text-xs px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-zinc-400 font-medium"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/5">
                  <span className="text-sm font-medium text-white">Min: {basket.minInvestment}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-5xl font-bold text-white tracking-tight">Start Investing in 3 Simple Steps</h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light">
              Get started with global investing in minutes
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {howItWorks.map((step, index) => (
              <div key={step.step} className="relative">
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-14 left-1/2 w-full h-px bg-white/10">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      <ChevronRight className="w-4 h-4 text-emerald-500/50" />
                    </div>
                  </div>
                )}
                <div className="relative bg-[#111111] rounded-2xl p-8 border border-white/5 hover:border-emerald-500/30 transition-all">
                  <div className="w-12 h-12 bg-gradient-to-tr from-emerald-500 to-emerald-400 text-black rounded-xl flex items-center justify-center text-xl font-bold mb-4 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    {step.step}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-zinc-400 text-sm font-light leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10" />
        <div className="absolute inset-0 bg-[#0A0A0A]/50 backdrop-blur-sm" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-5xl font-bold text-white mb-6 tracking-tight">
            Ready to Start Your Global Investment Journey?
          </h2>
          <p className="text-xl text-zinc-300 mb-10 font-light">
            Join thousands of Indians already investing in international markets. Request your invite today.
          </p>
          <InviteForm id="bottom-invite" className="mx-auto [&_form]:mx-auto [&_button]:px-10" />
        </div>
      </section>

      <footer className="border-t border-white/5 py-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-black" />
                </div>
                <span className="text-xl font-bold text-white">PocketEdge</span>
              </div>
              <p className="text-sm text-zinc-500 font-light leading-relaxed">
                Empowering Indian investors to access global markets with ease and confidence.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                {['Investment Baskets', 'Community Strategies', 'Analytics', 'Pricing'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-zinc-500 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                {['About Us', 'Blog', 'Careers', 'Contact'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-zinc-500 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                {['Privacy Policy', 'Terms of Service', 'Risk Disclosure', 'Compliance'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-zinc-500 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-zinc-500">© 2025 PocketEdge. All rights reserved.</p>
            <p className="text-xs mt-4 md:mt-0 text-zinc-600 font-light">
              Disclaimer: Investing in international markets involves risk. Past performance does not guarantee future
              results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
