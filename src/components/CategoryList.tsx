import React from 'react';
import type { BudgetCategory } from '../types/budget';
import {
  Shield,
  Flame,
  Hammer,
  GraduationCap,
  Heart,
  Building2,
  BookOpen,
  Palette,
  Briefcase,
  Users,
  Building,
  Landmark,
  Recycle,
  Trash2,
  Zap,
  TrendingUp,
  Navigation,
  ChevronRight,
} from 'lucide-react';
import { DATA_VIZ_HUES } from '../utils/chartColors';

interface CategoryListProps {
  categories: BudgetCategory[];
  onCategoryClick: (category: BudgetCategory) => void;
  isPastYear?: boolean;
}

// Icon mapping for budget categories
const categoryIcons: { [key: string]: React.ElementType } = {
  // Top-level categories from budgetConfig
  'Community': Users,
  'Capital Outlays': Building,
  'Urban Redevelopment': Landmark,
  'Debt Service': Recycle,
  'Sanitation': Trash2,
  'Culture and Recreation': Palette,
  'General Government': Briefcase,
  'Public Safety': Shield,
  'Utilities': Zap,
  'Sustainable & Economic': TrendingUp,
  'Highway and Streets': Navigation,

  // Common subcategory patterns
  'Police': Shield,
  'Fire': Flame,
  'Public Works': Hammer,
  'Education': GraduationCap,
  'Health': Heart,
  'Administration': Building2,
  'Library': BookOpen,
  'Recreation': Palette,
  'Technology': Zap,
};

const getCategoryIcon = (categoryName: string): React.ElementType => {
  if (categoryIcons[categoryName]) {
    return categoryIcons[categoryName];
  }
  const lowerName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (lowerName.includes(key.toLowerCase())) {
      return icon;
    }
  }
  return Building2;
};

// Brand logos — full-bleed tile bg + distinct bar color per brand
// bg: tile background (chosen for logo visibility)
// barColor: bright brand color for the percentage bar (never dark/black)
const base = import.meta.env.BASE_URL;
const CATEGORY_LOGOS: Record<string, { src: string; bg: string; barColor: string }> = {
  // Revenue sources
  'Patreon':                                 { src: `${base}logos/patreon-logo.png`,     bg: '#FF424D', barColor: '#FF424D' },
  'Give Butter':                             { src: `${base}logos/givebutter-logo.png`,  bg: '#19C037', barColor: '#19C037' },
  'Benevity':                                { src: `${base}logos/benevity-logo.svg`,    bg: '#009DD1', barColor: '#009DD1' },
  // Software & Tools
  'Anthropic (Claude)':                      { src: `${base}logos/anthropic-logo.svg`,   bg: '#191919', barColor: '#D97757' }, // copper from logo
  'OpenAI (ChatGPT)':                        { src: `${base}logos/chatgpt-logo.png`,     bg: '#10A37F', barColor: '#10A37F' },
  'Figma':                                   { src: `${base}logos/figma-logo.png`,       bg: '#1E1E1E', barColor: '#1ABCFE' }, // Figma sky blue
  'Read.AI':                                 { src: `${base}logos/readai-logo.png`,      bg: '#6C47FF', barColor: '#6C47FF' },
  'MindMeister':                             { src: `${base}logos/mindmeister-logo.png`, bg: '#E74C3C', barColor: '#E74C3C' },
  'AWS':                                     { src: `${base}logos/aws-logo.png`,         bg: '#232F3E', barColor: '#FF9900' }, // AWS orange
  'GoDaddy':                                 { src: `${base}logos/godaddy-logo.png`,     bg: '#00A4A6', barColor: '#00A4A6' },
  'TechSoup (AWS Credits)':                  { src: `${base}logos/techsoup-logo.jpg`,    bg: '#0082C9', barColor: '#0082C9' },
  'Supabase':                                { src: `${base}logos/supabase-logo.svg`,    bg: '#1C1C1C', barColor: '#3FCF8E' }, // Supabase green
  'Render.com':                              { src: `${base}logos/render-logo.png`,      bg: '#5E44FF', barColor: '#46E3B7' }, // Render teal
  // Platform Fees
  'Benevity Processing Fee':                 { src: `${base}logos/benevity-logo.svg`,    bg: '#009DD1', barColor: '#009DD1' },
  'Givebutter Fees':                         { src: `${base}logos/givebutter-logo.png`,  bg: '#19C037', barColor: '#19C037' },
  'Patreon Fees (Processing + Patreon fee)': { src: `${base}logos/patreon-logo.png`,     bg: '#FF424D', barColor: '#FF424D' },
  'Patreon Fees (adjustment)':               { src: `${base}logos/patreon-logo.png`,     bg: '#FF424D', barColor: '#FF424D' },
};

const CategoryList: React.FC<CategoryListProps> = ({ categories, onCategoryClick, isPastYear = false }) => {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return (Math.round(percentage * 10) / 10).toFixed(1);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((category, index) => {
        const IconComponent = getCategoryIcon(category.name);
        const logo = CATEGORY_LOGOS[category.name];
        const hasSubcategories = category.subcategories && category.subcategories.length > 0;
        const hue = DATA_VIZ_HUES[index % DATA_VIZ_HUES.length];

        return (
          <button
            key={`${category.name}-${index}`}
            className="relative bg-white border border-[#E2EBEF] rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-[#D3D7DE] text-left w-full overflow-hidden"
            onClick={() => onCategoryClick(category)}
            aria-label={`${category.name}, ${formatCurrency(category.amount)}, ${formatPercentage(category.percentage)}%${hasSubcategories ? ', tap to explore' : ''}`}
          >
            {/* Background bar showing percentage */}
            <div
              className="absolute inset-y-0 left-0 opacity-[0.07]"
              style={{
                width: `${category.percentage}%`,
                backgroundColor: logo ? logo.barColor : `var(--color-data-${hue}-500)`,
              }}
            />

            {/* Content layer */}
            <div className="relative flex items-start gap-3">
              {/* Icon or brand logo */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: logo ? logo.bg : `var(--color-data-${hue}-500)` }}
              >
                {logo
                  ? <img src={logo.src} alt={category.name} className="w-full h-full object-contain" />
                  : <IconComponent size={20} color="white" />}
              </div>

              {/* Category info */}
              <div className="flex-1 min-w-0">
                {/* Plain name (enriched) or raw name */}
                <div className="text-sm font-bold font-manrope text-[#1C1C1C] truncate">
                  {category.enrichment?.plainName || category.name}
                </div>
                {/* Raw name as subtitle if enriched and different */}
                {category.enrichment?.plainName && category.enrichment.plainName !== category.name && (
                  <div className="text-[10px] text-ev-gray-400 truncate -mt-0.5 mb-0.5">
                    {category.name}
                  </div>
                )}
                {/* Amount + percentage */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-medium tabular-nums text-[#1C1C1C]">
                    {formatCurrency(isPastYear && category.actualAmount != null ? category.actualAmount : category.amount)}
                  </span>
                  <span className="text-[#D3D7DE]">•</span>
                  <span className="text-xs text-[#6B7280] tabular-nums">{formatPercentage(category.percentage)}%</span>

                </div>
                {/* Short description from enrichment */}
                {category.enrichment?.shortDescription && (
                  <p className="text-[11px] text-ev-gray-500 leading-snug mt-1 line-clamp-2">
                    {category.enrichment.shortDescription}
                  </p>
                )}
              </div>

              {/* Arrow indicator for drilldown */}
              {hasSubcategories && (
                <ChevronRight size={20} className="text-[#6B7280] flex-shrink-0 self-center" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryList;
