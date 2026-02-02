/**
 * ExecutionProfile Component
 * Profile CRUD, device/browser config, parallel workers setting
 */

import { useState } from 'react';
import { Card, Button, Input } from '../ui';
import { devices, browsers } from '../../config/devices';

interface Profile {
  id: string;
  name: string;
  description?: string;
  device: string;
  browser: string;
  parallel: number;
  headless: boolean;
  timeout: number;
  retries: number;
  isDefault?: boolean;
}

interface ExecutionProfileProps {
  profiles: Profile[];
  onSave: (profile: Omit<Profile, 'id'> & { id?: string }) => void;
  onDelete: (profileId: string) => void;
  onSetDefault: (profileId: string) => void;
}

export function ExecutionProfile({ profiles, onSave, onDelete, onSetDefault }: ExecutionProfileProps) {
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Omit<Profile, 'id'>>({
    name: '',
    description: '',
    device: 'desktop-1080p',
    browser: 'chromium',
    parallel: 1,
    headless: true,
    timeout: 30000,
    retries: 0,
  });

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      device: profile.device,
      browser: profile.browser,
      parallel: profile.parallel,
      headless: profile.headless,
      timeout: profile.timeout,
      retries: profile.retries,
    });
    setIsCreating(true);
  };

  const handleCreate = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      description: '',
      device: 'desktop-1080p',
      browser: 'chromium',
      parallel: 1,
      headless: true,
      timeout: 30000,
      retries: 0,
    });
    setIsCreating(true);
  };

  const handleSave = () => {
    onSave({
      ...formData,
      id: editingProfile?.id,
    });
    setIsCreating(false);
    setEditingProfile(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingProfile(null);
  };

  if (isCreating) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {editingProfile ? 'Edit Profile' : 'Create Profile'}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Profile Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Chrome Desktop"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
              <select
                value={formData.device}
                onChange={(e) => setFormData({ ...formData, device: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.viewport.width}x{d.viewport.height})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Browser</label>
              <select
                value={formData.browser}
                onChange={(e) => setFormData({ ...formData, browser: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {browsers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parallel Workers</label>
              <input
                type="number"
                value={formData.parallel}
                onChange={(e) => setFormData({ ...formData, parallel: parseInt(e.target.value) || 1 })}
                min={1}
                max={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (ms)</label>
              <input
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 30000 })}
                min={5000}
                max={300000}
                step={5000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retries</label>
              <input
                type="number"
                value={formData.retries}
                onChange={(e) => setFormData({ ...formData, retries: parseInt(e.target.value) || 0 })}
                min={0}
                max={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.headless}
              onChange={(e) => setFormData({ ...formData, headless: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Headless Mode</p>
              <p className="text-xs text-gray-500">Run browser without visible window (faster)</p>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name}>
              {editingProfile ? 'Save Changes' : 'Create Profile'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{profiles.length} execution profiles</p>
        <Button onClick={handleCreate}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p>No execution profiles</p>
          <p className="text-sm mt-1">Create a profile to configure test execution settings</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{profile.name}</p>
                    {profile.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  {profile.description && (
                    <p className="text-sm text-gray-500">{profile.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(profile)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {!profile.isDefault && (
                    <button
                      onClick={() => onDelete(profile.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Device</p>
                  <p className="font-medium">{devices.find((d) => d.id === profile.device)?.name || profile.device}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Browser</p>
                  <p className="font-medium">{browsers.find((b) => b.id === profile.browser)?.name || profile.browser}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Parallel</p>
                  <p className="font-medium">{profile.parallel} workers</p>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Headless</p>
                  <p className="font-medium">{profile.headless ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {!profile.isDefault && (
                <button
                  onClick={() => onSetDefault(profile.id)}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                >
                  Set as Default
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
