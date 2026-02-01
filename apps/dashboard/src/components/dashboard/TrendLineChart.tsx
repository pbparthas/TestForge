/**
 * TrendLineChart Component
 * Simple line chart for showing trends (pass rate, flaky tests, etc.)
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface TrendLineChartProps {
  data: TrendDataPoint[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTarget?: number;
  targetLabel?: string;
  yAxisSuffix?: string;
  yAxisDomain?: [number, number];
}

export function TrendLineChart({
  data,
  height = 200,
  color = '#3b82f6',
  showGrid = true,
  showTarget,
  targetLabel,
  yAxisSuffix = '',
  yAxisDomain,
}: TrendLineChartProps) {
  const formattedData = data.map(d => ({
    ...d,
    dateDisplay: new Date(d.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart
          data={formattedData}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          )}
          <XAxis
            dataKey="dateDisplay"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            tickFormatter={(value) => `${value}${yAxisSuffix}`}
            domain={yAxisDomain}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px',
            }}
            formatter={(value) => [`${value}${yAxisSuffix}`, 'Value']}
          />
          {showTarget !== undefined && (
            <ReferenceLine
              y={showTarget}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={
                targetLabel
                  ? {
                      value: targetLabel,
                      position: 'insideTopRight',
                      fill: '#22c55e',
                      fontSize: 11,
                    }
                  : undefined
              }
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 0, r: 3 }}
            activeDot={{ fill: color, strokeWidth: 0, r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
