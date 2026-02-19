/**
 * Admin Feedback Dashboard
 * View and manage bug reports, feature requests, and help questions
 * Admin-only access
 */

import { useState, useMemo } from 'react';
import { useAuthStore } from '../stores/auth';
import {
  useAdminConversations,
  useConversation,
  useAdminReply,
  useUpdateConversationStatus,
} from '../hooks/queries';
import { Card, Badge, Button } from '../components/ui';
import {
  Shield,
  Bug,
  Sparkles,
  HelpCircle,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Search,
  Send,
  User,
  Calendar,
} from 'lucide-react';

// Types
interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  category: 'help_question' | 'feature_request' | 'bug_report';
  status: 'active' | 'closed';
  contextType: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { name: string; email: string } | null;
  messages?: Message[];
  _count?: { messages: number };
}

interface Message {
  id: string;
  role: 'user' | 'system' | 'assistant';
  content: string;
  createdAt: string;
}

// Category config
const CATEGORY_CONFIG = {
  bug_report: {
    label: 'Bug Report',
    icon: Bug,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
  feature_request: {
    label: 'Feature Request',
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200',
  },
  help_question: {
    label: 'Help Question',
    icon: HelpCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
};

// Status config
const STATUS_CONFIG = {
  active: {
    label: 'Open',
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  closed: {
    label: 'Resolved',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
};

export function AdminFeedbackPage() {
  const { user } = useAuthStore();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: conversations = [] as Conversation[], isLoading } = useAdminConversations({
    category: categoryFilter,
    status: statusFilter,
  });
  const { data: selectedConversation } = useConversation(selectedConversationId || undefined) as { data: Conversation | undefined };
  const messages = selectedConversation?.messages || [];

  const replyMutation = useAdminReply();
  const statusMutation = useUpdateConversationStatus();

  // Check admin access
  if (user?.role !== 'admin') {
    return (
      <Card>
        <div className="text-center py-12">
          <Shield className="w-16 h-16 mx-auto text-red-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">This page is only accessible to administrators.</p>
        </div>
      </Card>
    );
  }

  // Stats
  const stats = useMemo(() => ({
    total: (conversations as Conversation[]).length,
    bugs: (conversations as Conversation[]).filter(c => c.category === 'bug_report').length,
    features: (conversations as Conversation[]).filter(c => c.category === 'feature_request').length,
    help: (conversations as Conversation[]).filter(c => c.category === 'help_question').length,
    open: (conversations as Conversation[]).filter(c => c.status === 'active').length,
    closed: (conversations as Conversation[]).filter(c => c.status === 'closed').length,
  }), [conversations]);

  const sendReply = () => {
    if (!replyText.trim() || !selectedConversationId) return;
    replyMutation.mutate(
      { conversationId: selectedConversationId, content: replyText.trim() },
      { onSuccess: () => setReplyText('') }
    );
  };

  const updateStatus = (conversationId: string, status: 'active' | 'closed') => {
    statusMutation.mutate({ conversationId, status });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredConversations = (conversations as Conversation[]).filter(conv => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = conv.title?.toLowerCase().includes(query);
      const matchesUser = conv.user?.name?.toLowerCase().includes(query) || conv.user?.email?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesUser) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Feedback Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage bug reports, feature requests, and help questions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><div className="text-center"><p className="text-2xl font-bold text-gray-900">{stats.total}</p><p className="text-xs text-gray-500">Total</p></div></Card>
        <Card><div className="text-center"><p className="text-2xl font-bold text-red-600">{stats.bugs}</p><p className="text-xs text-gray-500">Bugs</p></div></Card>
        <Card><div className="text-center"><p className="text-2xl font-bold text-purple-600">{stats.features}</p><p className="text-xs text-gray-500">Features</p></div></Card>
        <Card><div className="text-center"><p className="text-2xl font-bold text-blue-600">{stats.help}</p><p className="text-xs text-gray-500">Help</p></div></Card>
        <Card><div className="text-center"><p className="text-2xl font-bold text-yellow-600">{stats.open}</p><p className="text-xs text-gray-500">Open</p></div></Card>
        <Card><div className="text-center"><p className="text-2xl font-bold text-green-600">{stats.closed}</p><p className="text-xs text-gray-500">Resolved</p></div></Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or user..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Categories</option>
            <option value="bug_report">Bug Reports</option>
            <option value="feature_request">Feature Requests</option>
            <option value="help_question">Help Questions</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="active">Open</option>
            <option value="closed">Resolved</option>
          </select>
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation List */}
        <div className="lg:col-span-1">
          <Card title="Conversations">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No conversations found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {filteredConversations.map((conv) => {
                  const catConfig = CATEGORY_CONFIG[conv.category];
                  const statusConfig = STATUS_CONFIG[conv.status];
                  const CatIcon = catConfig.icon;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedConversationId === conv.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${catConfig.bgColor}`}>
                          <CatIcon className={`w-4 h-4 ${catConfig.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-gray-900 truncate text-sm">
                              {conv.title || 'Untitled'}
                            </p>
                            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} text-xs`}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {conv.user?.name || conv.user?.email || 'Unknown user'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(conv.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-2">
          {selectedConversation ? (
            <Card>
              {/* Header */}
              <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {(() => {
                      const catConfig = CATEGORY_CONFIG[selectedConversation.category];
                      const CatIcon = catConfig.icon;
                      return (
                        <Badge className={`${catConfig.bgColor} ${catConfig.color}`}>
                          <CatIcon className="w-3 h-3 mr-1" />
                          {catConfig.label}
                        </Badge>
                      );
                    })()}
                    <Badge className={`${STATUS_CONFIG[selectedConversation.status].bgColor} ${STATUS_CONFIG[selectedConversation.status].color}`}>
                      {STATUS_CONFIG[selectedConversation.status].label}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedConversation.title || 'Untitled'}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {selectedConversation.user?.name || selectedConversation.user?.email || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedConversation.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedConversation.status === 'active' ? (
                    <Button
                      size="sm"
                      onClick={() => updateStatus(selectedConversation.id, 'closed')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Resolved
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateStatus(selectedConversation.id, 'active')}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-50 border border-blue-100 ml-8'
                        : 'bg-gray-50 border border-gray-100 mr-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${msg.role === 'user' ? 'text-blue-600' : 'text-gray-600'}`}>
                        {msg.role === 'user' ? 'User' : 'System'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>

              {/* Reply Box */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Reply
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your response to the user..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    onClick={sendReply}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    isLoading={replyMutation.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Reply
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-16 text-gray-500">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Click on a conversation from the list to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
