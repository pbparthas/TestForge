/**
 * ExecutionConfigPanel Component
 * Configuration panel for execution settings: device, browser, headless, environment
 */

import { useState } from 'react';
import { Card, Button } from '../ui';
import {
  devices,
  browsers,
  getDevicesByCategory,
  type ExecutionConfig,
  defaultExecutionConfig
} from '../../config/devices';

interface Environment {
  id: string;
  name: string;
  baseUrl: string;
}

interface ExecutionConfigPanelProps {
  config: ExecutionConfig;
  onChange: (config: ExecutionConfig) => void;
  environments: Environment[];
  onTrigger?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ExecutionConfigPanel({
  config,
  onChange,
  environments,
  onTrigger,
  isLoading = false,
  disabled = false,
}: ExecutionConfigPanelProps) {
  const [showCustomViewport, setShowCustomViewport] = useState(false);
  const [deviceCategory, setDeviceCategory] = useState<'all' | 'mobile' | 'tablet' | 'desktop'>('all');

  const filteredDevices = deviceCategory === 'all'
    ? devices
    : getDevicesByCategory(deviceCategory);

  const selectedDevice = devices.find(d => d.id === config.deviceId);

  const handleDeviceChange = (deviceId: string) => {
    if (deviceId === 'custom') {
      setShowCustomViewport(true);
      onChange({
        ...config,
        deviceId: 'custom',
        customViewport: config.customViewport || { width: 1280, height: 720 },
      });
    } else {
      setShowCustomViewport(false);
      onChange({ ...config, deviceId, customViewport: undefined });
    }
  };

  const handleCustomViewportChange = (dimension: 'width' | 'height', value: number) => {
    onChange({
      ...config,
      customViewport: {
        ...config.customViewport,
        [dimension]: value,
      } as { width: number; height: number },
    });
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Configuration</h3>

      <div className="space-y-6">
        {/* Device Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Device / Viewport
          </label>

          {/* Category Filter */}
          <div className="flex gap-2 mb-3">
            {(['all', 'mobile', 'tablet', 'desktop'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setDeviceCategory(cat)}
                disabled={disabled}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  deviceCategory === cat
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Device Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
            {filteredDevices.map((device) => (
              <button
                key={device.id}
                onClick={() => handleDeviceChange(device.id)}
                disabled={disabled}
                className={`p-2 text-left rounded-lg border transition-all ${
                  config.deviceId === device.id
                    ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                    : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {device.category === 'mobile' ? '📱' : device.category === 'tablet' ? '📱' : '💻'}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-gray-900 truncate">{device.name}</p>
                    <p className="text-xs text-gray-500">
                      {device.viewport.width}×{device.viewport.height}
                    </p>
                  </div>
                </div>
              </button>
            ))}

            {/* Custom Viewport Option */}
            <button
              onClick={() => handleDeviceChange('custom')}
              disabled={disabled}
              className={`p-2 text-left rounded-lg border transition-all ${
                config.deviceId === 'custom'
                  ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                <div>
                  <p className="text-xs font-medium text-gray-900">Custom</p>
                  <p className="text-xs text-gray-500">Set viewport</p>
                </div>
              </div>
            </button>
          </div>

          {/* Custom Viewport Inputs */}
          {showCustomViewport && (
            <div className="flex gap-3 mt-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Width</label>
                <input
                  type="number"
                  value={config.customViewport?.width || 1280}
                  onChange={(e) => handleCustomViewportChange('width', parseInt(e.target.value) || 1280)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  min={320}
                  max={3840}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Height</label>
                <input
                  type="number"
                  value={config.customViewport?.height || 720}
                  onChange={(e) => handleCustomViewportChange('height', parseInt(e.target.value) || 720)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  min={240}
                  max={2160}
                />
              </div>
            </div>
          )}

          {/* Selected Device Info */}
          {selectedDevice && (
            <div className="mt-2 text-xs text-gray-500">
              Selected: {selectedDevice.name} ({selectedDevice.viewport.width}×{selectedDevice.viewport.height})
              {selectedDevice.isMobile && ' - Mobile'}
              {selectedDevice.hasTouch && ' - Touch'}
            </div>
          )}
        </div>

        {/* Browser Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Browser
          </label>
          <div className="flex gap-3">
            {browsers.map((browser) => (
              <button
                key={browser.id}
                onClick={() => onChange({ ...config, browserId: browser.id })}
                disabled={disabled}
                className={`flex-1 p-3 rounded-lg border transition-all ${
                  config.browserId === browser.id
                    ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                    : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">
                    {browser.id === 'chromium' ? '🌐' : browser.id === 'firefox' ? '🦊' : '🧭'}
                  </span>
                  <span className="text-xs font-medium text-gray-900">{browser.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Headless Mode */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.headless}
              onChange={(e) => onChange({ ...config, headless: e.target.checked })}
              disabled={disabled}
              className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Headless Mode</span>
              <p className="text-xs text-gray-500">Run browser without visible window (faster)</p>
            </div>
          </label>
        </div>

        {/* Environment Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Environment
          </label>
          <select
            value={config.environmentId}
            onChange={(e) => onChange({ ...config, environmentId: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
          >
            <option value="">Select environment...</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name} ({env.baseUrl})
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Options */}
        <div className="border-t border-gray-200 pt-4">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-700">
              Advanced Options
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-4 space-y-4">
              {/* Parallel Execution */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Parallel Workers
                </label>
                <input
                  type="number"
                  value={config.parallel}
                  onChange={(e) => onChange({ ...config, parallel: parseInt(e.target.value) || 1 })}
                  disabled={disabled}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  min={1}
                  max={10}
                />
              </div>

              {/* Timeout */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  value={config.timeout}
                  onChange={(e) => onChange({ ...config, timeout: parseInt(e.target.value) || 30000 })}
                  disabled={disabled}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  min={5000}
                  max={300000}
                  step={5000}
                />
              </div>

              {/* Retries */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Retries on Failure
                </label>
                <input
                  type="number"
                  value={config.retries}
                  onChange={(e) => onChange({ ...config, retries: parseInt(e.target.value) || 0 })}
                  disabled={disabled}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  min={0}
                  max={5}
                />
              </div>
            </div>
          </details>
        </div>

        {/* Run Button */}
        {onTrigger && (
          <div className="border-t border-gray-200 pt-4">
            <Button
              onClick={onTrigger}
              isLoading={isLoading}
              disabled={disabled || !config.environmentId}
              className="w-full"
            >
              {isLoading ? 'Running...' : 'Run Tests'}
            </Button>
            {!config.environmentId && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                Please select an environment to run tests
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export { defaultExecutionConfig };
