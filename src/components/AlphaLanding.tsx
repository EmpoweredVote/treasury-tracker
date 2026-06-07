import { useState, useMemo, useRef } from 'react';
import { AppHeader } from './AppHeader';
import { MapPin, ArrowRight, Building2, Search, X } from 'lucide-react';
import type { Municipality } from '../types/budget';
import { getLoginUrl } from '../utils/auth';
import { useTheme } from '../hooks/useTheme';

export type LandingReason =
  | { type: 'guest' }
  | { type: 'no_location' }
  | { type: 'city_not_available'; cityName: string; state: string };

interface AlphaLandingProps {
  reason: LandingReason;
  municipalities: Municipality[];
  onNavigateToCity: (city: Municipality) => void;
  profileMenu?: { label: string; items: { label: string; onClick: () => void }[] };
}

const STEPS = [
  { n: '01', heading: 'Choose Your City', body: 'Browse our Alpha communities or search for yours.', active: true },
  { n: '02', heading: 'Explore the Budget', body: 'Interactive charts break revenue and spending into digestible slices.' },
  { n: '03', heading: 'Trace the Money', body: 'Drill down to individual payments and see exactly who was paid.' },
];

function readUserAddress(): { state: string; addr: string } | null {
  try {
    const match = document.cookie.split('; ').find(c => c.startsWith('evUserAddress='));
    if (!match) return null;
    const parsed = JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
    const TTL_MS = 30 * 24 * 60 * 60 * 1000;
    if (parsed?.ts && Date.now() - parsed.ts > TTL_MS) return null;
    if (!parsed?.state) return null;
    return { state: parsed.state, addr: parsed.addr ?? '' };
  } catch { return null; }
}

// ── City search ──
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
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ev-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by city name or state…"
          className="w-full pl-10 pr-10 py-3 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl text-sm text-[#1C1C1C] dark:text-ev-gray-200 placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#005366] focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ev-gray-400 hover:text-ev-gray-500"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-2 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl overflow-hidden shadow-sm dark:shadow-black/40">
          {results.map(city => {
            const years = [...new Set(city.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
            return (
              <button
                key={city.id}
                onClick={() => onNavigateToCity(city)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 border-b border-[#E2EBEF] dark:border-ev-gray-700 last:border-0 transition-colors duration-150"
              >
                <Building2 size={14} className="text-[#005366] shrink-0" />
                <span className="flex-1 text-sm font-medium text-[#1C1C1C] dark:text-ev-gray-200">
                  {city.name}, {city.state}
                </span>
                <span className="text-xs text-ev-gray-400">{years[0]}</span>
                <ArrowRight size={13} className="text-ev-gray-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {noMatch && (
        <div className="mt-2 bg-[#FFF8ED] dark:bg-ev-yellow-950/30 border border-[#F5D98B] dark:border-ev-yellow-700/50 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-[#92400E] dark:text-ev-yellow-300">That city isn't in our Alpha yet.</p>
          <p className="text-sm text-ev-gray-500 mt-0.5">
            We're expanding soon — check back for updates.
          </p>
        </div>
      )}

      <p className="text-xs text-ev-gray-500 mt-2 pl-1">Zip code search coming soon — for now, search by city name.</p>
    </div>
  );
}

const STATE_NAMES: Record<string, string> = {
  IN: 'Indiana',
  CA: 'California',
  TX: 'Texas',
  OR: 'Oregon',
};


// ── City cards ──
function CityGrid({
  municipalities,
  onNavigateToCity,
  preloadedCity,
}: {
  municipalities: Municipality[];
  onNavigateToCity: (city: Municipality) => void;
  preloadedCity?: Municipality | null;
}) {
  const available = municipalities.filter(m => m.available_datasets.length > 0);

  if (available.length === 0) {
    return (
      <div className="bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6 text-center text-sm text-ev-gray-500">
        Loading communities…
      </div>
    );
  }

  const userAddress = readUserAddress();
  // Exclude state entities from "Near you" — they aren't a local city
  const nearby = userAddress ? available.filter(m => m.entity_type !== 'state' && m.state === userAddress.state && m.id !== preloadedCity?.id) : [];
  const others = available.filter(m => m.id !== preloadedCity?.id && (!userAddress || m.state !== userAddress.state));

  const othersByState = new Map<string, Municipality[]>();
  for (const m of others) {
    if (!othersByState.has(m.state)) othersByState.set(m.state, []);
    othersByState.get(m.state)!.push(m);
  }
  // Within each state section, pin state entities to the top
  for (const [state, list] of othersByState) {
    othersByState.set(state, [
      ...list.filter(m => m.entity_type === 'state'),
      ...list.filter(m => m.entity_type !== 'state'),
    ]);
  }
  const otherStates = [...othersByState.keys()].sort();


  const renderCityButton = (city: Municipality) => {
    const years = [...new Set(city.available_datasets.map(d => d.fiscal_year))].sort((a, b) => b - a);
    const isPilot = city.name === 'Bloomington' && city.state === 'IN';
    const isState = city.entity_type === 'state';
    return (
      <button
        key={city.id}
        onClick={() => onNavigateToCity(city)}
        className="flex items-center gap-3 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-4 text-left hover:border-[#005366] dark:hover:border-ev-muted-blue hover:shadow-sm transition-all duration-200 group"
      >
        <div className="w-9 h-9 rounded-lg bg-[#EAF4F7] dark:bg-ev-teal-950 flex items-center justify-center shrink-0 group-hover:bg-[#005366] transition-colors duration-200">
          <Building2 size={16} className="text-[#005366] group-hover:text-white transition-colors duration-200" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1C1C1C] dark:text-ev-gray-100 truncate">
            {isState ? city.name : `${city.name}, ${city.state}`}
            {isState && (
              <span className="ml-2 text-xs font-normal text-[#005366] bg-[#EAF4F7] px-1.5 py-0.5 rounded">
                State Budget
              </span>
            )}
            {isPilot && (
              <span className="ml-2 text-xs font-normal text-[#005366] bg-[#EAF4F7] px-1.5 py-0.5 rounded">
                Pilot
              </span>
            )}
          </p>
          <p className="text-xs text-ev-gray-500 mt-0.5">
            {years.length} fiscal year{years.length !== 1 ? 's' : ''} · {years[0]} most recent
          </p>
        </div>
        <ArrowRight size={14} className="text-ev-gray-400 shrink-0 group-hover:text-[#005366] transition-colors duration-200" />
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {nearby.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 mb-2">
            Near you
            {userAddress?.addr && (
              <span className="ml-2 normal-case font-normal tracking-normal text-ev-gray-400">· {userAddress.addr}</span>
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nearby.map(renderCityButton)}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-5">
          {(nearby.length > 0 || preloadedCity) && (
            <p className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500">Other communities</p>
          )}
          {otherStates.map((state, i) => (
            <div key={state} className={i > 0 ? "pt-4 border-t border-[#E2EBEF] dark:border-ev-gray-700" : ""}>
              <p className="text-xs font-semibold uppercase tracking-wider text-ev-gray-600 dark:text-ev-gray-400 mb-2">
                {STATE_NAMES[state] || state}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {othersByState.get(state)!.map(renderCityButton)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export default function AlphaLanding({ reason, municipalities, onNavigateToCity, profileMenu }: AlphaLandingProps) {
  const cityPickerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  // Detect preloaded city from cookie address
  const userAddress = readUserAddress();
  const preloadedCity = useMemo((): Municipality | null => {
    if (!userAddress) return null;
    const available = municipalities.filter(m => m.available_datasets.length > 0);
    const addrLower = userAddress.addr.toLowerCase();
    const match = available.find(m =>
      m.state === userAddress.state &&
      addrLower.includes(m.name.toLowerCase())
    );
    return match ?? null;
  }, [municipalities, userAddress]);

  const darkHeaderStyle = isDark ? {
    backgroundColor: '#020618',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  } : undefined;

  const defaultProfileMenu = {
    label: 'Account',
    items: [{ label: 'Sign in', onClick: () => { window.location.href = getLoginUrl(); } }],
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-ev-gray-950 font-manrope">
      <AppHeader
        profileMenu={profileMenu ?? defaultProfileMenu}
        style={darkHeaderStyle}
        onNavigate={(href) => { window.location.href = href; }}
      />

      {/* ── Hero ── */}
      <section className="min-h-[calc(100vh-73px)] flex items-center bg-ev-teal-100 dark:bg-[#020618]">
        <div className="w-full px-12 sm:px-16 lg:px-24 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-16 lg:gap-24 items-center">

            {/* Left: headline + copy + CTA */}
            <div>
              <p className="text-ev-teal-600 dark:text-ev-skyblue-500 text-xs font-bold uppercase tracking-widest mb-5">
                Treasury Tracker
              </p>
              <h1 className="text-5xl sm:text-6xl font-bold leading-tight text-ev-gray-900 dark:text-white">
                See how your government<br />spends its money,
              </h1>
              <p className="text-5xl sm:text-6xl font-bold text-ev-teal-600 dark:text-ev-skyblue-500 leading-tight mt-1 mb-8">
                down to the last dollar.
              </p>
              <p className="text-ev-gray-500 dark:text-ev-gray-400 text-lg leading-relaxed mb-3">
                Dense budget documents, turned into plain-language visuals anyone can understand.
              </p>
              <p className="text-ev-gray-600 dark:text-[#D1D5DB] text-lg leading-relaxed mb-10">
                Our Alpha communities show exactly where we're headed: full transparency for every city, county, and district.
              </p>

              {preloadedCity ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => onNavigateToCity(preloadedCity)}
                    className="inline-flex items-center gap-2 bg-ev-yellow text-black font-bold px-8 py-4 rounded-xl hover:bg-ev-yellow-dark transition-colors text-lg"
                  >
                    <MapPin size={18} />
                    Go to {preloadedCity.name} →
                  </button>
                  <button
                    onClick={() => cityPickerRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-1 text-sm text-ev-gray-400 dark:text-ev-gray-400 hover:text-ev-gray-900 dark:hover:text-white transition-colors px-2"
                  >
                    Browse all cities
                  </button>
                </div>
              ) : (
                <div className="max-w-md">
                  <CitySearch municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
                </div>
              )}
            </div>

            {/* Right: step cards */}
            <div className="space-y-3">
              {STEPS.map(({ n, heading, body, active }) => (
                <div
                  key={n}
                  style={{
                    backgroundColor: isDark
                      ? (active ? '#1a2235' : '#0d1424')
                      : (active ? '#EAF4F7' : '#F5F9FA'),
                    borderColor: isDark
                      ? (active ? '#59B0C4' : 'rgba(255,255,255,0.1)')
                      : (active ? '#005366' : '#D3D7DE'),
                  }}
                  className="flex items-start gap-4 p-5 rounded-2xl border transition-colors"
                >
                  <div
                    style={{
                      backgroundColor: isDark
                        ? (active ? 'rgba(89,176,196,0.2)' : 'rgba(255,255,255,0.1)')
                        : (active ? 'rgba(0,83,102,0.12)' : 'rgba(0,0,0,0.06)'),
                      color: isDark
                        ? (active ? '#59B0C4' : '#6B7280')
                        : (active ? '#005366' : '#6B7280'),
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  >
                    {n}
                  </div>
                  <div>
                    <p
                      style={{ color: isDark
                        ? (active ? 'white' : '#9CA3AF')
                        : (active ? '#1C1C1C' : '#374151') }}
                      className="font-bold mb-1"
                    >
                      {heading}
                    </p>
                    <p
                      style={{ color: isDark
                        ? (active ? '#D1D5DB' : '#374151')
                        : (active ? '#6B7280' : '#535964') }}
                      className="text-sm leading-relaxed"
                    >
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── City picker ── */}
      <div ref={cityPickerRef} className="scroll-mt-4 max-w-[900px] mx-auto px-6 py-12 space-y-10">

        {/* Preloaded city — prominent card */}
        {preloadedCity && (
          <div className="bg-white dark:bg-ev-gray-800 border-2 border-[#005366] dark:border-ev-muted-blue rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={15} className="text-[#005366]" />
                <p className="text-sm font-bold text-[#1C1C1C] dark:text-ev-gray-100">Your City</p>
              </div>
              <p className="text-lg font-semibold text-[#005366] dark:text-ev-muted-blue">{preloadedCity.name}, {preloadedCity.state}</p>
              <p className="text-sm text-ev-gray-500 mt-0.5">Based on your saved address</p>
            </div>
            <button
              onClick={() => onNavigateToCity(preloadedCity)}
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-[#FED12E] text-[#1C1C1C] text-sm font-bold rounded-xl hover:bg-[#D0A301] transition-colors duration-200"
            >
              Explore Budget
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ── Guest ── */}
        {reason.type === 'guest' && (
          <>
            <div className="bg-[#EAF4F7] dark:bg-ev-teal-950/50 border border-[#B3D9E3] dark:border-ev-teal-800 rounded-xl p-5">
              <p className="text-sm font-semibold text-[#005366] dark:text-ev-muted-blue">
                Treasury Tracker is currently serving a limited number of Alpha communities.
              </p>
              <p className="text-sm text-ev-gray-500 mt-1">
                Search below to see if your city is available, or browse our current communities.
              </p>
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-3">Available communities</h2>
              <CityGrid municipalities={municipalities} onNavigateToCity={onNavigateToCity} preloadedCity={preloadedCity} />
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-3">Find your city</h2>
              <CitySearch municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
            </div>

            <div className="flex items-center gap-3 py-4 border-t border-[#E2EBEF] dark:border-ev-gray-700">
              <p className="text-sm text-ev-gray-500 flex-1">
                Have an Empowered account? Sign in and Treasury Tracker will route you to your city automatically.
              </p>
              <a
                href={getLoginUrl()}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 border border-[#005366] dark:border-ev-muted-blue text-[#005366] dark:text-ev-muted-blue text-sm font-medium rounded-lg hover:bg-[#EAF4F7] dark:hover:bg-ev-teal-950 transition-colors duration-200"
              >
                Sign In
                <ArrowRight size={13} />
              </a>
            </div>
          </>
        )}

        {/* ── Connected, no address ── */}
        {reason.type === 'no_location' && (
          <>
            <div className="bg-[#EAF4F7] dark:bg-ev-teal-950/50 border border-[#B3D9E3] dark:border-ev-teal-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#005366] dark:text-ev-muted-blue">Set your location to see your city's budget</p>
                <p className="text-sm text-ev-gray-500 mt-0.5">
                  Treasury Tracker uses your stored address to route you automatically on future visits.
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
              <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-3">Or search for a city</h2>
              <CitySearch municipalities={municipalities} onNavigateToCity={onNavigateToCity} />
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-3">Available communities</h2>
              <CityGrid municipalities={municipalities} onNavigateToCity={onNavigateToCity} preloadedCity={preloadedCity} />
            </div>
          </>
        )}

        {/* ── Connected, city not in treasury yet ── */}
        {reason.type === 'city_not_available' && (
          <>
            <div className="bg-[#FFF8ED] dark:bg-ev-yellow-950/30 border border-[#F5D98B] dark:border-ev-yellow-700/50 rounded-xl p-5">
              <p className="text-sm font-semibold text-[#92400E] dark:text-ev-yellow-300">
                We don't have {reason.cityName}, {reason.state} in Treasury Tracker yet.
              </p>
              <p className="text-sm text-ev-gray-500 mt-1">
                We're actively expanding — check back for updates.
              </p>
            </div>

            <div>
              <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-3">Available communities</h2>
              <CityGrid municipalities={municipalities} onNavigateToCity={onNavigateToCity} preloadedCity={null} />
            </div>
          </>
        )}

        {/* What you can do */}
        <div>
          <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">What you can do</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { heading: 'Visualize spending', body: 'Interactive charts break the budget into digestible slices you can drill into.' },
              { heading: 'Trace transactions', body: 'Drill down to the individual payment level — see exactly who was paid and when.' },
              { heading: 'Compare years', body: 'See how budgets and actual spending have changed year over year.' },
            ].map(item => (
              <div key={item.heading} className="bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-5">
                <p className="text-sm font-semibold text-[#1C1C1C] dark:text-ev-gray-100 mb-1">{item.heading}</p>
                <p className="text-sm text-ev-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
