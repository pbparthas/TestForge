/**
 * ScheduleTab Component
 * Cron expression input, schedule list, enable/disable toggle
 */

import { useState } from 'react';
import { Card, Button, Input } from '../ui';

interface Schedule {
  id: string;
  name: string;
  suiteId: string;
  suiteName: string;
  cronExpression: string;
  profileId: string;
  profileName: string;
  isActive: boolean;
  nextRun?: string;
  lastRun?: string;
  lastStatus?: 'passed' | 'failed';
}

interface ScheduleTabProps {
  schedules: Schedule[];
  suites: Array<{ id: string; name: string }>;
  profiles: Array<{ id: string; name: string }>;
  loading?: boolean;
  onCreateSchedule: (schedule: Omit<Schedule, 'id' | 'nextRun' | 'lastRun' | 'lastStatus'>) => void;
  onToggleSchedule: (scheduleId: string, isActive: boolean) => void;
  onDeleteSchedule: (scheduleId: string) => void;
}

const commonCrons = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 6 hours', cron: '0 */6 * * *' },
  { label: 'Daily at midnight', cron: '0 0 * * *' },
  { label: 'Daily at 9am', cron: '0 9 * * *' },
  { label: 'Weekdays at 9am', cron: '0 9 * * 1-5' },
  { label: 'Weekly on Monday', cron: '0 9 * * 1' },
];

export function ScheduleTab({
  schedules,
  suites,
  profiles,
  loading = false,
  onCreateSchedule,
  onToggleSchedule,
  onDeleteSchedule,
}: ScheduleTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    suiteId: '',
    cronExpression: '0 9 * * *',
    profileId: '',
    isActive: true,
  });

  const handleCreate = () => {
    if (!formData.name || !formData.suiteId || !formData.cronExpression || !formData.profileId) {
      return;
    }

    const suite = suites.find((s) => s.id === formData.suiteId);
    const profile = profiles.find((p) => p.id === formData.profileId);

    onCreateSchedule({
      ...formData,
      suiteName: suite?.name || '',
      profileName: profile?.name || '',
    });

    setFormData({
      name: '',
      suiteId: '',
      cronExpression: '0 9 * * *',
      profileId: '',
      isActive: true,
    });
    setShowCreateForm(false);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading schedules...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{schedules.length} scheduled jobs</p>
        <Button onClick={() => setShowCreateForm(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Schedule
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-4">Create Schedule</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Schedule Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Nightly Regression"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Suite</label>
              <select
                value={formData.suiteId}
                onChange={(e) => setFormData({ ...formData, suiteId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select suite...</option>
                {suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
              <input
                type="text"
                value={formData.cronExpression}
                onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 9 * * *"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {commonCrons.map((c) => (
                  <button
                    key={c.cron}
                    type="button"
                    onClick={() => setFormData({ ...formData, cronExpression: c.cron })}
                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Execution Profile</label>
              <select
                value={formData.profileId}
                onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select profile...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Schedule</Button>
          </div>
        </Card>
      )}

      {/* Schedule List */}
      {schedules.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No scheduled executions</p>
          <p className="text-sm mt-1">Create a schedule to run tests automatically</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.isActive}
                      onChange={(e) => onToggleSchedule(schedule.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>

                  <div>
                    <p className="font-medium text-gray-900">{schedule.name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{schedule.suiteName}</span>
                      <span className="text-gray-300">|</span>
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {schedule.cronExpression}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Next Run</p>
                    <p className="text-sm text-gray-900">{formatDate(schedule.nextRun)}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500">Last Run</p>
                    <div className="flex items-center gap-1">
                      {schedule.lastStatus && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            schedule.lastStatus === 'passed' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                      )}
                      <p className="text-sm text-gray-900">{formatDate(schedule.lastRun)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteSchedule(schedule.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete schedule"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
