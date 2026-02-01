/**
 * BulkActionsBar Component
 * Actions bar for bulk operations on selected test cases
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';
import {
  CheckSquare,
  Square,
  Trash2,
  FolderInput,
  Tag,
  Archive,
  Copy,
  MoreHorizontal,
  X,
} from 'lucide-react';

export interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isAllSelected: boolean;
  onBulkDelete: () => void;
  onBulkMove: () => void;
  onBulkTag: () => void;
  onBulkArchive: () => void;
  onBulkDuplicate: () => void;
  onBulkExport: () => void;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  isAllSelected,
  onBulkDelete,
  onBulkMove,
  onBulkTag,
  onBulkArchive,
  onBulkDuplicate,
  onBulkExport,
}: BulkActionsBarProps) {
  const [showMoreActions, setShowMoreActions] = useState(false);

  const hasSelection = selectedCount > 0;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200',
        hasSelection
          ? 'bg-blue-50 border-blue-200'
          : 'bg-gray-50 border-gray-200'
      )}
    >
      {/* Left: Selection Controls */}
      <div className="flex items-center gap-4">
        {/* Select All Checkbox */}
        <button
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
        >
          {isAllSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-medium">
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </span>
        </button>

        {/* Selection Count */}
        {hasSelection && (
          <div className="flex items-center gap-2">
            <span className="w-px h-5 bg-gray-300" />
            <span className="text-sm font-medium text-blue-700">
              {selectedCount} of {totalCount} selected
            </span>
            <button
              onClick={onDeselectAll}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Bulk Actions */}
      {hasSelection && (
        <div className="flex items-center gap-1">
          {/* Primary Actions */}
          <button
            onClick={onBulkMove}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            title="Move to suite"
          >
            <FolderInput className="w-4 h-4" />
            <span className="hidden sm:inline">Move</span>
          </button>

          <button
            onClick={onBulkTag}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
            title="Add tags"
          >
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">Tag</span>
          </button>

          <button
            onClick={onBulkDuplicate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>

          <button
            onClick={onBulkArchive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">Archive</span>
          </button>

          {/* Divider */}
          <span className="w-px h-6 bg-gray-300 mx-1" />

          {/* Delete Action */}
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
            title="Delete selected"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          {/* More Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              title="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMoreActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMoreActions(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onBulkExport();
                        setShowMoreActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Export Selected
                    </button>
                    <button
                      onClick={() => setShowMoreActions(false)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Change Priority
                    </button>
                    <button
                      onClick={() => setShowMoreActions(false)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Change Status
                    </button>
                    <button
                      onClick={() => setShowMoreActions(false)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Assign Owner
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty state actions */}
      {!hasSelection && (
        <div className="text-sm text-gray-500">
          Select test cases to perform bulk actions
        </div>
      )}
    </div>
  );
}
