/**
 * FilterPanel Component
 * Filters for requirements: Method, Status, Priority, Search
 */

import { cn } from '../../utils/cn';
import { Search, X, Filter } from 'lucide-react';
import type { HttpMethod, RequirementStatus, RequirementPriority } from './RequirementsTable';

export interface RequirementFilters {
  search: string;
  methods: HttpMethod[];
  statuses: RequirementStatus[];
  priorities: RequirementPriority[];
}

interface FilterPanelProps {
  filters: RequirementFilters;
  onFiltersChange: (filters: RequirementFilters) => void;
  totalCount: number;
  filteredCount: number;
}

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const statuses: RequirementStatus[] = ['active', 'inactive', 'done', 'deprecated'];
const priorities: RequirementPriority[] = ['critical', 'high', 'medium', 'low'];

const methodColors: Record<HttpMethod, { active: string; inactive: string }> = {
  GET: { active: 'bg-blue-500 text-white', inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  POST: { active: 'bg-green-500 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100' },
  PUT: { active: 'bg-yellow-500 text-white', inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  DELETE: { active: 'bg-red-500 text-white', inactive: 'bg-red-50 text-red-700 hover:bg-red-100' },
  PATCH: { active: 'bg-purple-500 text-white', inactive: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
};

const statusColors: Record<RequirementStatus, { active: string; inactive: string }> = {
  active: { active: 'bg-green-500 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100' },
  inactive: { active: 'bg-gray-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  done: { active: 'bg-blue-500 text-white', inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  deprecated: { active: 'bg-red-500 text-white', inactive: 'bg-red-50 text-red-700 hover:bg-red-100' },
};

const priorityColors: Record<RequirementPriority, { active: string; inactive: string }> = {
  critical: { active: 'bg-red-500 text-white', inactive: 'bg-red-50 text-red-700 hover:bg-red-100' },
  high: { active: 'bg-orange-500 text-white', inactive: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
  medium: { active: 'bg-yellow-500 text-white', inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  low: { active: 'bg-gray-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
};

export function FilterPanel({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}: FilterPanelProps) {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.methods.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0;

  const toggleMethod = (method: HttpMethod) => {
    const newMethods = filters.methods.includes(method)
      ? filters.methods.filter(m => m !== method)
      : [...filters.methods, method];
    onFiltersChange({ ...filters, methods: newMethods });
  };

  const toggleStatus = (status: RequirementStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const togglePriority = (priority: RequirementPriority) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority];
    onFiltersChange({ ...filters, priorities: newPriorities });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      methods: [],
      statuses: [],
      priorities: [],
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
              Active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Search endpoints, titles..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Method Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">HTTP Method</label>
        <div className="flex flex-wrap gap-1">
          {httpMethods.map(method => (
            <button
              key={method}
              onClick={() => toggleMethod(method)}
              className={cn(
                'px-2 py-1 text-xs font-bold rounded transition-colors',
                filters.methods.includes(method)
                  ? methodColors[method].active
                  : methodColors[method].inactive
              )}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Status</label>
        <div className="flex flex-wrap gap-1">
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded capitalize transition-colors',
                filters.statuses.includes(status)
                  ? statusColors[status].active
                  : statusColors[status].inactive
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Priority Filter */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Priority</label>
        <div className="flex flex-wrap gap-1">
          {priorities.map(priority => (
            <button
              key={priority}
              onClick={() => togglePriority(priority)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded capitalize transition-colors',
                filters.priorities.includes(priority)
                  ? priorityColors[priority].active
                  : priorityColors[priority].inactive
              )}
            >
              {priority}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Showing <span className="font-medium text-gray-700">{filteredCount}</span> of{' '}
          <span className="font-medium text-gray-700">{totalCount}</span> requirements
        </p>
      </div>
    </div>
  );
}
