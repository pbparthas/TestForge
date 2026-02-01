/**
 * RequirementsTable Component
 * 7-column table for API requirements with sorting and pagination
 */

import { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { ChevronUp, ChevronDown, Edit2, Trash2, History } from 'lucide-react';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type RequirementType = 'functional' | 'integration' | 'security' | 'performance';
export type RequirementPriority = 'critical' | 'high' | 'medium' | 'low';
export type RequirementStatus = 'active' | 'inactive' | 'done' | 'deprecated';

export interface ApiRequirement {
  id: string;
  method: HttpMethod;
  endpoint: string;
  title: string;
  description?: string;
  type: RequirementType;
  priority: RequirementPriority;
  status: RequirementStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  history?: RequirementHistoryEntry[];
}

export interface RequirementHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  field: string;
  oldValue: string;
  newValue: string;
}

type SortField = 'method' | 'endpoint' | 'title' | 'type' | 'priority' | 'status' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

interface RequirementsTableProps {
  requirements: ApiRequirement[];
  onEdit: (requirement: ApiRequirement) => void;
  onDelete: (requirementId: string) => void;
  onViewHistory: (requirement: ApiRequirement) => void;
  pageSize?: number;
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-blue-100 text-blue-700 border-blue-200',
  POST: 'bg-green-100 text-green-700 border-green-200',
  PUT: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
  PATCH: 'bg-purple-100 text-purple-700 border-purple-200',
};

const priorityColors: Record<RequirementPriority, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-700',
};

const statusColors: Record<RequirementStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  done: 'bg-blue-100 text-blue-700',
  deprecated: 'bg-red-100 text-red-700',
};

const typeColors: Record<RequirementType, string> = {
  functional: 'bg-indigo-100 text-indigo-700',
  integration: 'bg-cyan-100 text-cyan-700',
  security: 'bg-rose-100 text-rose-700',
  performance: 'bg-amber-100 text-amber-700',
};

export function RequirementsTable({
  requirements,
  onEdit,
  onDelete,
  onViewHistory,
  pageSize = 10,
}: RequirementsTableProps) {
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedRequirements = useMemo(() => {
    return [...requirements].sort((a, b) => {
      let comparison = 0;
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [requirements, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedRequirements.length / pageSize);
  const paginatedRequirements = sortedRequirements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )
        )}
      </div>
    </th>
  );

  if (requirements.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="font-medium">No requirements found</p>
        <p className="text-sm mt-1">Create your first API requirement to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="method">Method</SortHeader>
              <SortHeader field="endpoint">Endpoint</SortHeader>
              <SortHeader field="title">Title</SortHeader>
              <SortHeader field="type">Type</SortHeader>
              <SortHeader field="priority">Priority</SortHeader>
              <SortHeader field="status">Status</SortHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedRequirements.map(req => (
              <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                {/* Method */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn(
                    'px-2 py-1 text-xs font-bold rounded border',
                    methodColors[req.method]
                  )}>
                    {req.method}
                  </span>
                </td>

                {/* Endpoint */}
                <td className="px-4 py-3">
                  <code className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                    {req.endpoint}
                  </code>
                </td>

                {/* Title */}
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-900">{req.title}</span>
                  {req.description && (
                    <p className="text-xs text-gray-500 truncate max-w-xs">{req.description}</p>
                  )}
                </td>

                {/* Type */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    typeColors[req.type]
                  )}>
                    {req.type}
                  </span>
                </td>

                {/* Priority */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    priorityColors[req.priority]
                  )}>
                    {req.priority}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    statusColors[req.status]
                  )}>
                    {req.status}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="relative">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(req)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onViewHistory(req)}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(req.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, requirements.length)} of {requirements.length} requirements
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={cn(
                'px-3 py-1.5 text-sm rounded border transition-colors',
                currentPage === 1
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'w-8 h-8 text-sm rounded transition-colors',
                  page === currentPage
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                'px-3 py-1.5 text-sm rounded border transition-colors',
                currentPage === totalPages
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
