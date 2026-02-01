/**
 * SessionSidebar Component
 * Session list with search, filters, and metrics display
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';
import { Search, Plus, Clock, FileCode, FolderTree, TestTube, Percent, Filter } from 'lucide-react';
import { Badge } from '../ui';

export interface CodeGuardianSession {
  id: string;
  name: string;
  language: 'typescript' | 'javascript' | 'python' | 'java' | 'csharp' | 'go';
  framework: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  metrics: {
    files: number;
    functions: number;
    testsGenerated: number;
    avgCoverage: number;
  };
}

interface SessionSidebarProps {
  sessions: CodeGuardianSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  isCollapsed?: boolean;
}

type StatusFilter = 'all' | 'active' | 'completed' | 'archived';
type LanguageFilter = 'all' | CodeGuardianSession['language'];

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewSession,
  isCollapsed,
}: SessionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    const matchesLanguage = languageFilter === 'all' || session.language === languageFilter;
    return matchesSearch && matchesStatus && matchesLanguage;
  });

  const languageColors: Record<CodeGuardianSession['language'], string> = {
    typescript: 'bg-blue-100 text-blue-800',
    javascript: 'bg-yellow-100 text-yellow-800',
    python: 'bg-green-100 text-green-800',
    java: 'bg-orange-100 text-orange-800',
    csharp: 'bg-purple-100 text-purple-800',
    go: 'bg-cyan-100 text-cyan-800',
  };

  const statusVariants: Record<CodeGuardianSession['status'], 'success' | 'info' | 'default'> = {
    active: 'info',
    completed: 'success',
    archived: 'default',
  };

  if (isCollapsed) {
    return (
      <div className="w-16 bg-gray-50 border-r border-gray-200 p-2 flex flex-col items-center gap-2">
        <button
          onClick={onNewSession}
          className="w-10 h-10 rounded-lg bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
        {sessions.slice(0, 5).map(session => (
          <button
            key={session.id}
            onClick={() => onSessionSelect(session.id)}
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-colors',
              languageColors[session.language],
              activeSessionId === session.id && 'ring-2 ring-green-500'
            )}
            title={session.name}
          >
            {session.language.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 text-xs font-medium transition-colors',
            showFilters ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Filter className="w-3 h-3" />
          Filters
          {(statusFilter !== 'all' || languageFilter !== 'all') && (
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">
              Active
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 pb-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value as LanguageFilter)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
            >
              <option value="all">All Languages</option>
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option value="go">Go</option>
            </select>
          </div>
        </div>
      )}

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {sessions.length === 0 ? (
              <p>No sessions yet. Create your first session!</p>
            ) : (
              <p>No sessions match your filters.</p>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSessions.map(session => (
              <button
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-colors',
                  activeSessionId === session.id
                    ? 'bg-green-50 border border-green-200'
                    : 'hover:bg-gray-100 border border-transparent'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {session.name}
                  </span>
                  <Badge variant={statusVariants[session.status]}>
                    {session.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', languageColors[session.language])}>
                    {session.language}
                  </span>
                  <span className="text-[10px] text-gray-400">{session.framework}</span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  <div className="flex items-center gap-1 text-gray-500">
                    <FileCode className="w-3 h-3" />
                    {session.metrics.files}
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <FolderTree className="w-3 h-3" />
                    {session.metrics.functions}
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <TestTube className="w-3 h-3" />
                    {session.metrics.testsGenerated}
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Percent className="w-3 h-3" />
                    {session.metrics.avgCoverage}%
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                  <Clock className="w-3 h-3" />
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
