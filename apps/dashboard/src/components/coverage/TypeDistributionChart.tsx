/**
 * TypeDistributionChart Component
 * Bar chart showing coverage by type (unit, integration, e2e, etc.)
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '../ui';

interface TypeData {
  type: string;
  covered: number;
  total: number;
  percentage: number;
}

interface TypeDistributionChartProps {
  data: TypeData[];
  loading?: boolean;
  onTypeClick?: (type: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  unit: '#3b82f6',
  integration: '#8b5cf6',
  e2e: '#10b981',
  api: '#f59e0b',
  visual: '#ec4899',
  performance: '#06b6d4',
  security: '#ef4444',
  accessibility: '#6366f1',
};

const getTypeColor = (type: string): string => {
  return TYPE_COLORS[type.toLowerCase()] || '#6b7280';
};

export function TypeDistributionChart({
  data,
  loading = false,
  onTypeClick,
}: TypeDistributionChartProps) {
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
    name: item.type,
    covered: item.covered,
    uncovered: item.total - item.covered,
    total: item.total,
    percentage: item.percentage,
  }));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Coverage by Type</h3>

      {data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No coverage data available</p>
          </div>
        </div>
      ) : (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                        <p className="font-medium text-gray-900">{data.name}</p>
                        <p className="text-sm text-gray-600">
                          {data.covered} / {data.total} covered
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          {data.percentage.toFixed(1)}% coverage
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="percentage"
                radius={[0, 4, 4, 0]}
                style={{ cursor: onTypeClick ? 'pointer' : 'default' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getTypeColor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200">
        {data.map((item) => (
          <div
            key={item.type}
            className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
              onTypeClick ? 'cursor-pointer hover:bg-gray-50' : ''
            }`}
            onClick={() => onTypeClick?.(item.type)}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: getTypeColor(item.type) }}
            />
            <span className="text-gray-600">{item.type}</span>
            <span className="text-gray-400">({item.percentage.toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
