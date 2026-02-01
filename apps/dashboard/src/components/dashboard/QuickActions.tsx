/**
 * QuickActions Component
 * Grid of quick action buttons for common tasks
 */

import { cn } from '../../utils/cn';

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
  bgColor?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function QuickActions({
  actions,
  columns = 2,
  className,
}: QuickActionsProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={cn('grid gap-3', gridCols[columns], className)}>
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          className={cn(
            'flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200',
            'hover:bg-gray-50 hover:border-gray-300 transition-all',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          )}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center mb-2',
              action.bgColor || 'bg-blue-100'
            )}
          >
            <span className={action.color || 'text-blue-600'}>{action.icon}</span>
          </div>
          <span className="text-sm font-medium text-gray-900">{action.label}</span>
          {action.description && (
            <span className="text-xs text-gray-500 mt-0.5">{action.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}
