/**
 * Chat Widget Component
 * Floating chat widget for support, feature requests, and bug reports
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { cn } from '../utils/cn';
import {
  MessageCircle,
  X,
  Send,
  Plus,
  ChevronLeft,
  HelpCircle,
  Bug,
  Sparkles,
  MessageSquare,
  Trash2,
  ExternalLink,
} from 'lucide-react';

// Types
interface Conversation {
  id: string;
  title: string | null;
  category: 'help_question' | 'feature_request' | 'bug_report';
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

interface Message {
  id: string;
  role: 'user' | 'system' | 'assistant';
  content: string;
  createdAt: string;
}

interface Suggestion {
  id: string;
  suggestionType: string;
  suggestedContent: string;
  description: string | null;
  targetPath: string | null;
  status: 'pending' | 'acknowledged' | 'dismissed';
}

interface HelpTopic {
  id: string;
  question: string;
  answer: string;
}

type View = 'closed' | 'list' | 'conversation' | 'new' | 'help';

const CATEGORY_CONFIG = {
  help_question: {
    label: 'Help Question',
    icon: HelpCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  feature_request: {
    label: 'Feature Request',
    icon: Sparkles,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  bug_report: {
    label: 'Bug Report',
    icon: Bug,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

export function ChatWidget() {
  const location = useLocation();
  const [view, setView] = useState<View>('closed');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newCategory, setNewCategory] = useState<'help_question' | 'feature_request' | 'bug_report'>('help_question');
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get context type from current route
  const getContextType = (): string => {
    const path = location.pathname;
    if (path.includes('test-suite')) return 'test_suite';
    if (path.includes('test-case')) return 'test_case';
    if (path.includes('script')) return 'script';
    if (path.includes('execution')) return 'execution';
    return 'general';
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      const result = await api.getConversations({ limit: 20 });
      setConversations(result.data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // Load contextual help
  const loadContextualHelp = async () => {
    try {
      const contextType = getContextType();
      const result = await api.getContextualHelp(contextType);
      setHelpTopics(result.data?.topics || []);
    } catch (err) {
      console.error('Failed to load help:', err);
    }
  };

  // Load conversation messages
  const loadConversation = async (id: string) => {
    try {
      setLoading(true);
      const result = await api.getConversation(id);
      setCurrentConversation(result.data);
      setMessages(result.data.messages || []);
      setSuggestions(result.data.suggestions || []);
    } catch (err) {
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  // Create new conversation
  const createConversation = async () => {
    if (!newTitle.trim()) {
      setError('Please enter a title');
      return;
    }

    try {
      setLoading(true);
      const result = await api.createConversation({
        title: newTitle.trim(),
        category: newCategory,
        contextType: getContextType(),
      });
      setCurrentConversation(result.data);
      setMessages([]);
      setSuggestions([]);
      setView('conversation');
      setNewTitle('');
      loadConversations();
    } catch (err) {
      setError('Failed to create conversation');
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentConversation) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    // Optimistic update
    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: messageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const result = await api.sendMessage(currentConversation.id, messageContent);
      // Replace temp message with real one
      setMessages((prev) => prev.map((m) => (m.id === tempMessage.id ? result.data : m)));
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      setError(err.response?.data?.error?.message || 'Failed to send message');
    }
  };

  // Delete conversation
  const deleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setView('list');
      }
    } catch (err) {
      setError('Failed to delete conversation');
    }
  };

  // Acknowledge suggestion
  const acknowledgeSuggestion = async (id: string) => {
    try {
      await api.acknowledgeSuggestion(id);
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'acknowledged' } : s))
      );
    } catch (err) {
      setError('Failed to acknowledge suggestion');
    }
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load data when widget opens
  useEffect(() => {
    if (view === 'list') {
      loadConversations();
    } else if (view === 'help') {
      loadContextualHelp();
    }
  }, [view, location.pathname]);

  // Render closed state (floating button)
  if (view === 'closed') {
    return (
      <button
        onClick={() => setView('list')}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
        title="Open Help Chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(view === 'conversation' || view === 'new' || view === 'help') && (
            <button
              onClick={() => setView('list')}
              className="p-1 hover:bg-blue-500 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">
            {view === 'list' && 'Help & Support'}
            {view === 'new' && 'New Conversation'}
            {view === 'help' && 'Quick Help'}
            {view === 'conversation' && (currentConversation?.title || 'Conversation')}
          </span>
        </div>
        <button
          onClick={() => setView('closed')}
          className="p-1 hover:bg-blue-500 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Conversation List View */}
        {view === 'list' && (
          <>
            {/* Action Buttons */}
            <div className="p-3 border-b border-gray-200 flex gap-2">
              <button
                onClick={() => setView('new')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
              <button
                onClick={() => setView('help')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                <HelpCircle className="w-4 h-4" />
                Quick Help
              </button>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-sm">Start a new one to get help</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {conversations.map((conv) => {
                    const config = CATEGORY_CONFIG[conv.category];
                    const Icon = config.icon;
                    return (
                      <div
                        key={conv.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer group"
                        onClick={() => {
                          loadConversation(conv.id);
                          setView('conversation');
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn('p-2 rounded-lg', config.bgColor)}>
                            <Icon className={cn('w-4 h-4', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900 truncate">
                                {conv.title || 'Untitled'}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteConversation(conv.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500">
                              {config.label} • {new Date(conv.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* New Conversation View */}
        {view === 'new' && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What do you need help with?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map((cat) => {
                  const config = CATEGORY_CONFIG[cat];
                  const Icon = config.icon;
                  return (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={cn(
                        'p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all',
                        newCategory === cat
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <Icon className={cn('w-5 h-5', config.color)} />
                      <span className="text-xs font-medium text-gray-700">
                        {cat === 'help_question' && 'Help'}
                        {cat === 'feature_request' && 'Feature'}
                        {cat === 'bug_report' && 'Bug'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Brief description of your request..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={createConversation}
              disabled={loading || !newTitle.trim()}
              className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Start Conversation'}
            </button>
          </div>
        )}

        {/* Quick Help View */}
        {view === 'help' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {helpTopics.length === 0 ? (
              <p className="text-center text-gray-500">Loading help topics...</p>
            ) : (
              helpTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <p className="font-medium text-gray-900 mb-1">{topic.question}</p>
                  <p className="text-sm text-gray-600">{topic.answer}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Conversation View */}
        {view === 'conversation' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 text-sm">
                  Send a message to start the conversation
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'max-w-[80%] p-3 rounded-lg',
                      msg.role === 'user'
                        ? 'ml-auto bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={cn(
                        'text-xs mt-1',
                        msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                      )}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}

              {/* Suggestions */}
              {suggestions.filter((s) => s.status === 'pending').length > 0 && (
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                    Suggestions
                  </p>
                  {suggestions
                    .filter((s) => s.status === 'pending')
                    .map((sug) => (
                      <div
                        key={sug.id}
                        className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2"
                      >
                        <p className="text-sm text-gray-900">{sug.suggestedContent}</p>
                        {sug.description && (
                          <p className="text-xs text-gray-600 mt-1">{sug.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {sug.targetPath && (
                            <a
                              href={sug.targetPath}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Go to tool
                            </a>
                          )}
                          <button
                            onClick={() => acknowledgeSuggestion(sug.id)}
                            className="text-xs text-green-600 hover:underline"
                          >
                            Got it
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
