import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ExternalLink, ChevronRight, Lightbulb } from 'lucide-react';
import type { SearchResult } from '../../types/budget';
import { searchBudget } from '../../data/dataLoader';

interface BudgetSearchProps {
  cityId?: string;
  cityName: string;
  fiscalYear: number;
  /** Called when user clicks a result — parent can drill down to that category */
  onResultClick?: (result: SearchResult) => void;
}

const DATASET_LABELS: Record<string, string> = {
  operating: 'Spending',
  revenue: 'Revenue',
  salaries: 'Payroll',
};

const DATASET_COLORS: Record<string, string> = {
  operating: 'bg-ev-teal-100 text-ev-teal-800',
  revenue: 'bg-ev-yellow-100 text-ev-yellow-800',
  salaries: 'bg-ev-coral-100 text-ev-coral-800',
};

const EXAMPLE_QUERIES = [
  'roads',
  'police',
  'parks',
  'fire department',
  'debt',
];

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const BudgetSearch: React.FC<BudgetSearchProps> = ({
  cityId,
  cityName,
  fiscalYear,
  onResultClick,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setHasSearched(true);
      const data = await searchBudget(q.trim(), cityId, fiscalYear, 20);
      setResults(data);
      setLoading(false);
    },
    [cityId, fiscalYear]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    inputRef.current?.focus();
  };

  // Aggregate total from results
  const totalAmount = results.reduce((sum, r) => sum + r.amount, 0);
  const datasetBreakdown = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.datasetType] = (acc[r.datasetType] ?? 0) + r.amount;
    return acc;
  }, {});

  const isOpen = focused || query.length >= 2;

  return (
    <div className="relative">
      {/* Search input */}
      <div
        className={`relative flex items-center transition-shadow duration-200 ${
          isOpen
            ? 'ring-2 ring-ev-muted-blue ring-offset-0 rounded-lg shadow-md'
            : 'rounded-lg'
        }`}
      >
        <div className="absolute left-4 text-ev-gray-400 pointer-events-none flex items-center">
          {loading ? (
            <div className="w-4 h-4 border-2 border-ev-gray-300 border-t-ev-muted-blue rounded-full animate-spin" />
          ) : (
            <Search size={16} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={`Ask about ${cityName}'s budget — try "roads" or "police"`}
          aria-label={`Search ${cityName} budget categories`}
          className="w-full h-[42px] pl-10 pr-10 bg-white border border-ev-gray-200 rounded-lg text-sm font-manrope focus:outline-none placeholder:text-ev-gray-400 text-ev-gray-900"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 p-1 text-ev-gray-400 hover:text-ev-gray-600 cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Results panel */}
      {isOpen && (
        <div className="mt-2 bg-white border border-ev-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Aggregate summary bar */}
          {!loading && results.length > 1 && (
            <div className="px-4 py-2.5 bg-ev-gray-050 border-b border-ev-gray-100 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-xs text-ev-gray-600">
                <strong className="text-ev-gray-800">{results.length} categories</strong>
                {' '}matching "{query}" in {cityName} {fiscalYear}
              </span>
              <span className="text-xs font-semibold text-ev-gray-700">
                Total: {formatAmount(totalAmount)}
              </span>
            </div>
          )}

          {/* Results list */}
          {!loading && results.length > 0 && (
            <ul role="listbox" className="divide-y divide-ev-gray-100 max-h-[420px] overflow-y-auto">
              {results.map((result) => (
                <li key={result.categoryId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => onResultClick?.(result)}
                    className="w-full text-left px-4 py-3.5 hover:bg-ev-gray-050 transition-colors duration-100 focus:outline-none focus-visible:bg-ev-gray-050 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Plain name + dataset badge */}
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold text-ev-gray-900 group-hover:text-ev-teal-700 transition-colors">
                            {result.plainName || result.categoryName}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              DATASET_COLORS[result.datasetType] ?? 'bg-ev-gray-100 text-ev-gray-600'
                            }`}
                          >
                            {DATASET_LABELS[result.datasetType] ?? result.datasetType}
                          </span>
                          {result.source === 'official' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ev-yellow-100 text-ev-yellow-800 uppercase tracking-wide flex items-center gap-0.5">
                              <ExternalLink size={9} />
                              Official
                            </span>
                          )}
                        </div>

                        {/* Short description */}
                        {result.shortDescription && (
                          <p className="text-xs text-ev-gray-500 line-clamp-2 leading-relaxed">
                            {result.shortDescription}
                          </p>
                        )}

                        {/* Tags */}
                        {result.tags && result.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {result.tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 bg-ev-gray-100 text-ev-gray-500 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Amount + chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-ev-gray-800">
                            {formatAmount(result.amount)}
                          </div>
                          {result.percentage > 0 && (
                            <div className="text-[10px] text-ev-gray-400 tabular-nums">
                              {result.percentage.toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-ev-gray-300 group-hover:text-ev-teal-500 transition-colors flex-shrink-0"
                        />
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Dataset breakdown (when multiple datasets) */}
          {!loading && results.length > 1 && Object.keys(datasetBreakdown).length > 1 && (
            <div className="px-4 py-2.5 bg-ev-gray-050 border-t border-ev-gray-100 flex items-center gap-4 flex-wrap">
              {Object.entries(datasetBreakdown).map(([type, amount]) => (
                <span key={type} className="text-[11px] text-ev-gray-500">
                  <span className="font-medium text-ev-gray-700">{DATASET_LABELS[type] ?? type}:</span>{' '}
                  {formatAmount(amount)}
                </span>
              ))}
            </div>
          )}

          {/* No results */}
          {!loading && hasSearched && results.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-ev-gray-500 mb-1">
                No results for <strong className="text-ev-gray-700">"{query}"</strong>
              </p>
              <p className="text-xs text-ev-gray-400">
                Try simpler keywords — "fire", "roads", "parks"
              </p>
            </div>
          )}

          {/* Idle state — example queries */}
          {!hasSearched && !loading && query.length < 2 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-ev-gray-400 mb-2">
                <Lightbulb size={12} />
                <span>Try searching for</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="text-xs px-2.5 py-1 bg-ev-gray-100 hover:bg-ev-teal-050 hover:text-ev-teal-700 text-ev-gray-600 rounded-full border border-transparent hover:border-ev-teal-200 transition-colors cursor-pointer"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BudgetSearch;
