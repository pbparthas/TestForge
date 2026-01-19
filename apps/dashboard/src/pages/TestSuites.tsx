/**
 * Test Suites Page
 * Full CRUD with search, filters, and test case management
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, StatusBadge, Input } from '../components/ui';
import { Search, Plus, FolderOpen, Play, ChevronRight, X, Copy } from 'lucide-react';
import type { TestSuite } from '../types';

export function TestSuitesPage() {
  const { currentProject } = useProjectStore();
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [filteredSuites, setFilteredSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: '',
  });

  useEffect(() => {
    if (currentProject) {
      loadSuites();
    }
  }, [currentProject]);

  useEffect(() => {
    applyFilters();
  }, [suites, searchQuery, statusFilter]);

  const loadSuites = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const response = await api.getTestSuites(1, 100, currentProject.id);
      const items = response.data?.data || response.data?.items || response.data || [];
      setSuites(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load test suites', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...suites];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    setFilteredSuites(filtered);
  };

  const handleCreate = () => {
    setEditingSuite(null);
    setFormData({
      name: '',
      description: '',
      tags: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (suite: TestSuite, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSuite(suite);
    setFormData({
      name: suite.name,
      description: suite.description || '',
      tags: suite.tags?.join(', ') || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      };

      if (editingSuite) {
        await api.updateTestSuite(editingSuite.id, data);
      } else {
        await api.createTestSuite({ ...data, projectId: currentProject!.id });
      }
      setIsModalOpen(false);
      loadSuites();
    } catch (err) {
      console.error('Failed to save test suite', err);
    }
  };

  const handleDuplicate = async (suite: TestSuite, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.duplicateTestSuite(suite.id);
      loadSuites();
    } catch (err) {
      console.error('Failed to duplicate suite', err);
    }
  };

  const handleRunSuite = async (suite: TestSuite, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.triggerExecution(currentProject!.id, suite.id);
      window.location.href = '/executions';
    } catch (err) {
      console.error('Failed to run suite', err);
    }
  };

  const toggleExpand = (suiteId: string) => {
    setExpandedSuite(expandedSuite === suiteId ? null : suiteId);
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
          <h1 className="text-2xl font-bold text-gray-900">Test Suites</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredSuites.length} suites
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create Suite
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </Card>

      {/* Suites List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <p className="text-center py-8 text-gray-500">Loading...</p>
          </Card>
        ) : filteredSuites.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {suites.length === 0 ? 'No test suites yet' : 'No suites match your search'}
              </p>
              {suites.length === 0 && (
                <Button className="mt-4" onClick={handleCreate}>
                  Create First Suite
                </Button>
              )}
            </div>
          </Card>
        ) : (
          filteredSuites.map((suite) => (
            <Card key={suite.id} className="overflow-hidden">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpand(suite.id)}
              >
                <div className="flex items-center gap-3">
                  <ChevronRight
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedSuite === suite.id ? 'rotate-90' : ''
                    }`}
                  />
                  <FolderOpen className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="font-medium text-gray-900">{suite.name}</h3>
                    {suite.description && (
                      <p className="text-sm text-gray-500">{suite.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {suite._count?.testCases || 0} test cases
                  </span>
                  <StatusBadge status={suite.status} />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleRunSuite(suite, e)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Run Suite"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDuplicate(suite, e)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleEdit(suite, e)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <span className="text-sm">Edit</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedSuite === suite.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {suite.tags && suite.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {suite.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {suite.testCases && suite.testCases.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Test Cases:</h4>
                      {suite.testCases.slice(0, 5).map((tc: any) => (
                        <div
                          key={tc.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                        >
                          <span className="text-gray-700">{tc.title}</span>
                          <StatusBadge status={tc.status} />
                        </div>
                      ))}
                      {suite.testCases.length > 5 && (
                        <p className="text-sm text-gray-500">
                          +{suite.testCases.length - 5} more test cases
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No test cases in this suite</p>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingSuite ? 'Edit Test Suite' : 'Create Test Suite'}
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
                label="Suite Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter suite name"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the test suite..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Input
                label="Tags (comma-separated)"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., smoke, regression, login"
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingSuite ? 'Save Changes' : 'Create Suite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
