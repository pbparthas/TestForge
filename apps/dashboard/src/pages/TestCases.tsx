/**
 * Test Cases Page
 * Full CRUD with bulk operations, version history, import/export
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Button, StatusBadge, PriorityBadge, Input } from '../components/ui';
import {
  Search,
  Plus,
  Filter,
  X,
  Edit,
  Copy,
  List,
  FolderTree,
  Upload,
  History,
  Keyboard,
} from 'lucide-react';
import {
  BulkActionsBar,
  TreeView,
  AdvancedFilters,
  VersionHistoryModal,
  ImportExportPanel,
  useKeyboardShortcuts,
  KeyboardShortcutsHelp,
} from '../components/testCases';
import type { TestCaseFilters, TestSuiteNode, TestCaseVersion, ImportResult, ExportFormat } from '../components/testCases';
import type { TestCase } from '../types';

type ViewMode = 'table' | 'tree';

export function TestCasesPage() {
  const { currentProject } = useProjectStore();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Tree view state
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  // Filters - using advanced filters structure
  const [filters, setFilters] = useState<TestCaseFilters>({
    search: '',
    types: [],
    priorities: [],
    statuses: [],
    suites: [],
    tags: [],
    dateRange: null,
    assignee: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
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

  // Version history
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionTestCase, setVersionTestCase] = useState<TestCase | null>(null);
  const [versions, setVersions] = useState<TestCaseVersion[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);

  // Import/Export
  const [importExportOpen, setImportExportOpen] = useState(false);

  // Keyboard shortcuts help
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Demo suites for tree view
  const testSuites: TestSuiteNode[] = useMemo(() => {
    const suiteMap = new Map<string, TestCase[]>();

    // Group test cases by a mock suite (using type for demo)
    testCases.forEach(tc => {
      const suiteKey = tc.type;
      if (!suiteMap.has(suiteKey)) {
        suiteMap.set(suiteKey, []);
      }
      suiteMap.get(suiteKey)!.push(tc);
    });

    return Array.from(suiteMap.entries()).map(([type, cases]) => ({
      id: type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Tests`,
      testCases: cases,
    }));
  }, [testCases]);

  // Available tags (demo)
  const availableTags = ['smoke', 'regression', 'api', 'ui', 'critical-path', 'performance'];

  // Available assignees (demo)
  const availableAssignees = [
    { id: 'user-1', name: 'John Doe' },
    { id: 'user-2', name: 'Jane Smith' },
    { id: 'user-3', name: 'Bob Wilson' },
  ];

  // Apply filters
  const filteredTestCases = useMemo(() => {
    let filtered = [...testCases];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(tc =>
        tc.title.toLowerCase().includes(query) ||
        tc.description?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filters.types.length > 0) {
      filtered = filtered.filter(tc => filters.types.includes(tc.type));
    }

    // Priority filter
    if (filters.priorities.length > 0) {
      filtered = filtered.filter(tc => filters.priorities.includes(tc.priority));
    }

    // Status filter
    if (filters.statuses.length > 0) {
      filtered = filtered.filter(tc => filters.statuses.includes(tc.status));
    }

    // Date range filter
    if (filters.dateRange?.from || filters.dateRange?.to) {
      filtered = filtered.filter(tc => {
        const updatedAt = new Date(tc.updatedAt);
        if (filters.dateRange?.from && updatedAt < new Date(filters.dateRange.from)) {
          return false;
        }
        if (filters.dateRange?.to && updatedAt > new Date(filters.dateRange.to)) {
          return false;
        }
        return true;
      });
    }

    return filtered;
  }, [testCases, filters]);

  // Keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts({
    enabled: true,
    onSelectAll: () => setSelectedIds(new Set(filteredTestCases.map(tc => tc.id))),
    onDeselectAll: () => setSelectedIds(new Set()),
    onCreate: () => handleCreate(),
    onDelete: () => handleBulkDelete(),
    onSearch: () => searchInputRef.current?.focus(),
    onExport: () => setImportExportOpen(true),
    onImport: () => setImportExportOpen(true),
    onDuplicate: () => handleBulkDuplicate(),
    onEdit: () => {
      if (selectedIds.size === 1) {
        const tc = testCases.find(t => selectedIds.has(t.id));
        if (tc) handleEdit(tc);
      }
    },
    onEscape: () => {
      if (isModalOpen) setIsModalOpen(false);
      else if (versionModalOpen) setVersionModalOpen(false);
      else if (importExportOpen) setImportExportOpen(false);
      else setSelectedIds(new Set());
    },
  });

  useEffect(() => {
    if (currentProject) {
      loadTestCases();
    }
  }, [currentProject, page]);

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

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} test case(s)?`)) return;

    try {
      // In production, batch API call - for now, archive instead
      for (const id of selectedIds) {
        await api.updateTestCase(id, { status: 'archived' });
      }
      setSelectedIds(new Set());
      loadTestCases();
    } catch (err) {
      console.error('Failed to delete test cases', err);
    }
  };

  const handleBulkMove = () => {
    // Open move to suite modal
    alert(`Move ${selectedIds.size} test case(s) to suite - coming soon`);
  };

  const handleBulkTag = () => {
    // Open tag modal
    alert(`Tag ${selectedIds.size} test case(s) - coming soon`);
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Archive ${selectedIds.size} test case(s)?`)) return;

    try {
      for (const id of selectedIds) {
        await api.updateTestCase(id, { status: 'archived' });
      }
      setSelectedIds(new Set());
      loadTestCases();
    } catch (err) {
      console.error('Failed to archive test cases', err);
    }
  };

  const handleBulkDuplicate = async () => {
    if (selectedIds.size === 0) return;

    try {
      for (const id of selectedIds) {
        const tc = testCases.find(t => t.id === id);
        if (tc) {
          await api.createTestCase({
            projectId: currentProject!.id,
            title: `${tc.title} (Copy)`,
            description: tc.description,
            steps: tc.steps,
          });
        }
      }
      setSelectedIds(new Set());
      loadTestCases();
    } catch (err) {
      console.error('Failed to duplicate test cases', err);
    }
  };

  const handleBulkExport = () => {
    setImportExportOpen(true);
  };

  // Version history
  const handleViewHistory = (testCase: TestCase) => {
    setVersionTestCase(testCase);
    // Demo versions
    setVersions([
      {
        id: 'v3',
        version: 3,
        testCaseId: testCase.id,
        title: testCase.title,
        description: testCase.description,
        type: testCase.type,
        priority: testCase.priority,
        status: 'active' as const,
        steps: testCase.steps || [],
        expectedResult: testCase.expectedResult,
        createdAt: testCase.updatedAt,
        createdBy: 'Current User',
        changeNote: 'Updated priority',
      },
      {
        id: 'v2',
        version: 2,
        testCaseId: testCase.id,
        title: testCase.title,
        description: 'Previous description',
        type: testCase.type,
        priority: 'medium',
        status: 'active' as const,
        steps: testCase.steps || [],
        expectedResult: testCase.expectedResult,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        createdBy: 'Admin',
        changeNote: 'Updated description',
      },
      {
        id: 'v1',
        version: 1,
        testCaseId: testCase.id,
        title: testCase.title,
        description: 'Initial version',
        type: 'manual',
        priority: 'low',
        status: 'draft',
        steps: [],
        expectedResult: '',
        createdAt: testCase.createdAt,
        createdBy: 'Admin',
      },
    ]);
    setVersionModalOpen(true);
  };

  const handleRestoreVersion = async (version: TestCaseVersion) => {
    setIsRestoring(true);
    try {
      // Restore version
      await api.updateTestCase(version.testCaseId, {
        title: version.title,
        description: version.description,
        type: version.type,
        priority: version.priority,
        steps: version.steps,
        expectedResult: version.expectedResult,
      });
      setVersionModalOpen(false);
      loadTestCases();
    } catch (err) {
      console.error('Failed to restore version', err);
    } finally {
      setIsRestoring(false);
    }
  };

  // Import/Export
  const handleImport = async (_file: File, _format: ExportFormat): Promise<ImportResult> => {
    // Mock import - in production, send to API
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      imported: 5,
      failed: 0,
      errors: [],
    };
  };

  const handleExport = async (format: ExportFormat) => {
    // Mock export - in production, call API and download
    await new Promise(resolve => setTimeout(resolve, 500));

    const data = selectedIds.size > 0
      ? testCases.filter(tc => selectedIds.has(tc.id))
      : testCases;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-cases.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Selection helpers
  const isAllSelected = filteredTestCases.length > 0 && selectedIds.size === filteredTestCases.length;

  const handleRowSelect = (testCaseId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(testCaseId)) {
      newSelection.delete(testCaseId);
    } else {
      newSelection.add(testCaseId);
    }
    setSelectedIds(newSelection);
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
          <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredTestCases.length} of {testCases.length} test cases
          </p>
        </div>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'tree' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Tree View"
            >
              <FolderTree className="w-4 h-4" />
            </button>
          </div>

          <Button variant="secondary" onClick={() => setImportExportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import/Export
          </Button>
          <Button variant="secondary" onClick={() => window.location.href = '/ai'}>
            Generate with AI
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Test Case
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={filteredTestCases.length}
        isAllSelected={isAllSelected}
        onSelectAll={() => setSelectedIds(new Set(filteredTestCases.map(tc => tc.id)))}
        onDeselectAll={() => setSelectedIds(new Set())}
        onBulkDelete={handleBulkDelete}
        onBulkMove={handleBulkMove}
        onBulkTag={handleBulkTag}
        onBulkArchive={handleBulkArchive}
        onBulkDuplicate={handleBulkDuplicate}
        onBulkExport={handleBulkExport}
      />

      {/* Main Content */}
      <div className="grid grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        {showFilters && (
          <div className="col-span-1">
            <AdvancedFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableSuites={testSuites.map(s => ({ id: s.id, name: s.name }))}
              availableTags={availableTags}
              availableAssignees={availableAssignees}
              totalCount={testCases.length}
              filteredCount={filteredTestCases.length}
            />
          </div>
        )}

        {/* Test Cases List/Tree */}
        <div className={showFilters ? 'col-span-3' : 'col-span-4'}>
          {/* Search Bar */}
          <Card className="mb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search test cases... (Ctrl+F)"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? 'Hide Filters' : 'Filters'}
              </Button>

              <button
                onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Keyboard Shortcuts"
              >
                <Keyboard className="w-5 h-5" />
              </button>
            </div>

            {/* Keyboard Shortcuts Help */}
            {showShortcutsHelp && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <KeyboardShortcutsHelp shortcuts={shortcuts} />
              </div>
            )}
          </Card>

          {/* Content */}
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
            ) : viewMode === 'tree' ? (
              <TreeView
                suites={testSuites}
                unassignedTestCases={[]}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onTestCaseClick={(tc) => handleRowSelect(tc.id)}
                onTestCaseDoubleClick={handleEdit}
                expandedSuites={expandedSuites}
                onExpandedChange={setExpandedSuites}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={() => {
                              if (isAllSelected) {
                                setSelectedIds(new Set());
                              } else {
                                setSelectedIds(new Set(filteredTestCases.map(tc => tc.id)));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                          />
                        </th>
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
                        <tr
                          key={tc.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${
                            selectedIds.has(tc.id) ? 'bg-blue-50' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(tc.id)}
                              onChange={() => handleRowSelect(tc.id)}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300"
                            />
                          </td>
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
                              <button
                                onClick={() => handleViewHistory(tc)}
                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Version History"
                              >
                                <History className="w-4 h-4" />
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
        </div>
      </div>

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
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'manual' | 'automated' | 'hybrid' })}
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
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
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

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        testCase={versionTestCase}
        versions={versions}
        onRestore={handleRestoreVersion}
        isRestoring={isRestoring}
      />

      {/* Import/Export Panel */}
      <ImportExportPanel
        isOpen={importExportOpen}
        onClose={() => setImportExportOpen(false)}
        onImport={handleImport}
        onExport={handleExport}
        selectedCount={selectedIds.size}
        totalCount={testCases.length}
      />
    </div>
  );
}
