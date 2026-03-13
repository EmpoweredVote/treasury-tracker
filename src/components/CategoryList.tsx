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
  ChevronRight
} from 'lucide-react';

interface CategoryListProps {
  categories: BudgetCategory[];
  onCategoryClick: (category: BudgetCategory) => void;
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
  // Try exact match first
  if (categoryIcons[categoryName]) {
    return categoryIcons[categoryName];
  }
  
  // Try partial match
  const lowerName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (lowerName.includes(key.toLowerCase())) {
      return icon;
    }
  }
  
  // Default icon
  return Building2;
};

const CategoryList: React.FC<CategoryListProps> = ({ categories, onCategoryClick }) => {
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
    <div className="category-list">
      {categories.map((category, index) => {
        const IconComponent = getCategoryIcon(category.name);
        const hasSubcategories = category.subcategories && category.subcategories.length > 0;
        
        return (
          <button
            key={`${category.name}-${index}`}
            className="category-list-item"
            onClick={() => onCategoryClick(category)}
            aria-label={`${category.name}, ${formatCurrency(category.amount)}, ${formatPercentage(category.percentage)}%${hasSubcategories ? ', tap to explore' : ''}`}
          >
            {/* Background bar filling the button */}
            <div 
              className="category-background-bar"
              style={{
                width: `${category.percentage}%`,
                backgroundColor: category.color,
              }}
            />
            
            {/* Content layer */}
            <div className="category-item-content">
              {/* Icon */}
              <div 
                className="category-icon"
                style={{ backgroundColor: category.color }}
              >
                <IconComponent size={24} color="white" />
              </div>
              
              {/* Category info */}
              <div className="category-info">
                <div className="category-name">{category.name}</div>
                <div className="category-stats">
                  <span className="category-amount">{formatCurrency(category.amount)}</span>
                  <span className="category-separator">•</span>
                  <span className="category-percentage">{formatPercentage(category.percentage)}%</span>
                </div>
              </div>
              
              {/* Arrow indicator */}
              {hasSubcategories && (
                <ChevronRight className="category-arrow" size={24} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryList;
