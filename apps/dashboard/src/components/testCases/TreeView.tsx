/**
 * TreeView Component
 * Hierarchical view of test cases organized by suites
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  CheckSquare,
  Square,
  MoreHorizontal,
} from 'lucide-react';
import type { TestCase } from '../../types';

export interface TestSuiteNode {
  id: string;
  name: string;
  testCases: TestCase[];
  children?: TestSuiteNode[];
}

export interface TreeViewProps {
  suites: TestSuiteNode[];
  unassignedTestCases: TestCase[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onTestCaseClick: (testCase: TestCase) => void;
  onTestCaseDoubleClick: (testCase: TestCase) => void;
  expandedSuites: Set<string>;
  onExpandedChange: (ids: Set<string>) => void;
}

interface TreeNodeProps {
  suite: TestSuiteNode;
  level: number;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onTestCaseClick: (testCase: TestCase) => void;
  onTestCaseDoubleClick: (testCase: TestCase) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-700',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-purple-100 text-purple-700',
};

function TreeNode({
  suite,
  level,
  selectedIds,
  onSelectionChange,
  onTestCaseClick,
  onTestCaseDoubleClick,
  isExpanded,
  onToggleExpand,
}: TreeNodeProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);

  const allTestCaseIds = suite.testCases.map(tc => tc.id);
  const selectedInSuite = allTestCaseIds.filter(id => selectedIds.has(id));
  const isAllSelected = selectedInSuite.length === allTestCaseIds.length && allTestCaseIds.length > 0;
  const isPartialSelected = selectedInSuite.length > 0 && selectedInSuite.length < allTestCaseIds.length;

  const handleSuiteSelect = () => {
    const newSelection = new Set(selectedIds);
    if (isAllSelected) {
      allTestCaseIds.forEach(id => newSelection.delete(id));
    } else {
      allTestCaseIds.forEach(id => newSelection.add(id));
    }
    onSelectionChange(newSelection);
  };

  const handleTestCaseSelect = (testCaseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedIds);
    if (newSelection.has(testCaseId)) {
      newSelection.delete(testCaseId);
    } else {
      newSelection.add(testCaseId);
    }
    onSelectionChange(newSelection);
  };

  return (
    <div className="select-none">
      {/* Suite Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
          'hover:bg-gray-100'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={onToggleExpand}
      >
        {/* Expand/Collapse Icon */}
        <button className="p-0.5 text-gray-400">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSuiteSelect();
          }}
          className="p-0.5"
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-600" />
          ) : isPartialSelected ? (
            <div className="w-4 h-4 border-2 border-blue-600 rounded bg-blue-600 flex items-center justify-center">
              <div className="w-2 h-0.5 bg-white" />
            </div>
          ) : (
            <Square className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {/* Folder Icon */}
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-blue-500" />
        ) : (
          <Folder className="w-4 h-4 text-blue-500" />
        )}

        {/* Suite Name */}
        <span className="flex-1 text-sm font-medium text-gray-900 truncate">
          {suite.name}
        </span>

        {/* Test Count Badge */}
        <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
          {suite.testCases.length}
        </span>

        {/* Context Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(!showContextMenu);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Test Cases */}
      {isExpanded && (
        <div className="ml-4">
          {suite.testCases.map(testCase => (
            <div
              key={testCase.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
                selectedIds.has(testCase.id)
                  ? 'bg-blue-50'
                  : 'hover:bg-gray-50'
              )}
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
              onClick={() => onTestCaseClick(testCase)}
              onDoubleClick={() => onTestCaseDoubleClick(testCase)}
            >
              {/* Spacer for alignment */}
              <div className="w-4" />

              {/* Checkbox */}
              <button
                onClick={(e) => handleTestCaseSelect(testCase.id, e)}
                className="p-0.5"
              >
                {selectedIds.has(testCase.id) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* File Icon */}
              <FileText className="w-4 h-4 text-gray-400" />

              {/* Test Case Title */}
              <span className="flex-1 text-sm text-gray-700 truncate">
                {testCase.title}
              </span>

              {/* Priority Badge */}
              <span className={cn(
                'px-1.5 py-0.5 text-xs font-medium rounded',
                priorityColors[testCase.priority] || priorityColors.medium
              )}>
                {testCase.priority}
              </span>

              {/* Status Badge */}
              <span className={cn(
                'px-1.5 py-0.5 text-xs font-medium rounded',
                statusColors[testCase.status] || statusColors.draft
              )}>
                {testCase.status}
              </span>
            </div>
          ))}

          {/* Nested Suites */}
          {suite.children?.map(child => (
            <TreeNode
              key={child.id}
              suite={child}
              level={level + 1}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              onTestCaseClick={onTestCaseClick}
              onTestCaseDoubleClick={onTestCaseDoubleClick}
              isExpanded={false}
              onToggleExpand={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({
  suites,
  unassignedTestCases,
  selectedIds,
  onSelectionChange,
  onTestCaseClick,
  onTestCaseDoubleClick,
  expandedSuites,
  onExpandedChange,
}: TreeViewProps) {
  const toggleExpanded = (suiteId: string) => {
    const newExpanded = new Set(expandedSuites);
    if (newExpanded.has(suiteId)) {
      newExpanded.delete(suiteId);
    } else {
      newExpanded.add(suiteId);
    }
    onExpandedChange(newExpanded);
  };

  return (
    <div className="space-y-1">
      {/* Test Suites */}
      {suites.map(suite => (
        <TreeNode
          key={suite.id}
          suite={suite}
          level={0}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          onTestCaseClick={onTestCaseClick}
          onTestCaseDoubleClick={onTestCaseDoubleClick}
          isExpanded={expandedSuites.has(suite.id)}
          onToggleExpand={() => toggleExpanded(suite.id)}
        />
      ))}

      {/* Unassigned Test Cases */}
      {unassignedTestCases.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Unassigned Test Cases
          </div>
          {unassignedTestCases.map(testCase => (
            <div
              key={testCase.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 ml-4 rounded-lg cursor-pointer transition-colors',
                selectedIds.has(testCase.id)
                  ? 'bg-blue-50'
                  : 'hover:bg-gray-50'
              )}
              onClick={() => onTestCaseClick(testCase)}
              onDoubleClick={() => onTestCaseDoubleClick(testCase)}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newSelection = new Set(selectedIds);
                  if (newSelection.has(testCase.id)) {
                    newSelection.delete(testCase.id);
                  } else {
                    newSelection.add(testCase.id);
                  }
                  onSelectionChange(newSelection);
                }}
                className="p-0.5"
              >
                {selectedIds.has(testCase.id) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* File Icon */}
              <FileText className="w-4 h-4 text-gray-400" />

              {/* Test Case Title */}
              <span className="flex-1 text-sm text-gray-700 truncate">
                {testCase.title}
              </span>

              {/* Priority Badge */}
              <span className={cn(
                'px-1.5 py-0.5 text-xs font-medium rounded',
                priorityColors[testCase.priority] || priorityColors.medium
              )}>
                {testCase.priority}
              </span>

              {/* Status Badge */}
              <span className={cn(
                'px-1.5 py-0.5 text-xs font-medium rounded',
                statusColors[testCase.status] || statusColors.draft
              )}>
                {testCase.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {suites.length === 0 && unassignedTestCases.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Folder className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="font-medium">No test cases found</p>
          <p className="text-sm mt-1">Create test cases to see them organized here</p>
        </div>
      )}
    </div>
  );
}
