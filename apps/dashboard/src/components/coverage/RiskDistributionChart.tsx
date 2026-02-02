/**
 * RiskDistributionChart Component
 * Pie chart showing coverage gaps by risk level
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card } from '../ui';

interface RiskData {
  level: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  percentage: number;
}

interface RiskDistributionChartProps {
  data: RiskData[];
  loading?: boolean;
  onRiskClick?: (level: string) => void;
}

const RISK_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#65a30d',
};

const RISK_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function RiskDistributionChart({
  data,
  loading = false,
  onRiskClick,
}: RiskDistributionChartProps) {
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
    name: RISK_LABELS[item.level],
    value: item.count,
    percentage: item.percentage,
    level: item.level,
  }));

  const total = data.reduce((sum, item) => sum + item.count, 0);

  const handleClick = (entry: { level: string }) => {
    if (onRiskClick) {
      onRiskClick(entry.level);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Risk Distribution</h3>

      {total === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No coverage gaps found</p>
          </div>
        </div>
      ) : (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                onClick={handleClick}
                style={{ cursor: onRiskClick ? 'pointer' : 'default' }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={RISK_COLORS[entry.level as keyof typeof RISK_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                        <p className="font-medium text-gray-900">{data.name} Risk</p>
                        <p className="text-sm text-gray-600">{data.value} gaps</p>
                        <p className="text-sm text-gray-500">{data.percentage.toFixed(1)}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => (
                  <span className="text-sm text-gray-600">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-200">
        {data.map((item) => (
          <div
            key={item.level}
            className={`text-center p-2 rounded cursor-pointer transition-colors hover:bg-gray-50 ${
              onRiskClick ? 'cursor-pointer' : ''
            }`}
            onClick={() => onRiskClick?.(item.level)}
          >
            <div
              className="w-3 h-3 rounded-full mx-auto mb-1"
              style={{ backgroundColor: RISK_COLORS[item.level] }}
            />
            <p className="text-lg font-semibold text-gray-900">{item.count}</p>
            <p className="text-xs text-gray-500">{RISK_LABELS[item.level]}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
