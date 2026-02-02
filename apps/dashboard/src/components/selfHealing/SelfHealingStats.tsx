/**
 * SelfHealingStats Component
 * 5 stat cards: Pending, Auto-Fixed, Approved, Time Saved, Avg Confidence
 */

import { Card } from '../ui';

interface SelfHealingStatsProps {
  stats: {
    pending: number;
    autoFixed: number;
    approved: number;
    rejected: number;
    timeSavedMinutes: number;
    avgConfidence: number;
    totalFixes: number;
    costSaved: number;
  };
  loading?: boolean;
}

export function SelfHealingStats({ stats, loading = false }: SelfHealingStatsProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const statCards = [
    {
      label: 'Pending Review',
      value: stats.pending,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'amber',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-600',
    },
    {
      label: 'Auto-Fixed',
      value: stats.autoFixed,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
    },
    {
      label: 'Approved',
      value: stats.approved,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600',
    },
    {
      label: 'Time Saved',
      value: formatTime(stats.timeSavedMinutes),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
      isText: true,
    },
    {
      label: 'Avg Confidence',
      value: `${Math.round(stats.avgConfidence * 100)}%`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'indigo',
      bgColor: 'bg-indigo-100',
      textColor: 'text-indigo-600',
      isText: true,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-10 w-10 bg-gray-200 rounded-lg mb-3" />
            <div className="h-8 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="p-4">
          <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center mb-3`}>
            <span className={stat.textColor}>{stat.icon}</span>
          </div>
          <p className={`text-2xl font-bold ${stat.textColor}`}>
            {stat.isText ? stat.value : stat.value.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">{stat.label}</p>
        </Card>
      ))}
    </div>
  );
}
