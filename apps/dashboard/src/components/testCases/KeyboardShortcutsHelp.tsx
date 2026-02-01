/**
 * KeyboardShortcutsHelp Component
 * Displays available keyboard shortcuts
 */

import type { ShortcutInfo } from './useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  shortcuts: ShortcutInfo[];
}

export function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Keyboard Shortcuts</h4>
      <div className="grid grid-cols-2 gap-2">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <kbd className="px-2 py-1 text-xs font-mono bg-white border border-gray-300 rounded shadow-sm">
              {shortcut.key}
            </kbd>
            <span className="text-xs text-gray-600 text-right">{shortcut.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
