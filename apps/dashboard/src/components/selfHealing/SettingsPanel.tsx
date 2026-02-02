/**
 * SettingsPanel Component
 * Auto-apply threshold slider, confidence minimum setting
 */

import { useState, useEffect } from 'react';
import { Card, Button } from '../ui';

interface SelfHealingSettings {
  autoApplyEnabled: boolean;
  autoApplyThreshold: number;
  minConfidence: number;
  maxRetriesBeforeHeal: number;
  notifyOnAutoApply: boolean;
  notifyOnPending: boolean;
  allowedActionTypes: string[];
}

interface SettingsPanelProps {
  settings: SelfHealingSettings;
  onSave: (settings: SelfHealingSettings) => void;
  isSaving?: boolean;
}

const actionTypes = [
  { id: 'locator_fix', label: 'Locator Fixes', description: 'Auto-fix broken element selectors' },
  { id: 'timing_fix', label: 'Timing Fixes', description: 'Adjust wait times and timeouts' },
  { id: 'assertion_fix', label: 'Assertion Fixes', description: 'Update assertion values' },
  { id: 'auto_retry', label: 'Auto Retry', description: 'Automatically retry failed tests' },
  { id: 'element_wait', label: 'Element Wait', description: 'Add dynamic element waits' },
];

export function SettingsPanel({ settings, onSave, isSaving = false }: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<SelfHealingSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const updateSetting = <K extends keyof SelfHealingSettings>(
    key: K,
    value: SelfHealingSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleActionType = (actionId: string) => {
    const current = localSettings.allowedActionTypes;
    const updated = current.includes(actionId)
      ? current.filter((id) => id !== actionId)
      : [...current, actionId];
    updateSetting('allowedActionTypes', updated);
  };

  const handleSave = () => {
    onSave(localSettings);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Self-Healing Settings</h3>
          <p className="text-sm text-gray-500">Configure auto-healing behavior</p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleReset} disabled={isSaving}>
              Reset
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* Auto-Apply Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Auto-Apply Fixes</p>
            <p className="text-sm text-gray-500">
              Automatically apply high-confidence fixes without manual approval
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.autoApplyEnabled}
              onChange={(e) => updateSetting('autoApplyEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
          </label>
        </div>

        {/* Auto-Apply Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium text-gray-900">Auto-Apply Threshold</label>
            <span className="text-sm font-semibold text-red-600">
              {Math.round(localSettings.autoApplyThreshold * 100)}%
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Fixes with confidence above this threshold will be auto-applied
          </p>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={localSettings.autoApplyThreshold}
            onChange={(e) => updateSetting('autoApplyThreshold', parseFloat(e.target.value))}
            disabled={!localSettings.autoApplyEnabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500 disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Minimum Confidence */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium text-gray-900">Minimum Confidence</label>
            <span className="text-sm font-semibold text-gray-600">
              {Math.round(localSettings.minConfidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Suggestions below this confidence will be discarded
          </p>
          <input
            type="range"
            min="0.3"
            max="0.9"
            step="0.05"
            value={localSettings.minConfidence}
            onChange={(e) => updateSetting('minConfidence', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>30%</span>
            <span>60%</span>
            <span>90%</span>
          </div>
        </div>

        {/* Max Retries */}
        <div>
          <label className="font-medium text-gray-900">Max Retries Before Healing</label>
          <p className="text-sm text-gray-500 mb-3">
            Number of test retries before self-healing is triggered
          </p>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 5].map((num) => (
              <button
                key={num}
                onClick={() => updateSetting('maxRetriesBeforeHeal', num)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  localSettings.maxRetriesBeforeHeal === num
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Allowed Action Types */}
        <div>
          <label className="font-medium text-gray-900">Allowed Actions</label>
          <p className="text-sm text-gray-500 mb-3">
            Select which types of fixes can be suggested
          </p>
          <div className="space-y-2">
            {actionTypes.map((action) => (
              <label
                key={action.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  localSettings.allowedActionTypes.includes(action.id)
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={localSettings.allowedActionTypes.includes(action.id)}
                  onChange={() => toggleActionType(action.id)}
                  className="w-4 h-4 text-red-500 rounded focus:ring-red-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <label className="font-medium text-gray-900">Notifications</label>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.notifyOnAutoApply}
                onChange={(e) => updateSetting('notifyOnAutoApply', e.target.checked)}
                className="w-4 h-4 text-red-500 rounded focus:ring-red-500"
              />
              <div>
                <p className="text-sm text-gray-900">Notify on auto-apply</p>
                <p className="text-xs text-gray-500">Send notification when a fix is automatically applied</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.notifyOnPending}
                onChange={(e) => updateSetting('notifyOnPending', e.target.checked)}
                className="w-4 h-4 text-red-500 rounded focus:ring-red-500"
              />
              <div>
                <p className="text-sm text-gray-900">Notify on pending fixes</p>
                <p className="text-xs text-gray-500">Send notification when new fixes need approval</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </Card>
  );
}
