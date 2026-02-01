/**
 * AdvancedFilters Component
 * 7 filter options for test cases
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  User,
  Tag,
  RotateCcw,
} from 'lucide-react';

export interface TestCaseFilters {
  search: string;
  types: string[];
  priorities: string[];
  statuses: string[];
  suites: string[];
  tags: string[];
  dateRange: {
    from: string;
    to: string;
  } | null;
  assignee: string;
}

export interface AdvancedFiltersProps {
  filters: TestCaseFilters;
  onFiltersChange: (filters: TestCaseFilters) => void;
  availableSuites: { id: string; name: string }[];
  availableTags: string[];
  availableAssignees: { id: string; name: string }[];
  totalCount: number;
  filteredCount: number;
}

const typeOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'automated', label: 'Automated' },
  { value: 'hybrid', label: 'Hybrid' },
];

const priorityOptions = [
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
];

const statusOptions = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'archived', label: 'Archived', color: 'bg-purple-100 text-purple-700' },
];

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function FilterSection({ title, icon, children, defaultExpanded = true }: FilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface ChipSelectProps {
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function ChipSelect({ options, selected, onChange }: ChipSelectProps) {
  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => toggleOption(option.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
            selected.includes(option.value)
              ? option.color
                ? `${option.color} border-transparent ring-2 ring-offset-1 ring-current`
                : 'bg-blue-100 text-blue-700 border-blue-200'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableSuites,
  availableTags,
  availableAssignees,
  totalCount,
  filteredCount,
}: AdvancedFiltersProps) {
  const updateFilter = <K extends keyof TestCaseFilters>(
    key: K,
    value: TestCaseFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      types: [],
      priorities: [],
      statuses: [],
      suites: [],
      tags: [],
      dateRange: null,
      assignee: '',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    filters.suites.length > 0 ||
    filters.tags.length > 0 ||
    filters.dateRange !== null ||
    filters.assignee;

  const activeFilterCount = [
    filters.types.length > 0,
    filters.priorities.length > 0,
    filters.statuses.length > 0,
    filters.suites.length > 0,
    filters.tags.length > 0,
    filters.dateRange !== null,
    !!filters.assignee,
  ].filter(Boolean).length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Showing {filteredCount} of {totalCount} test cases
        </p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search test cases..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Sections */}
      <div className="divide-y divide-gray-200">
        {/* 1. Type Filter */}
        <FilterSection
          title="Type"
          icon={<div className="w-3 h-3 rounded-sm bg-blue-500" />}
        >
          <ChipSelect
            options={typeOptions}
            selected={filters.types}
            onChange={(types) => updateFilter('types', types)}
          />
        </FilterSection>

        {/* 2. Priority Filter */}
        <FilterSection
          title="Priority"
          icon={<div className="w-3 h-3 rounded-full bg-orange-500" />}
        >
          <ChipSelect
            options={priorityOptions}
            selected={filters.priorities}
            onChange={(priorities) => updateFilter('priorities', priorities)}
          />
        </FilterSection>

        {/* 3. Status Filter */}
        <FilterSection
          title="Status"
          icon={<div className="w-3 h-3 rounded-full bg-green-500" />}
        >
          <ChipSelect
            options={statusOptions}
            selected={filters.statuses}
            onChange={(statuses) => updateFilter('statuses', statuses)}
          />
        </FilterSection>

        {/* 4. Test Suite Filter */}
        <FilterSection
          title="Test Suite"
          icon={<div className="w-3 h-3 rounded-sm bg-purple-500" />}
          defaultExpanded={false}
        >
          {availableSuites.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {availableSuites.map(suite => (
                <label key={suite.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.suites.includes(suite.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFilter('suites', [...filters.suites, suite.id]);
                      } else {
                        updateFilter('suites', filters.suites.filter(id => id !== suite.id));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{suite.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No test suites available</p>
          )}
        </FilterSection>

        {/* 5. Tags Filter */}
        <FilterSection
          title="Tags"
          icon={<Tag className="w-3 h-3 text-gray-500" />}
          defaultExpanded={false}
        >
          {availableTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    if (filters.tags.includes(tag)) {
                      updateFilter('tags', filters.tags.filter(t => t !== tag));
                    } else {
                      updateFilter('tags', [...filters.tags, tag]);
                    }
                  }}
                  className={cn(
                    'px-2 py-1 text-xs rounded border transition-colors',
                    filters.tags.includes(tag)
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No tags available</p>
          )}
        </FilterSection>

        {/* 6. Date Range Filter */}
        <FilterSection
          title="Date Modified"
          icon={<Calendar className="w-3 h-3 text-gray-500" />}
          defaultExpanded={false}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={filters.dateRange?.from || ''}
                onChange={(e) => {
                  updateFilter('dateRange', {
                    from: e.target.value,
                    to: filters.dateRange?.to || '',
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={filters.dateRange?.to || ''}
                onChange={(e) => {
                  updateFilter('dateRange', {
                    from: filters.dateRange?.from || '',
                    to: e.target.value,
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {filters.dateRange && (
              <button
                onClick={() => updateFilter('dateRange', null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear date range
              </button>
            )}
          </div>
        </FilterSection>

        {/* 7. Assignee Filter */}
        <FilterSection
          title="Assignee"
          icon={<User className="w-3 h-3 text-gray-500" />}
          defaultExpanded={false}
        >
          <select
            value={filters.assignee}
            onChange={(e) => updateFilter('assignee', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {availableAssignees.map(assignee => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name}
              </option>
            ))}
          </select>
        </FilterSection>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {filters.types.map(type => (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {type}
                <button onClick={() => updateFilter('types', filters.types.filter(t => t !== type))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.priorities.map(priority => (
              <span
                key={priority}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded"
              >
                {priority}
                <button onClick={() => updateFilter('priorities', filters.priorities.filter(p => p !== priority))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.statuses.map(status => (
              <span
                key={status}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded"
              >
                {status}
                <button onClick={() => updateFilter('statuses', filters.statuses.filter(s => s !== status))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
