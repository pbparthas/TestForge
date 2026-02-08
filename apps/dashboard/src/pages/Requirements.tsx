/**
 * Requirements Page
 * Full CRUD with search, filters, and traceability
 */

import { useState, useMemo } from 'react';
import { useProjectStore } from '../stores/project';
import { useRequirements, useCreateRequirement, useUpdateRequirement } from '../hooks/queries';
import { Card, Button, StatusBadge, PriorityBadge, Input } from '../components/ui';
import { Search, Plus, Filter, Link as LinkIcon, X } from 'lucide-react';
import type { Requirement } from '../types';

export function RequirementsPage() {
  const { currentProject } = useProjectStore();
  const [page] = useState(1);
  const { data, isLoading } = useRequirements(currentProject?.id, page);
  const requirements = data?.items ?? [];
  const createRequirement = useCreateRequirement();
  const updateRequirement = useUpdateRequirement();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    externalId: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    source: '',
    externalId: '',
  });

  const filteredRequirements = useMemo(() => {
    let filtered = [...requirements];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.externalId?.toLowerCase().includes(query)
      );
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(r => r.priority === priorityFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    return filtered;
  }, [requirements, searchQuery, priorityFilter, statusFilter]);

  const handleCreate = () => {
    setEditingRequirement(null);
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      source: '',
      externalId: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (requirement: Requirement) => {
    setEditingRequirement(requirement);
    setFormData({
      title: requirement.title,
      description: requirement.description || '',
      priority: requirement.priority,
      source: requirement.source || '',
      externalId: requirement.externalId || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRequirement) {
        await updateRequirement.mutateAsync({ id: editingRequirement.id, updates: formData });
      } else {
        await createRequirement.mutateAsync({ ...formData, projectId: currentProject!.id });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save requirement', err);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
    setStatusFilter('all');
  };

  if (!currentProject) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">Please select a project from the dashboard</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requirements</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredRequirements.length} of {requirements.length} requirements
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Requirement
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requirements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Toggle */}
          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {(priorityFilter !== 'all' || statusFilter !== 'all') && (
              <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4 items-center">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>

            {(priorityFilter !== 'all' || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Requirements List */}
      <Card>
        {isLoading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : filteredRequirements.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {requirements.length === 0 ? 'No requirements yet' : 'No requirements match your filters'}
            </p>
            {requirements.length === 0 && (
              <Button className="mt-4" onClick={handleCreate}>
                Create First Requirement
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequirements.map((req) => (
              <div
                key={req.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleEdit(req)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {req.externalId && (
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {req.externalId}
                        </span>
                      )}
                      <h3 className="font-medium text-gray-900">{req.title}</h3>
                    </div>
                    {req.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{req.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {req.source && <span>Source: {req.source}</span>}
                      {req._count?.testCases !== undefined && (
                        <span className="flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" />
                          {req._count.testCases} linked test cases
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <PriorityBadge priority={req.priority} />
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRequirement ? 'Edit Requirement' : 'Create Requirement'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <Input
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter requirement title"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the requirement..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder="e.g., JIRA, PRD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <Input
                label="External ID"
                value={formData.externalId}
                onChange={(e) => setFormData({ ...formData, externalId: e.target.value })}
                placeholder="e.g., JIRA-123"
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRequirement ? 'Save Changes' : 'Create Requirement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
