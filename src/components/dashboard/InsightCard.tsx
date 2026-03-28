import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface InsightCardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'flat';
    value: string;
    label: string;
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'highlight';
}

const InsightCard: React.FC<InsightCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon,
  variant = 'default',
}) => {
  const trendColor = trend?.direction === 'up'
    ? 'text-[#059669]'
    : trend?.direction === 'down'
    ? 'text-[#E61B00]'
    : 'text-ev-gray-500';

  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
    ? TrendingDown
    : Minus;

  return (
    <div
      className={`
        relative bg-white rounded-xl p-5
        border border-ev-gray-200
        transition-all duration-200
        hover:shadow-sm hover:border-ev-gray-300
        ${variant === 'primary' ? 'border-t-2 border-t-ev-yellow-400' : ''}
        ${variant === 'highlight' ? 'bg-ev-teal-050 border-ev-teal-200' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 mb-1.5">
            {label}
          </p>
          <p className="text-2xl font-bold text-ev-gray-900 tabular-nums leading-tight">
            {value}
          </p>
          {subtext && (
            <p className="text-sm text-ev-gray-500 mt-1 leading-snug">
              {subtext}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-ev-gray-050 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className={`flex items-center gap-1.5 mt-3 text-xs font-medium ${trendColor}`}>
          <TrendIcon size={14} />
          <span>{trend.value}</span>
          <span className="text-ev-gray-400">·</span>
          <span className="text-ev-gray-500 font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

export default InsightCard;
