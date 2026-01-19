/**
 * Test Cases Page
 * Full CRUD with search, filters, and modals
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, StatusBadge, PriorityBadge, Input } from '../components/ui';
import { Search, Plus, Filter, X, Edit, Copy } from 'lucide-react';
import type { TestCase } from '../types';

export function TestCasesPage() {
  const { currentProject } = useProjectStore();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [filteredTestCases, setFilteredTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    type: 'manual' | 'automated' | 'hybrid';
    priority: 'low' | 'medium' | 'high' | 'critical';
    steps: string;
    expectedResult: string;
  }>({
    title: '',
    description: '',
    type: 'manual',
    priority: 'medium',
    steps: '',
    expectedResult: '',
  });

  useEffect(() => {
    if (currentProject) {
      loadTestCases();
    }
  }, [currentProject, page]);

  useEffect(() => {
    applyFilters();
  }, [testCases, searchQuery, typeFilter, priorityFilter, statusFilter]);

  const loadTestCases = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const response = await api.getTestCases(page, 100, currentProject.id);
      const items = response.data?.data || response.data?.items || response.data || [];
      setTestCases(Array.isArray(items) ? items : []);
      setTotal(response.data?.total || items.length);
    } catch (err) {
      console.error('Failed to load test cases', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...testCases];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tc =>
        tc.title.toLowerCase().includes(query) ||
        tc.description?.toLowerCase().includes(query)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(tc => tc.type === typeFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(tc => tc.priority === priorityFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(tc => tc.status === statusFilter);
    }

    setFilteredTestCases(filtered);
  };

  const handleCreate = () => {
    setEditingTestCase(null);
    setFormData({
      title: '',
      description: '',
      type: 'manual',
      priority: 'medium',
      steps: '',
      expectedResult: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (testCase: TestCase) => {
    setEditingTestCase(testCase);
    setFormData({
      title: testCase.title,
      description: testCase.description || '',
      type: testCase.type,
      priority: testCase.priority,
      steps: testCase.steps?.map(s => s.action).join('\n') || '',
      expectedResult: testCase.expectedResult || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const stepsArray = formData.steps.split('\n').filter(s => s.trim()).map((action, i) => ({
        order: i + 1,
        action: action.trim(),
      }));

      const data = {
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        priority: formData.priority,
        steps: stepsArray,
        expectedResult: formData.expectedResult || undefined,
      };

      if (editingTestCase) {
        await api.updateTestCase(editingTestCase.id, data);
      } else {
        await api.createTestCase({ ...data, projectId: currentProject!.id });
      }
      setIsModalOpen(false);
      loadTestCases();
    } catch (err) {
      console.error('Failed to save test case', err);
    }
  };

  const handleDuplicate = async (testCase: TestCase) => {
    try {
      const data = {
        projectId: currentProject!.id,
        title: `${testCase.title} (Copy)`,
        description: testCase.description,
        type: testCase.type,
        priority: testCase.priority,
        steps: testCase.steps,
        expectedResult: testCase.expectedResult,
      };
      await api.createTestCase(data);
      loadTestCases();
    } catch (err) {
      console.error('Failed to duplicate test case', err);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = typeFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all';

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
          <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredTestCases.length} of {testCases.length} test cases
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.location.href = '/ai'}>
            Generate with AI
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Test Case
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search test cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Toggle */}
          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4 items-center">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              <option value="manual">Manual</option>
              <option value="automated">Automated</option>
              <option value="hybrid">Hybrid</option>
            </select>

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

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Test Cases List */}
      <Card>
        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : filteredTestCases.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {testCases.length === 0 ? 'No test cases yet' : 'No test cases match your filters'}
            </p>
            {testCases.length === 0 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button onClick={handleCreate}>Create Test Case</Button>
                <Button variant="secondary" onClick={() => window.location.href = '/ai'}>
                  Generate with AI
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Title</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Priority</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Updated</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTestCases.map((tc) => (
                    <tr key={tc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{tc.title}</div>
                        {tc.description && (
                          <div className="text-sm text-gray-500 truncate max-w-md">{tc.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 capitalize">{tc.type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <PriorityBadge priority={tc.priority} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={tc.status} />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(tc.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(tc)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(tc)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 100 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {page} of {Math.ceil(total / 100)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page * 100 >= total}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTestCase ? 'Edit Test Case' : 'Create Test Case'}
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
                placeholder="Enter test case title"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this test case validates..."
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="automated">Automated</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Steps (one per line)
                </label>
                <textarea
                  value={formData.steps}
                  onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                  placeholder="Step 1: Navigate to login page&#10;Step 2: Enter username&#10;Step 3: Enter password&#10;Step 4: Click submit"
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Result
                </label>
                <textarea
                  value={formData.expectedResult}
                  onChange={(e) => setFormData({ ...formData, expectedResult: e.target.value })}
                  placeholder="What should happen when the test passes?"
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTestCase ? 'Save Changes' : 'Create Test Case'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
