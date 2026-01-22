/**
 * Main Layout Component with Grouped Sidebar
 * Based on QualityPilot SidebarGrouped design
 */

import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useProjectStore } from '../stores/project';
import { cn } from '../utils/cn';
import { ChatWidget } from './ChatWidget';
import { FeedbackWidget, FeedbackButton } from './FeedbackWidget';
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Target,
  Play,
  Bug,
  Sparkles,
  BarChart3,
  ChevronDown,
  ChevronRight,
  LogOut,
  Wand2,
  Shield,
  Compass,
  Heart,
  Wrench,
  Eye,
  Video,
  TrendingUp,
  Code,
  RefreshCw,
  Workflow,
  AlertTriangle,
  Settings2,
  FileBarChart,
  CheckCircle2,
} from 'lucide-react';

// Navigation groups - matching QualityPilot structure
const navGroups = [
  {
    title: 'Overview',
    icon: BarChart3,
    defaultOpen: true,
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'Test Management',
    icon: FileText,
    defaultOpen: true,
    items: [
      { path: '/test-cases', icon: FileText, label: 'Test Cases' },
      { path: '/test-suites', icon: FolderOpen, label: 'Test Suites' },
      { path: '/requirements', icon: Target, label: 'Requirements' },
    ],
  },
  {
    title: 'Testing & Automation',
    icon: Wrench,
    defaultOpen: true,
    items: [
      { path: '/scriptsmith-pro', icon: Sparkles, label: 'ScriptSmith Pro' },
      { path: '/ai-generator', icon: Wand2, label: 'AI Generator' },
      { path: '/code-guardian', icon: Shield, label: 'CodeGuardian' },
      { path: '/flowpilot', icon: Compass, label: 'FlowPilot' },
      { path: '/self-healing', icon: Heart, label: 'Self-Healing' },
      { path: '/visual-testing', icon: Eye, label: 'Visual Testing' },
      { path: '/recorder', icon: Video, label: 'Recorder' },
    ],
  },
  {
    title: 'Execution & Bugs',
    icon: Play,
    defaultOpen: true,
    items: [
      { path: '/executions', icon: Play, label: 'Executions' },
      { path: '/bugs', icon: Bug, label: 'Bugs' },
      { path: '/bug-patterns', icon: TrendingUp, label: 'Bug Patterns' },
      { path: '/flaky-tests', icon: AlertTriangle, label: 'Flaky Tests' },
    ],
  },
  {
    title: 'AI Analysis',
    icon: Code,
    defaultOpen: true,
    items: [
      { path: '/code-analysis', icon: Code, label: 'Code Analysis' },
      { path: '/test-evolution', icon: RefreshCw, label: 'Test Evolution' },
      { path: '/testpilot', icon: Workflow, label: 'TestPilot Suite' },
    ],
  },
  {
    title: 'Analytics',
    icon: BarChart3,
    defaultOpen: true,
    items: [
      { path: '/coverage', icon: BarChart3, label: 'Coverage' },
      { path: '/reports', icon: FileBarChart, label: 'Reports & Gates' },
      { path: '/approvals', icon: CheckCircle2, label: 'Approvals' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings2,
    defaultOpen: true,
    items: [
      { path: '/jenkins', icon: Settings2, label: 'CI/CD Integrations' },
    ],
  },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentProject } = useProjectStore();

  // Feedback widget state
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Track which groups are open/closed
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    navGroups.reduce((acc, group) => ({
      ...acc,
      [group.title]: group.defaultOpen,
    }), {})
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  // Get user initials for avatar
  const getUserInitials = (name?: string): string => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Get role badge color
  const getRoleBadgeColor = (role?: string): string => {
    switch (role) {
      case 'admin': return 'bg-purple-500/20 text-purple-300';
      case 'qe': return 'bg-green-500/20 text-green-300';
      case 'tester': return 'bg-blue-500/20 text-blue-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 flex flex-col">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 bg-gray-800 border-b border-gray-700">
          <span className="text-xl font-bold text-white">TestForge</span>
        </div>

        {/* Project Selector */}
        {currentProject && (
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Current Project</p>
            <p className="text-sm font-medium text-white truncate mt-1">{currentProject.name}</p>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = openGroups[group.title];

            return (
              <div key={group.title} className="mb-2">
                {/* Group Header - Clickable to collapse/expand */}
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <GroupIcon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {group.title}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {/* Group Items - Collapsible */}
                {isOpen && (
                  <div className="mt-1 ml-2 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile Section */}
        {user && (
          <div className="p-4 border-t border-gray-700">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-3">
              {/* User Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {getUserInitials(user.name)}
              </div>

              {/* User Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.name || 'User'}
                </p>
                <span className={cn(
                  'inline-block px-2 py-0.5 text-xs font-medium rounded capitalize',
                  getRoleBadgeColor(user.role)
                )}>
                  {user.role || 'user'}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="pl-64">
        <div className="p-8">
          <Outlet />
        </div>
      </main>

      {/* Chat Widget */}
      <ChatWidget />

      {/* Feedback Button & Widget */}
      <FeedbackButton onClick={() => setFeedbackOpen(true)} />
      <FeedbackWidget isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
