/**
 * Audit Logs Page
 * View and filter audit logs (admin/lead only)
 */

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Card, Badge, Button, Input } from '../components/ui';
import {
  Shield,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  AlertCircle,
  User,
  Calendar,
  Activity,
} from 'lucide-react';

// Types
interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security';
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
}

// Category colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  authentication: { bg: 'bg-blue-100', text: 'text-blue-700' },
  authorization: { bg: 'bg-purple-100', text: 'text-purple-700' },
  data_access: { bg: 'bg-green-100', text: 'text-green-700' },
  data_modification: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  system: { bg: 'bg-gray-100', text: 'text-gray-700' },
  security: { bg: 'bg-red-100', text: 'text-red-700' },
};

// Severity icons
const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'text-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500' },
  critical: { icon: AlertCircle, color: 'text-red-500' },
};

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Filters
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [action, setAction] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [page, category, severity]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (category) params.category = category;
      if (severity) params.severity = severity;
      if (action) params.action = action;

      const response = await api.get<{ data: AuditLog[]; total: number }>('/audit', { params });
      setLogs(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Security and compliance audit trail
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Categories</option>
                <option value="authentication">Authentication</option>
                <option value="authorization">Authorization</option>
                <option value="data_access">Data Access</option>
                <option value="data_modification">Data Modification</option>
                <option value="system">System</option>
                <option value="security">Security</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <Input
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="Filter by action..."
              />
            </div>

            <div className="flex items-end">
              <Button onClick={() => { setPage(1); loadLogs(); }}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
              <p className="text-sm text-gray-500">Total Events</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Info className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(l => l.success).length}
              </p>
              <p className="text-sm text-gray-500">Successful</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(l => l.severity === 'warning').length}
              </p>
              <p className="text-sm text-gray-500">Warnings</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(l => l.severity === 'critical').length}
              </p>
              <p className="text-sm text-gray-500">Critical</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">User</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Resource</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Severity</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const SeverityIcon = SEVERITY_CONFIG[log.severity].icon;
                    const categoryColor = CATEGORY_COLORS[log.category] ?? CATEGORY_COLORS.system!;

                    return (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {formatDate(log.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {log.user?.name || log.user?.email || 'System'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-gray-900">{log.action}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">{log.resource}</span>
                          {log.resourceId && (
                            <span className="text-xs text-gray-400 ml-1">({log.resourceId.slice(0, 8)}...)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`${categoryColor.bg} ${categoryColor.text}`}>
                            {log.category.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <SeverityIcon className={`w-4 h-4 ${SEVERITY_CONFIG[log.severity].color}`} />
                            <span className="text-sm capitalize">{log.severity}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {log.success ? (
                            <Badge className="bg-green-100 text-green-700">Success</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">Failed</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
