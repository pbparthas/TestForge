/**
 * Feedback Widget Component
 * Quick feedback submission widget
 */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { cn } from '../utils/cn';
import {
  X,
  Bug,
  Sparkles,
  HelpCircle,
  MoreHorizontal,
  Send,
  CheckCircle,
} from 'lucide-react';

type FeedbackType = 'bug' | 'feature' | 'question' | 'other';

interface FeedbackWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES: {
  type: FeedbackType;
  label: string;
  icon: typeof Bug;
  color: string;
  placeholder: string;
}[] = [
  {
    type: 'bug',
    label: 'Bug Report',
    icon: Bug,
    color: 'text-red-500',
    placeholder: 'Describe the bug you encountered...',
  },
  {
    type: 'feature',
    label: 'Feature Request',
    icon: Sparkles,
    color: 'text-purple-500',
    placeholder: 'Describe the feature you would like...',
  },
  {
    type: 'question',
    label: 'Question',
    icon: HelpCircle,
    color: 'text-blue-500',
    placeholder: 'What would you like to know...',
  },
  {
    type: 'other',
    label: 'Other',
    icon: MoreHorizontal,
    color: 'text-gray-500',
    placeholder: 'Share your feedback...',
  },
];

export function FeedbackWidget({ isOpen, onClose }: FeedbackWidgetProps) {
  const location = useLocation();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = FEEDBACK_TYPES.find((t) => t.type === feedbackType)!;

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Please enter your feedback');
      return;
    }

    if (content.trim().length < 10) {
      setError('Feedback must be at least 10 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.submitFeedback({
        feedbackType,
        content: content.trim(),
        pageContext: location.pathname,
      });

      setSuccess(true);
      setContent('');

      // Auto close after success
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Send Feedback</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Thank you for your feedback!
            </h3>
            <p className="text-sm text-gray-500">
              We appreciate you taking the time to help us improve.
            </p>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Feedback Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type of Feedback
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FEEDBACK_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = feedbackType === type.type;
                    return (
                      <button
                        key={type.type}
                        onClick={() => setFeedbackType(type.type)}
                        className={cn(
                          'p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all',
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <Icon className={cn('w-5 h-5', type.color)} />
                        <span className="text-xs font-medium text-gray-700">
                          {type.type === 'bug' && 'Bug'}
                          {type.type === 'feature' && 'Feature'}
                          {type.type === 'question' && 'Question'}
                          {type.type === 'other' && 'Other'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedType.label}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setError(null);
                  }}
                  placeholder={selectedType.placeholder}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Current page: {location.pathname}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !content.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Feedback Button Component
 * A small button to trigger the feedback widget
 */
export function FeedbackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-24 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-40"
      title="Send Feedback"
    >
      <Sparkles className="w-4 h-4" />
      Feedback
    </button>
  );
}
