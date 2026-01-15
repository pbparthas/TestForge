/**
 * Bugs Page
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, StatusBadge, PriorityBadge } from '../components/ui';
import type { Bug } from '../types';

export function BugsPage() {
  const { currentProject } = useProjectStore();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (currentProject) {
      loadBugs();
    }
  }, [currentProject]);

  const loadBugs = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const response = await api.getBugs(1, 50, currentProject.id);
      setBugs(response.data.items || response.data);
    } catch (err) {
      console.error('Failed to load bugs', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBugs = filter === 'all'
    ? bugs
    : bugs.filter(b => b.status === filter);

  if (!currentProject) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">Please select a project from the dashboard</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bugs</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Bugs</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Open" count={bugs.filter(b => b.status === 'open').length} color="red" />
        <StatCard label="In Progress" count={bugs.filter(b => b.status === 'in_progress').length} color="yellow" />
        <StatCard label="Resolved" count={bugs.filter(b => b.status === 'resolved').length} color="green" />
        <StatCard label="Closed" count={bugs.filter(b => b.status === 'closed').length} color="gray" />
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : filteredBugs.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            {filter === 'all' ? 'No bugs found' : `No ${filter.replace('_', ' ')} bugs`}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredBugs.map((bug) => (
              <div key={bug.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{bug.title}</h3>
                    {bug.description && (
                      <p className="text-sm text-gray-500 mt-1">{bug.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <PriorityBadge priority={bug.priority} />
                    <StatusBadge status={bug.status} />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>Created: {new Date(bug.createdAt).toLocaleDateString()}</span>
                  {bug.externalId && <span>External: {bug.externalId}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-700',
  };

  return (
    <div className={`p-4 rounded-lg ${colors[color]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}
