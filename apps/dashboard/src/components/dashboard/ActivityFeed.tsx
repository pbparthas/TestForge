/**
 * ActivityFeed Component
 * Timeline of recent activities/events
 */

import { cn } from '../../utils/cn';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Edit,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';

export type ActivityType =
  | 'test_passed'
  | 'test_failed'
  | 'test_skipped'
  | 'execution_started'
  | 'test_created'
  | 'test_updated'
  | 'test_deleted'
  | 'suite_created'
  | 'bug_created'
  | 'bug_fixed';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  metadata?: Record<string, string | number>;
}

interface ActivityFeedProps {
  activities: Activity[];
  maxItems?: number;
  showTimestamp?: boolean;
  className?: string;
}

const activityConfig: Record<
  ActivityType,
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  test_passed: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  test_failed: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  test_skipped: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  execution_started: {
    icon: <Play className="w-4 h-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  test_created: {
    icon: <Plus className="w-4 h-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  test_updated: {
    icon: <Edit className="w-4 h-4" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  test_deleted: {
    icon: <Trash2 className="w-4 h-4" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  suite_created: {
    icon: <Plus className="w-4 h-4" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  bug_created: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  bug_fixed: {
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function ActivityFeed({
  activities,
  maxItems = 10,
  showTimestamp = true,
  className,
}: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems);

  if (displayedActivities.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <p className="font-medium">No recent activity</p>
        <p className="text-sm mt-1">Activity will appear here</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {displayedActivities.map((activity, index) => {
        const config = activityConfig[activity.type] || activityConfig.test_created;

        return (
          <div
            key={activity.id}
            className={cn(
              'flex items-start gap-3',
              index !== displayedActivities.length - 1 &&
                'pb-4 border-b border-gray-100'
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                config.bgColor,
                config.color
              )}
            >
              {config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{activity.title}</p>
              {activity.description && (
                <p className="text-sm text-gray-500 truncate">{activity.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {activity.user && (
                  <span className="text-xs text-gray-500">by {activity.user}</span>
                )}
                {showTimestamp && (
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(activity.timestamp)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
