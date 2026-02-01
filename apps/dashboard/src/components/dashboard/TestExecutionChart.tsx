/**
 * TestExecutionChart Component
 * Line/Area chart showing test execution trends over time
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface ExecutionDataPoint {
  date: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

interface TestExecutionChartProps {
  data: ExecutionDataPoint[];
  height?: number;
  showLegend?: boolean;
}

export function TestExecutionChart({
  data,
  height = 300,
  showLegend = true,
}: TestExecutionChartProps) {
  const formattedData = useMemo(() => {
    return data.map(d => ({
      ...d,
      dateDisplay: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [data]);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart
          data={formattedData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSkipped" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dateDisplay"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          {showLegend && (
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span style={{ color: '#374151', fontSize: 12 }}>{value}</span>
              )}
            />
          )}
          <Area
            type="monotone"
            dataKey="passed"
            name="Passed"
            stroke="#22c55e"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPassed)"
          />
          <Area
            type="monotone"
            dataKey="failed"
            name="Failed"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorFailed)"
          />
          <Area
            type="monotone"
            dataKey="skipped"
            name="Skipped"
            stroke="#f59e0b"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorSkipped)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
