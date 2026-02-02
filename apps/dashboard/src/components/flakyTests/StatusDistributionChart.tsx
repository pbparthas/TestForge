/**
 * StatusDistributionChart Component
 * Bar chart showing flaky tests by status
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card } from '../ui';

interface StatusData {
  status: 'investigating' | 'known_issue' | 'needs_fix' | 'quarantined' | 'resolved';
  count: number;
  percentage: number;
}

interface StatusDistributionChartProps {
  data: StatusData[];
  loading?: boolean;
  onStatusClick?: (status: string) => void;
}

const STATUS_CONFIG = {
  investigating: { label: 'Investigating', color: '#f59e0b', bgColor: 'bg-yellow-100' },
  known_issue: { label: 'Known Issue', color: '#8b5cf6', bgColor: 'bg-purple-100' },
  needs_fix: { label: 'Needs Fix', color: '#ef4444', bgColor: 'bg-red-100' },
  quarantined: { label: 'Quarantined', color: '#6b7280', bgColor: 'bg-gray-100' },
  resolved: { label: 'Resolved', color: '#22c55e', bgColor: 'bg-green-100' },
};

export function StatusDistributionChart({
  data,
  loading = false,
  onStatusClick,
}: StatusDistributionChartProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading chart...</div>
        </div>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    name: STATUS_CONFIG[item.status]?.label || item.status,
    value: item.count,
    percentage: item.percentage,
    status: item.status,
    color: STATUS_CONFIG[item.status]?.color || '#6b7280',
  }));

  const totalCount = data.reduce((sum, item) => sum + item.count, 0);
  const activeCount = data
    .filter((d) => d.status !== 'resolved' && d.status !== 'quarantined')
    .reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Status Distribution</h3>
          <p className="text-xs text-gray-500">{totalCount} total, {activeCount} active</p>
        </div>
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No status data available</p>
          </div>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                        <p className="font-medium text-gray-900">{data.name}</p>
                        <p className="text-sm text-gray-600">{data.value} tests</p>
                        <p className="text-sm text-gray-500">{data.percentage.toFixed(1)}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                style={{ cursor: onStatusClick ? 'pointer' : 'default' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend / Summary */}
      <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-gray-200">
        {data.map((item) => {
          const config = STATUS_CONFIG[item.status];
          return (
            <div
              key={item.status}
              className={`text-center p-2 rounded cursor-pointer transition-colors hover:opacity-80 ${config?.bgColor || 'bg-gray-100'}`}
              onClick={() => onStatusClick?.(item.status)}
            >
              <p className="text-lg font-semibold" style={{ color: config?.color }}>
                {item.count}
              </p>
              <p className="text-xs text-gray-600 truncate">{config?.label || item.status}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
