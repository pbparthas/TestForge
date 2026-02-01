/**
 * FlowPilot Page
 * API Requirements Management
 */

import { useState, useMemo } from 'react';
import { useProjectStore } from '../stores/project';
import { Card, Button } from '../components/ui';
import { Compass, Plus, FileJson, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import {
  RequirementsTable,
  RequirementEditModal,
  RequirementHistoryPanel,
  FilterPanel,
} from '../components/flowpilot';
import type {
  ApiRequirement,
  RequirementFilters,
} from '../components/flowpilot';

// Demo data
const generateDemoRequirements = (): ApiRequirement[] => [
  {
    id: '1',
    method: 'POST',
    endpoint: '/api/v1/users',
    title: 'Create new user',
    description: 'Creates a new user account with email verification',
    type: 'functional',
    priority: 'high',
    status: 'active',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-28T14:30:00Z',
    createdBy: 'admin',
    history: [
      { id: 'h1', timestamp: '2026-01-28T14:30:00Z', user: 'admin', field: 'priority', oldValue: 'medium', newValue: 'high' },
      { id: 'h2', timestamp: '2026-01-20T09:15:00Z', user: 'admin', field: 'status', oldValue: 'inactive', newValue: 'active' },
    ],
  },
  {
    id: '2',
    method: 'GET',
    endpoint: '/api/v1/users/{id}',
    title: 'Get user by ID',
    description: 'Retrieves user details by user ID',
    type: 'functional',
    priority: 'medium',
    status: 'active',
    createdAt: '2026-01-15T10:05:00Z',
    updatedAt: '2026-01-25T11:00:00Z',
    createdBy: 'admin',
    history: [],
  },
  {
    id: '3',
    method: 'PUT',
    endpoint: '/api/v1/users/{id}',
    title: 'Update user profile',
    description: 'Updates user profile information',
    type: 'functional',
    priority: 'medium',
    status: 'active',
    createdAt: '2026-01-15T10:10:00Z',
    updatedAt: '2026-01-15T10:10:00Z',
    createdBy: 'admin',
    history: [],
  },
  {
    id: '4',
    method: 'DELETE',
    endpoint: '/api/v1/users/{id}',
    title: 'Delete user account',
    description: 'Soft deletes a user account',
    type: 'functional',
    priority: 'low',
    status: 'active',
    createdAt: '2026-01-15T10:15:00Z',
    updatedAt: '2026-01-15T10:15:00Z',
    createdBy: 'admin',
    history: [],
  },
  {
    id: '5',
    method: 'POST',
    endpoint: '/api/v1/auth/login',
    title: 'User authentication',
    description: 'Authenticates user and returns JWT token',
    type: 'security',
    priority: 'critical',
    status: 'active',
    createdAt: '2026-01-14T09:00:00Z',
    updatedAt: '2026-01-30T16:45:00Z',
    createdBy: 'admin',
    history: [
      { id: 'h3', timestamp: '2026-01-30T16:45:00Z', user: 'admin', field: 'priority', oldValue: 'high', newValue: 'critical' },
    ],
  },
  {
    id: '6',
    method: 'POST',
    endpoint: '/api/v1/auth/refresh',
    title: 'Refresh access token',
    description: 'Refreshes JWT access token using refresh token',
    type: 'security',
    priority: 'high',
    status: 'active',
    createdAt: '2026-01-14T09:05:00Z',
    updatedAt: '2026-01-14T09:05:00Z',
    createdBy: 'admin',
    history: [],
  },
  {
    id: '7',
    method: 'GET',
    endpoint: '/api/v1/products',
    title: 'List products',
    description: 'Returns paginated list of products with filters',
    type: 'functional',
    priority: 'high',
    status: 'done',
    createdAt: '2026-01-16T14:00:00Z',
    updatedAt: '2026-01-29T10:00:00Z',
    createdBy: 'admin',
    history: [
      { id: 'h4', timestamp: '2026-01-29T10:00:00Z', user: 'admin', field: 'status', oldValue: 'active', newValue: 'done' },
    ],
  },
  {
    id: '8',
    method: 'GET',
    endpoint: '/api/v1/health',
    title: 'Health check endpoint',
    description: 'Returns API health status',
    type: 'integration',
    priority: 'low',
    status: 'done',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
    createdBy: 'admin',
    history: [],
  },
  {
    id: '9',
    method: 'PATCH',
    endpoint: '/api/v1/users/{id}/settings',
    title: 'Update user settings',
    description: 'Partially updates user settings',
    type: 'functional',
    priority: 'medium',
    status: 'inactive',
    createdAt: '2026-01-18T11:30:00Z',
    updatedAt: '2026-01-27T09:00:00Z',
    createdBy: 'admin',
    history: [],
  },
  {
    id: '10',
    method: 'GET',
    endpoint: '/api/v1/metrics',
    title: 'Performance metrics',
    description: 'Returns performance metrics for monitoring',
    type: 'performance',
    priority: 'medium',
    status: 'active',
    createdAt: '2026-01-20T15:00:00Z',
    updatedAt: '2026-01-20T15:00:00Z',
    createdBy: 'admin',
    history: [],
  },
];

export function FlowPilotPage() {
  const { currentProject } = useProjectStore();

  // Requirements state
  const [requirements, setRequirements] = useState<ApiRequirement[]>(generateDemoRequirements);

  // Filter state
  const [filters, setFilters] = useState<RequirementFilters>({
    search: '',
    methods: [],
    statuses: [],
    priorities: [],
  });

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<ApiRequirement | null>(null);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyRequirement, setHistoryRequirement] = useState<ApiRequirement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter(req => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          req.endpoint.toLowerCase().includes(searchLower) ||
          req.title.toLowerCase().includes(searchLower) ||
          req.description?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Method filter
      if (filters.methods.length > 0 && !filters.methods.includes(req.method)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(req.status)) {
        return false;
      }

      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(req.priority)) {
        return false;
      }

      return true;
    });
  }, [requirements, filters]);

  // Stats
  const stats = useMemo(() => {
    const total = requirements.length;
    const active = requirements.filter(r => r.status === 'active').length;
    const completed = requirements.filter(r => r.status === 'done').length;
    const highPriority = requirements.filter(r => r.priority === 'critical' || r.priority === 'high').length;
    return { total, active, completed, highPriority };
  }, [requirements]);

  const handleEdit = (requirement: ApiRequirement) => {
    setSelectedRequirement(requirement);
    setEditModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedRequirement(null);
    setEditModalOpen(true);
  };

  const handleDelete = (requirementId: string) => {
    if (confirm('Are you sure you want to delete this requirement?')) {
      setRequirements(prev => prev.filter(r => r.id !== requirementId));
    }
  };

  const handleViewHistory = (requirement: ApiRequirement) => {
    setHistoryRequirement(requirement);
    setHistoryPanelOpen(true);
  };

  const handleSave = async (data: Partial<ApiRequirement>) => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      if (data.id) {
        // Update existing
        setRequirements(prev => prev.map(r =>
          r.id === data.id
            ? { ...r, ...data, updatedAt: new Date().toISOString() }
            : r
        ));
      } else {
        // Create new
        const newRequirement: ApiRequirement = {
          id: `${Date.now()}`,
          method: data.method || 'GET',
          endpoint: data.endpoint || '',
          title: data.title || '',
          description: data.description,
          type: data.type || 'functional',
          priority: data.priority || 'medium',
          status: data.status || 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current-user',
          history: [],
        };
        setRequirements(prev => [newRequirement, ...prev]);
      }
      setEditModalOpen(false);
    } finally {
      setIsSaving(false);
    }
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FlowPilot</h1>
            <p className="text-sm text-gray-500">API Requirements Management</p>
          </div>
        </div>
        <Button onClick={handleCreate} className="bg-orange-600 hover:bg-orange-700">
          <Plus className="w-4 h-4 mr-2" />
          New Requirement
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileJson className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Requirements</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.highPriority}</p>
              <p className="text-xs text-gray-500">High Priority</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="col-span-1">
          <FilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={requirements.length}
            filteredCount={filteredRequirements.length}
          />
        </div>

        {/* Requirements Table */}
        <div className="col-span-3">
          <Card>
            <RequirementsTable
              requirements={filteredRequirements}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onViewHistory={handleViewHistory}
            />
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <RequirementEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
        requirement={selectedRequirement}
        isLoading={isSaving}
      />

      {/* History Panel */}
      <RequirementHistoryPanel
        isOpen={historyPanelOpen}
        onClose={() => setHistoryPanelOpen(false)}
        requirement={historyRequirement}
      />
    </div>
  );
}
