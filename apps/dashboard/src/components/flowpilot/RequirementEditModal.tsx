/**
 * RequirementEditModal Component
 * Modal for creating/editing API requirements
 */

import { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { X, Save } from 'lucide-react';
import { Button } from '../ui';
import type { ApiRequirement, HttpMethod, RequirementType, RequirementPriority, RequirementStatus } from './RequirementsTable';

interface RequirementEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (requirement: Partial<ApiRequirement>) => void;
  requirement?: ApiRequirement | null;
  isLoading?: boolean;
}

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const requirementTypes: RequirementType[] = ['functional', 'integration', 'security', 'performance'];
const priorities: RequirementPriority[] = ['critical', 'high', 'medium', 'low'];
const statuses: RequirementStatus[] = ['active', 'inactive', 'done', 'deprecated'];

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-blue-100 text-blue-700 border-blue-300',
  POST: 'bg-green-100 text-green-700 border-green-300',
  PUT: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  DELETE: 'bg-red-100 text-red-700 border-red-300',
  PATCH: 'bg-purple-100 text-purple-700 border-purple-300',
};

export function RequirementEditModal({
  isOpen,
  onClose,
  onSave,
  requirement,
  isLoading,
}: RequirementEditModalProps) {
  const [formData, setFormData] = useState({
    method: 'GET' as HttpMethod,
    endpoint: '',
    title: '',
    description: '',
    type: 'functional' as RequirementType,
    priority: 'medium' as RequirementPriority,
    status: 'active' as RequirementStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!requirement;

  useEffect(() => {
    if (requirement) {
      setFormData({
        method: requirement.method,
        endpoint: requirement.endpoint,
        title: requirement.title,
        description: requirement.description || '',
        type: requirement.type,
        priority: requirement.priority,
        status: requirement.status,
      });
    } else {
      setFormData({
        method: 'GET',
        endpoint: '',
        title: '',
        description: '',
        type: 'functional',
        priority: 'medium',
        status: 'active',
      });
    }
    setErrors({});
  }, [requirement, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.endpoint.trim()) {
      newErrors.endpoint = 'Endpoint is required';
    } else if (!formData.endpoint.startsWith('/')) {
      newErrors.endpoint = 'Endpoint must start with /';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      ...formData,
      id: requirement?.id,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Requirement' : 'New Requirement'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HTTP Method
              </label>
              <div className="flex flex-wrap gap-2">
                {httpMethods.map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, method }))}
                    className={cn(
                      'px-3 py-1.5 text-sm font-bold rounded border-2 transition-all',
                      formData.method === method
                        ? cn(methodColors[method], 'ring-2 ring-offset-1 ring-gray-400')
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Endpoint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endpoint <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.endpoint}
                onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder="/api/v1/users"
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500',
                  errors.endpoint ? 'border-red-300' : 'border-gray-300'
                )}
              />
              {errors.endpoint && (
                <p className="text-xs text-red-600 mt-1">{errors.endpoint}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Create new user"
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500',
                  errors.title ? 'border-red-300' : 'border-gray-300'
                )}
              />
              {errors.title && (
                <p className="text-xs text-red-600 mt-1">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description of the API requirement..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as RequirementType }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {requirementTypes.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as RequirementPriority }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {priorities.map(priority => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as RequirementStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {isEditing ? 'Save Changes' : 'Create Requirement'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
