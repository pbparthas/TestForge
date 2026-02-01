/**
 * CoverageDonutChart Component
 * Donut chart showing test coverage breakdown
 */

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

export interface CoverageData {
  name: string;
  value: number;
  color: string;
}

interface CoverageDonutChartProps {
  data: CoverageData[];
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
}

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = (props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) => {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function CoverageDonutChart({
  data,
  height = 250,
  centerLabel,
  centerValue,
  showLegend = true,
}: CoverageDonutChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  return (
    <div style={{ width: '100%', height }} className="relative">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderCustomizedLabel}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
            formatter={(value) => [`${value} (${((Number(value) / total) * 100).toFixed(1)}%)`, '']}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span style={{ color: '#374151', fontSize: 12 }}>{value}</span>
              )}
            />
          )}
        </PieChart>
      </ResponsiveContainer>

      {/* Center Label */}
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ marginTop: showLegend ? -20 : 0 }}>
            <div className="text-2xl font-bold text-gray-900">{centerValue}</div>
            <div className="text-xs text-gray-500">{centerLabel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
