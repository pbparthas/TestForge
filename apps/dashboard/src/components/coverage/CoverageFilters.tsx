/**
 * CoverageFilters Component
 * Filter panel for coverage type, risk level, and search
 */

import { useState } from 'react';
import { Card, Button } from '../ui';

interface CoverageFiltersProps {
  types: string[];
  selectedTypes: string[];
  onTypeChange: (types: string[]) => void;
  selectedRisks: string[];
  onRiskChange: (risks: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearAll: () => void;
}

const RISK_LEVELS = [
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700 border-green-200' },
];

export function CoverageFilters({
  types,
  selectedTypes,
  onTypeChange,
  selectedRisks,
  onRiskChange,
  searchQuery,
  onSearchChange,
  onClearAll,
}: CoverageFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypeChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypeChange([...selectedTypes, type]);
    }
  };

  const toggleRisk = (risk: string) => {
    if (selectedRisks.includes(risk)) {
      onRiskChange(selectedRisks.filter((r) => r !== risk));
    } else {
      onRiskChange([...selectedRisks, risk]);
    }
  };

  const hasFilters = selectedTypes.length > 0 || selectedRisks.length > 0 || searchQuery.length > 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Filters</h3>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={onClearAll}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Search */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search gaps..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Risk Level</label>
            <div className="flex flex-wrap gap-2">
              {RISK_LEVELS.map((risk) => (
                <button
                  key={risk.value}
                  onClick={() => toggleRisk(risk.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    selectedRisks.includes(risk.value)
                      ? risk.color
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {risk.label}
                </button>
              ))}
            </div>
          </div>

          {/* Coverage Type */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Coverage Type</label>
            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    selectedTypes.includes(type)
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasFilters && (
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {selectedTypes.length + selectedRisks.length + (searchQuery ? 1 : 0)} filter(s) active
                </span>
                <Button variant="secondary" onClick={onClearAll} className="text-xs py-1 px-2">
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
