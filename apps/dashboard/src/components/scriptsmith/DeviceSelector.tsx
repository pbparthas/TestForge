/**
 * DeviceSelector Component
 * Device grid with preview for script generation targeting
 */

import { useState } from 'react';
import { Card } from '../ui';

interface DeviceConfig {
  id: string;
  name: string;
  type: 'mobile' | 'tablet' | 'desktop';
  viewport: { width: number; height: number };
  userAgent?: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

interface DeviceSelectorProps {
  devices: DeviceConfig[];
  selectedDevices: string[];
  onSelectionChange: (deviceIds: string[]) => void;
  multiSelect?: boolean;
  showPreview?: boolean;
}

const DEVICE_ICONS = {
  mobile: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  tablet: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  desktop: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

export function DeviceSelector({
  devices,
  selectedDevices,
  onSelectionChange,
  multiSelect = true,
  showPreview = true,
}: DeviceSelectorProps) {
  const [filter, setFilter] = useState<'all' | 'mobile' | 'tablet' | 'desktop'>('all');
  const [customViewport, setCustomViewport] = useState({ width: 1920, height: 1080 });
  const [useCustom, setUseCustom] = useState(false);

  const filteredDevices = filter === 'all'
    ? devices
    : devices.filter((d) => d.type === filter);

  const toggleDevice = (deviceId: string) => {
    if (multiSelect) {
      if (selectedDevices.includes(deviceId)) {
        onSelectionChange(selectedDevices.filter((id) => id !== deviceId));
      } else {
        onSelectionChange([...selectedDevices, deviceId]);
      }
    } else {
      onSelectionChange([deviceId]);
    }
    setUseCustom(false);
  };

  const selectAll = () => {
    onSelectionChange(filteredDevices.map((d) => d.id));
    setUseCustom(false);
  };

  const clearAll = () => {
    onSelectionChange([]);
    setUseCustom(false);
  };

  const handleCustomViewport = () => {
    setUseCustom(true);
    onSelectionChange([]);
  };

  const previewDevice = useCustom
    ? { name: 'Custom', viewport: customViewport, type: 'desktop' as const }
    : devices.find((d) => selectedDevices[0] === d.id);

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {(['all', 'mobile', 'tablet', 'desktop'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === type
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {multiSelect && (
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filteredDevices.map((device) => (
          <div
            key={device.id}
            className={`p-3 cursor-pointer transition-all rounded-lg border bg-white shadow-sm ${
              selectedDevices.includes(device.id)
                ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
                : 'hover:bg-gray-50 border-gray-200'
            }`}
            onClick={() => toggleDevice(device.id)}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`mb-2 ${selectedDevices.includes(device.id) ? 'text-blue-600' : 'text-gray-400'}`}>
                {DEVICE_ICONS[device.type]}
              </div>
              <p className="text-sm font-medium text-gray-900 truncate w-full">{device.name}</p>
              <p className="text-xs text-gray-500">
                {device.viewport.width} x {device.viewport.height}
              </p>
            </div>
          </div>
        ))}

        {/* Custom Viewport Card */}
        <div
          className={`p-3 cursor-pointer transition-all rounded-lg border bg-white shadow-sm ${
            useCustom
              ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
              : 'hover:bg-gray-50 border-dashed border-gray-300'
          }`}
          onClick={handleCustomViewport}
        >
          <div className="flex flex-col items-center text-center">
            <div className={`mb-2 ${useCustom ? 'text-blue-600' : 'text-gray-400'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">Custom</p>
            <p className="text-xs text-gray-500">Set viewport</p>
          </div>
        </div>
      </div>

      {/* Custom Viewport Input */}
      {useCustom && (
        <Card className="p-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-3">Custom Viewport</p>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width</label>
              <input
                type="number"
                value={customViewport.width}
                onChange={(e) => setCustomViewport({ ...customViewport, width: Number(e.target.value) })}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-gray-400 mt-5">x</span>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Height</label>
              <input
                type="number"
                value={customViewport.height}
                onChange={(e) => setCustomViewport({ ...customViewport, height: Number(e.target.value) })}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Preview */}
      {showPreview && previewDevice && (
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
          <div className="flex items-center justify-center">
            <div
              className="border-2 border-gray-300 rounded-lg bg-gray-100 flex items-center justify-center relative"
              style={{
                width: Math.min(previewDevice.viewport.width / 5, 300),
                height: Math.min(previewDevice.viewport.height / 5, 200),
              }}
            >
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">{previewDevice.name}</p>
                <p className="text-xs text-gray-400">
                  {previewDevice.viewport.width} x {previewDevice.viewport.height}
                </p>
              </div>
            </div>
          </div>
          {selectedDevices.length > 1 && (
            <p className="text-xs text-gray-500 text-center mt-2">
              +{selectedDevices.length - 1} more device(s) selected
            </p>
          )}
        </Card>
      )}

      {/* Selection Summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {useCustom
            ? 'Custom viewport selected'
            : `${selectedDevices.length} device(s) selected`}
        </span>
      </div>
    </div>
  );
}
