/**
 * AIActivityWidget Component
 * Agent usage stats, cost tracking, recent activity list
 */

import { Card } from '../ui';

interface AgentUsage {
  agent: string;
  calls: number;
  tokens: number;
  cost: number;
}

interface RecentActivity {
  id: string;
  agent: string;
  action: string;
  timestamp: string;
  cost: number;
}

interface AIActivityWidgetProps {
  totalCost: number;
  totalCalls: number;
  agentUsage: AgentUsage[];
  recentActivity: RecentActivity[];
  period?: string;
  loading?: boolean;
  onViewAll?: () => void;
}

const AGENT_COLORS: Record<string, string> = {
  TestWeaver: 'bg-blue-500',
  ScriptSmith: 'bg-purple-500',
  CodeGuardian: 'bg-green-500',
  FlowPilot: 'bg-orange-500',
  SelfHealing: 'bg-red-500',
};

export function AIActivityWidget({
  totalCost,
  totalCalls,
  agentUsage,
  recentActivity,
  period = 'This month',
  loading = false,
  onViewAll,
}: AIActivityWidgetProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-8 w-24 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const topAgents = [...agentUsage].sort((a, b) => b.calls - a.calls).slice(0, 4);

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">AI Activity</h3>
          <p className="text-xs text-gray-500">{period}</p>
        </div>
        <div className="p-2 bg-purple-100 rounded-lg">
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Total Cost</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{totalCalls.toLocaleString()}</p>
          <p className="text-xs text-gray-500">API Calls</p>
        </div>
      </div>

      {/* Agent Usage Breakdown */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Usage by Agent</p>
        <div className="space-y-2">
          {topAgents.map((agent) => {
            const percentage = totalCalls > 0 ? (agent.calls / totalCalls) * 100 : 0;
            return (
              <div key={agent.agent}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700">{agent.agent}</span>
                  <span className="text-gray-500">{agent.calls} calls</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${AGENT_COLORS[agent.agent] || 'bg-gray-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Recent Activity</p>
        <div className="space-y-2 max-h-[120px] overflow-y-auto">
          {recentActivity.slice(0, 5).map((activity) => (
            <div key={activity.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${AGENT_COLORS[activity.agent] || 'bg-gray-500'}`} />
                <span className="text-gray-700 truncate max-w-[120px]">{activity.action}</span>
              </div>
              <span className="text-gray-400">${activity.cost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* View All Link */}
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full mt-4 pt-3 border-t border-gray-200 text-xs text-blue-600 hover:text-blue-700"
        >
          View all activity →
        </button>
      )}
    </Card>
  );
}
