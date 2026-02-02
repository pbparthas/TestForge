/**
 * CoverageDashboard Component
 * 5 metrics: Total, Fully Tested, Partial, Not Tested, Avg Coverage
 */

import { Card } from '../ui';

interface CoverageStats {
  total: number;
  fullyTested: number;
  partiallyTested: number;
  notTested: number;
  avgCoverage: number;
}

interface CoverageDashboardProps {
  stats: CoverageStats;
  loading?: boolean;
}

export function CoverageDashboard({ stats, loading = false }: CoverageDashboardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-8 w-12 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      label: 'Total Requirements',
      value: stats.total,
      color: 'text-gray-900',
      bgColor: 'bg-gray-100',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: 'Fully Tested',
      value: stats.fullyTested,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Partially Tested',
      value: stats.partiallyTested,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Not Tested',
      value: stats.notTested,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Avg Coverage',
      value: `${Math.round(stats.avgCoverage)}%`,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      isPercentage: true,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  // Calculate progress bar
  const testedPercentage = stats.total > 0 ? ((stats.fullyTested + stats.partiallyTested) / stats.total) * 100 : 0;
  const fullyTestedPercentage = stats.total > 0 ? (stats.fullyTested / stats.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <span className={metric.color}>{metric.icon}</span>
              </div>
              <div>
                <p className={`text-2xl font-bold ${metric.color}`}>
                  {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                </p>
                <p className="text-xs text-gray-500">{metric.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Coverage Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Overall Coverage</p>
          <p className="text-sm text-gray-500">
            {stats.fullyTested + stats.partiallyTested} of {stats.total} requirements have tests
          </p>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${fullyTestedPercentage}%` }}
              title={`${stats.fullyTested} fully tested`}
            />
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${testedPercentage - fullyTestedPercentage}%` }}
              title={`${stats.partiallyTested} partially tested`}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded" />
            Fully tested ({Math.round(fullyTestedPercentage)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-500 rounded" />
            Partial ({Math.round(testedPercentage - fullyTestedPercentage)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-200 rounded" />
            Not tested ({Math.round(100 - testedPercentage)}%)
          </span>
        </div>
      </Card>
    </div>
  );
}
