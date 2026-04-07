import { useState, useMemo } from 'react';
import { SiteHeader } from '@empoweredvote/ev-ui';
import { MapPin, ArrowRight, Building2, Search, X } from 'lucide-react';
import type { Municipality } from '../types/budget';
import { getLoginUrl } from '../utils/auth';

export type LandingReason =
  | { type: 'guest' }                  // unauthenticated or Inform tier — full access, manual search
  | { type: 'no_location' }            // Connected but no address on file
  | { type: 'city_not_available'; cityName: string; state: string };

interface AlphaLandingProps {
  reason: LandingReason;
  municipalities: Municipality[];
  onNavigateToCity: (city: Municipality) => void;
}

// ── City search (city name only — zip lookup requires geocoding, coming later) ──
function CitySearch({
  municipalities,
  onNavigateToCity,
}: {
  municipalities: Municipality[];
  onNavigateToCity: (city: Municipality) => void;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return municipalities.filter(
      m =>
        m.available_datasets.length > 0 &&
        (m.name.toLowerCase().includes(q) || m.state.toLowerCase().includes(q))
    );
  }, [query, municipalities]);

  const noMatch = query.trim().length >= 2 && results.length === 0;

  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by city name or state…"
          className="w-full pl-10 pr-10 py-3 bg-white border border-[#E2EBEF] rounded-xl text-sm text-[#1C1C1C] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#005366] focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="mt-2 bg-white border border-[#E2EBEF] rounded-xl overflow-hidden shadow-sm">
          {results.map(city => {
            const years = [...new Set(city.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
            return (
              <button
                key={city.id}
                onClick={() => onNavigateToCity(city)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F7F8] border-b border-[#E2EBEF] last:border-0 transition-colors duration-150"
              >
                <Building2 size={14} className="text-[#005366] shrink-0" />
                <span className="flex-1 text-sm font-medium text-[#1C1C1C]">
                  {city.name}, {city.state}
                </span>
                <span className="text-xs text-[#9CA3AF]">{years[0]}</span>
                <ArrowRight size={13} className="text-[#9CA3AF] shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* No match — city not in Alpha yet */}
      {noMatch && (
        <div className="mt-2 bg-[#FFF8ED] border border-[#F5D98B] rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-[#92400E]">
            That city isn't in our Alpha yet.
          </p>
          <p className="text-sm text-[#6B7280] mt-0.5">
            We're expanding soon. In the meantime, explore Bloomington, Indiana to see the feature in action.
          </p>
        </div>
      )}

      <p className="text-xs text-[#9CA3AF] mt-2 pl-1">
        Zip code search coming soon — for now, search by city name.
      </p>
    </div>
  );
}

// ── Available city cards ──
function CityGrid({
  municipalities,
  onNavigateToCity,
}: {
  municipalities: Municipality[];
  onNavigateToCity: (city: Municipality) => void;
}) {
  const available = municipalities.filter(m => m.available_datasets.length > 0);

  if (available.length === 0) {
    return (
      <div className="bg-white border border-[#E2EBEF] rounded-xl p-6 text-center text-sm text-[#6B7280]">
        Loading communities…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {available.map(city => {
        const years = [...new Set(city.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
        const isPilot = city.name === 'Bloomington' && city.state === 'IN';
        return (
          <button
            key={city.id}
            onClick={() => onNavigateToCity(city)}
            className="flex items-center gap-3 bg-white border border-[#E2EBEF] rounded-xl p-4 text-left hover:border-[#005366] hover:shadow-sm transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#EAF4F7] flex items-center justify-center shrink-0 group-hover:bg-[#005366] transition-colors duration-200">
              <Building2 size={16} className="text-[#005366] group-hover:text-white transition-colors duration-200" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1C1C1C] truncate">
                {city.name}, {city.state}
                {isPilot && (
                  <span className="ml-2 text-xs font-normal text-[#005366] bg-[#EAF4F7] px-1.5 py-0.5 rounded">
                    Pilot
                  </span>
                )}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {years.length} fiscal year{years.length !== 1 ? 's' : ''} · {years[0]} most recent
              </p>
            </div>
            <ArrowRight size={14} className="text-[#9CA3AF] shrink-0 group-hover:text-[#005366] transition-colors duration-200" />
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ──
export default function AlphaLanding({ reason, municipalities, onNavigateToCity }: AlphaLandingProps) {
  const bloomington = municipalities.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? municipalities[0];

  return (
    <div className="min-h-screen bg-[#F7F7F8] font-manrope">
      <SiteHeader logoSrc={`${import.meta.env.BASE_URL}EVLogo.svg`} />

      {/* Hero */}
      <div className="bg-gradient-to-r from-[#005366] to-[#007A8C]">
        <div className="max-w-[900px] mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold uppercase tracking-wider mb-5">
            Alpha Program
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Your government's finances,<br className="hidden sm:block" /> made transparent
          </h1>
          <p className="mt-4 text-white/80 text-base max-w-xl mx-auto leading-relaxed">
            Treasury Tracker turns dense public budget documents into visual, plain-language
            summaries — so every citizen can understand how their tax dollars are spent.
          </p>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-12 space-y-10">

        {/* ── Guest: alpha notice + search + city list ── */}
        {reason.type === 'guest' && (
          <>
            {/* Alpha notice */}
            <div className="bg-[#EAF4F7] border border-[#B3D9E3] rounded-xl p-5">
              <p className="text-sm font-semibold text-[#005366]">
                Treasury Tracker is currently serving a limited number of Alpha communities.
              </p>
              <p className="text-sm text-[#6B7280] mt-1">
                Search below to see if your city is available, or browse our current communities.
                If your city isn't here yet, explore Bloomington to see the feature in action.
              </p>
            </div>

            {/* Available cities */}
            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] mb-3">Available communities</h2>
              <CityGrid municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
            </div>

            {/* Search */}
            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] mb-3">Find your city</h2>
              <CitySearch municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
            </div>

            {/* Gentle sign-in nudge — not a gate */}
            <div className="flex items-center gap-3 py-4 border-t border-[#E2EBEF]">
              <p className="text-sm text-[#6B7280] flex-1">
                Have an Empowered account? Sign in and Treasury Tracker will route you to your city automatically — no searching required.
              </p>
              <a
                href={getLoginUrl()}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 border border-[#005366] text-[#005366] text-sm font-medium rounded-lg hover:bg-[#EAF4F7] transition-colors duration-200"
              >
                Sign In
                <ArrowRight size={13} />
              </a>
            </div>
          </>
        )}

        {/* ── Connected, no address on file ── */}
        {reason.type === 'no_location' && (
          <>
            <div className="bg-[#EAF4F7] border border-[#B3D9E3] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#005366]">Set your location to see your city's budget</p>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  Treasury Tracker uses your stored address to route you automatically — no searching required on future visits.
                </p>
              </div>
              <a
                href="https://profile.empowered.vote/location"
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-[#005366] text-white text-sm font-medium rounded-lg hover:bg-[#004455] transition-colors duration-200"
              >
                Set Location
                <ArrowRight size={14} />
              </a>
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] mb-3">Or search for a city</h2>
              <CitySearch municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] mb-3">Available communities</h2>
              <CityGrid municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
            </div>
          </>
        )}

        {/* ── Connected, city not in treasury yet ── */}
        {reason.type === 'city_not_available' && (
          <>
            <div className="bg-[#FFF8ED] border border-[#F5D98B] rounded-xl p-5">
              <p className="text-sm font-semibold text-[#92400E]">
                We don't have {reason.cityName}, {reason.state} in Treasury Tracker yet.
              </p>
              <p className="text-sm text-[#6B7280] mt-1">
                We're actively expanding to more communities. In the meantime, explore Bloomington
                to see everything Treasury Tracker can do.
              </p>
            </div>

            {bloomington && (
              <div className="bg-white border border-[#E2EBEF] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin size={15} className="text-[#005366]" />
                    <p className="text-sm font-semibold text-[#1C1C1C]">See Treasury Tracker in action</p>
                  </div>
                  <p className="text-sm text-[#6B7280]">
                    Explore Bloomington, Indiana's full budget — drill into departments, compare years,
                    and trace spending down to individual transactions.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateToCity(bloomington)}
                  className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-[#FBBF24] text-[#1C1C1C] text-sm font-semibold rounded-lg hover:bg-[#F59E0B] transition-colors duration-200"
                >
                  Explore Bloomington
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] mb-3">Available communities</h2>
              <CityGrid municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
            </div>
          </>
        )}

        {/* How it works */}
        <div>
          <h2 className="text-base font-bold text-[#1C1C1C] mb-4">What you can do</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { heading: 'Visualize spending', body: 'Interactive charts break the budget into digestible slices you can drill into.' },
              { heading: 'Trace transactions', body: 'Drill down to the individual payment level and see exactly who was paid and when.' },
              { heading: 'Compare years', body: 'See how budgets and actual spending have changed year over year.' },
            ].map(item => (
              <div key={item.heading} className="bg-white border border-[#E2EBEF] rounded-xl p-5">
                <p className="text-sm font-semibold text-[#1C1C1C] mb-1">{item.heading}</p>
                <p className="text-sm text-[#6B7280] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
