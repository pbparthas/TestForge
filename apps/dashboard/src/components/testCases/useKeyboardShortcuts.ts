/**
 * useKeyboardShortcuts Hook
 * Keyboard shortcuts for Test Cases page
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDelete?: () => void;
  onCreate?: () => void;
  onSearch?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
}

export interface ShortcutInfo {
  key: string;
  description: string;
}

export function useKeyboardShortcuts({
  enabled = true,
  onSelectAll,
  onDeselectAll,
  onCreate,
  onDelete,
  onSearch,
  onExport,
  onImport,
  onDuplicate,
  onEdit,
  onEscape,
  onArrowUp,
  onArrowDown,
  onEnter,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Allow escape in inputs
      if (event.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      // Block other shortcuts when in input
      if (isInputElement && event.key !== 'Escape') {
        return;
      }

      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      // Ctrl/Cmd + A - Select All
      if (isCtrlOrMeta && event.key === 'a' && onSelectAll) {
        event.preventDefault();
        onSelectAll();
        return;
      }

      // Ctrl/Cmd + Shift + A - Deselect All
      if (isCtrlOrMeta && event.shiftKey && event.key === 'A' && onDeselectAll) {
        event.preventDefault();
        onDeselectAll();
        return;
      }

      // Ctrl/Cmd + N - Create New
      if (isCtrlOrMeta && event.key === 'n' && onCreate) {
        event.preventDefault();
        onCreate();
        return;
      }

      // Delete or Backspace - Delete selected
      if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) {
        event.preventDefault();
        onDelete();
        return;
      }

      // Ctrl/Cmd + F - Focus Search
      if (isCtrlOrMeta && event.key === 'f' && onSearch) {
        event.preventDefault();
        onSearch();
        return;
      }

      // Ctrl/Cmd + E - Export
      if (isCtrlOrMeta && event.key === 'e' && onExport) {
        event.preventDefault();
        onExport();
        return;
      }

      // Ctrl/Cmd + I - Import
      if (isCtrlOrMeta && event.key === 'i' && onImport) {
        event.preventDefault();
        onImport();
        return;
      }

      // Ctrl/Cmd + D - Duplicate
      if (isCtrlOrMeta && event.key === 'd' && onDuplicate) {
        event.preventDefault();
        onDuplicate();
        return;
      }

      // Enter - Edit selected
      if (event.key === 'Enter' && !isCtrlOrMeta) {
        if (onEdit) {
          event.preventDefault();
          onEdit();
        } else if (onEnter) {
          event.preventDefault();
          onEnter();
        }
        return;
      }

      // Arrow Up - Navigate up
      if (event.key === 'ArrowUp' && onArrowUp) {
        event.preventDefault();
        onArrowUp();
        return;
      }

      // Arrow Down - Navigate down
      if (event.key === 'ArrowDown' && onArrowDown) {
        event.preventDefault();
        onArrowDown();
        return;
      }
    },
    [
      enabled,
      onSelectAll,
      onDeselectAll,
      onCreate,
      onDelete,
      onSearch,
      onExport,
      onImport,
      onDuplicate,
      onEdit,
      onEscape,
      onArrowUp,
      onArrowDown,
      onEnter,
    ]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // Return list of shortcuts for help display
  const shortcuts: ShortcutInfo[] = [
    { key: 'Ctrl/Cmd + A', description: 'Select all test cases' },
    { key: 'Ctrl/Cmd + Shift + A', description: 'Deselect all' },
    { key: 'Ctrl/Cmd + N', description: 'Create new test case' },
    { key: 'Delete', description: 'Delete selected' },
    { key: 'Ctrl/Cmd + F', description: 'Focus search' },
    { key: 'Ctrl/Cmd + E', description: 'Export' },
    { key: 'Ctrl/Cmd + I', description: 'Import' },
    { key: 'Ctrl/Cmd + D', description: 'Duplicate selected' },
    { key: 'Enter', description: 'Edit selected' },
    { key: 'Arrow Up/Down', description: 'Navigate list' },
    { key: 'Escape', description: 'Close modal / Clear selection' },
  ];

  return { shortcuts };
}
