/**
 * StatsCard Component
 * Card showing a metric with optional trend indicator
 */

import { cn } from '../../utils/cn';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-blue-100',
  trend,
  className,
}: StatsCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value === 0) return <Minus className="w-4 h-4" />;
    return trend.value > 0 ? (
      <TrendingUp className="w-4 h-4" />
    ) : (
      <TrendingDown className="w-4 h-4" />
    );
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value === 0) return 'text-gray-500';
    return trend.isPositive ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 p-5 transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}

          {trend && (
            <div className={cn('flex items-center gap-1 text-sm', getTrendColor())}>
              {getTrendIcon()}
              <span className="font-medium">
                {trend.value > 0 ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              iconBgColor
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
