/**
 * FlakyTrendChart Component
 * 30-day line chart with dual Y-axes for flaky count and flakiness score
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui';

interface TrendDataPoint {
  date: string;
  flakyCount: number;
  flakinessScore: number;
  totalTests: number;
  newFlaky: number;
  resolved: number;
}

interface FlakyTrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
  dateRange?: '7d' | '14d' | '30d' | '90d';
  onDateRangeChange?: (range: '7d' | '14d' | '30d' | '90d') => void;
}

export function FlakyTrendChart({
  data,
  loading = false,
  dateRange = '30d',
  onDateRangeChange,
}: FlakyTrendChartProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="h-[350px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading chart...</div>
        </div>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const latestData = data[data.length - 1];
  const previousData = data[data.length - 2];
  const countChange = latestData && previousData
    ? latestData.flakyCount - previousData.flakyCount
    : 0;
  const scoreChange = latestData && previousData
    ? latestData.flakinessScore - previousData.flakinessScore
    : 0;

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Flaky Test Trends</h3>
          <p className="text-xs text-gray-500">Track flakiness over time</p>
        </div>
        {onDateRangeChange && (
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {(['7d', '14d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => onDateRangeChange(range)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  dateRange === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {latestData && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{latestData.flakyCount}</p>
            <p className="text-xs text-gray-500">Flaky Tests</p>
            {countChange !== 0 && (
              <p className={`text-xs mt-1 ${countChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {countChange > 0 ? '+' : ''}{countChange} from yesterday
              </p>
            )}
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{latestData.flakinessScore.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">Flakiness Score</p>
            {scoreChange !== 0 && (
              <p className={`text-xs mt-1 ${scoreChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}%
              </p>
            )}
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{latestData.newFlaky}</p>
            <p className="text-xs text-gray-500">New Today</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{latestData.resolved}</p>
            <p className="text-xs text-gray-500">Resolved Today</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No trend data available</p>
          </div>
        </div>
      ) : (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length && label) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                        <p className="font-medium text-gray-900 mb-2">{formatDate(String(label))}</p>
                        {payload.map((entry, index) => (
                          <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {entry.name === 'Flakiness Score' ? `${Number(entry.value).toFixed(1)}%` : entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="flakyCount"
                name="Flaky Count"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="flakinessScore"
                name="Flakiness Score"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
