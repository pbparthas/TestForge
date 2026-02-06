/**
 * Code Review Page
 * Monaco diff viewer with inline review comments for Git-integrated script artifacts
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { Card, Badge, Button } from '../components/ui';
import { MonacoDiffEditor } from '../components/monaco/MonacoDiffEditor';

// Types
interface ReviewComment {
  id: string;
  artifactId: string;
  userId: string;
  scriptId: string | null;
  filePath: string | null;
  lineNumber: number | null;
  lineEnd: number | null;
  content: string;
  isResolved: boolean;
  createdAt: string;
}

interface ArtifactDetail {
  id: string;
  projectId: string;
  type: string;
  state: string;
  title: string;
  description: string | null;
  content: Record<string, unknown>;
  targetEntityId: string | null;
  riskLevel: string;
}

export function CodeReviewPage() {
  const { artifactId } = useParams<{ artifactId: string }>();

  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [diff, setDiff] = useState<{ original: string; modified: string } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load artifact, comments, and diff
  useEffect(() => {
    if (!artifactId) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [artifactRes, commentsRes] = await Promise.all([
          api.getArtifact(artifactId!),
          api.getReviewComments(artifactId!),
        ]);

        setArtifact(artifactRes.data);
        setComments(commentsRes.data || []);

        // Load diff if this is a script artifact with git integration
        if (artifactRes.data?.targetEntityId) {
          try {
            const diffRes = await api.getGitDiff(artifactRes.data.targetEntityId);
            if (diffRes.data) {
              // Parse unified diff into original/modified
              const diffStr = typeof diffRes.data === 'string' ? diffRes.data : '';
              setDiff({
                original: extractOriginal(diffStr),
                modified: extractModified(diffStr),
              });
            }
          } catch {
            // No diff available — show content from artifact instead
            const content = artifactRes.data.content as Record<string, string>;
            setDiff({
              original: content.originalCode || '',
              modified: content.code || content.generatedCode || '',
            });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load review');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [artifactId]);

  const handleAddComment = useCallback((lineNumber: number) => {
    setCommentLine(lineNumber);
  }, []);

  const handleSubmitComment = async () => {
    if (!artifactId || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.addReviewComment(artifactId, {
        content: newComment.trim(),
        lineNumber: commentLine || undefined,
      });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
      setCommentLine(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await api.resolveReviewComment(commentId);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, isResolved: true } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve comment');
    }
  };

  const handleApprove = async () => {
    if (!artifactId) return;
    try {
      await api.approveArtifact(artifactId, 'Approved via code review');
      // Reload artifact to get updated state
      const res = await api.getArtifact(artifactId);
      setArtifact(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!artifactId) return;
    const unresolvedComments = comments.filter(c => !c.isResolved);
    try {
      await api.rejectArtifact(
        artifactId,
        'Rejected via code review',
        unresolvedComments.map(c => ({
          category: 'code_quality',
          severity: 'medium',
          description: c.content,
        }))
      );
      const res = await api.getArtifact(artifactId);
      setArtifact(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !artifact) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-6 text-center text-red-500">
            <p>{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  const STATE_BADGES: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    draft: 'default',
    pending_review: 'warning',
    in_review: 'info',
    approved: 'success',
    rejected: 'danger',
    archived: 'default',
  };

  const unresolvedCount = comments.filter(c => !c.isResolved).length;
  const canApprove = artifact?.state === 'in_review' || artifact?.state === 'pending_review';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{artifact?.title || 'Code Review'}</h1>
          <p className="text-sm text-gray-500 mt-1">{artifact?.description || `Artifact ${artifactId}`}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATE_BADGES[artifact?.state || 'draft'] || 'default'}>
            {artifact?.state?.replace('_', ' ').toUpperCase()}
          </Badge>
          <Badge variant={artifact?.riskLevel === 'critical' ? 'danger' : artifact?.riskLevel === 'high' ? 'warning' : 'default'}>
            Risk: {artifact?.riskLevel}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Diff Viewer */}
      <Card>
        <div className="p-4">
          {diff ? (
            <MonacoDiffEditor
              original={diff.original}
              modified={diff.modified}
              language="typescript"
              filename={artifact?.title || 'review'}
              height="500px"
              onAddComment={handleAddComment}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">
              No diff available for this artifact.
            </div>
          )}
        </div>
      </Card>

      {/* Comment Input */}
      <Card>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {commentLine && (
                <div className="mb-2 text-xs text-gray-500">
                  Commenting on line {commentLine}
                  <button
                    onClick={() => setCommentLine(null)}
                    className="ml-2 text-blue-500 hover:text-blue-700"
                  >
                    Clear
                  </button>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a review comment..."
                className="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              variant="primary"
            >
              {submitting ? 'Adding...' : 'Comment'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Comments List */}
      {comments.length > 0 && (
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Comments ({comments.length})
              {unresolvedCount > 0 && (
                <span className="ml-2 text-orange-500">({unresolvedCount} unresolved)</span>
              )}
            </h3>
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`flex items-start gap-3 p-3 rounded-md border ${
                    comment.isResolved ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-300'
                  }`}
                >
                  <div className="flex-1">
                    {comment.lineNumber && (
                      <span className="text-xs text-blue-500 font-mono mr-2">L{comment.lineNumber}</span>
                    )}
                    <p className="text-sm text-gray-800">{comment.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!comment.isResolved && (
                    <button
                      onClick={() => handleResolveComment(comment.id)}
                      className="text-xs text-green-600 hover:text-green-800 font-medium"
                    >
                      Resolve
                    </button>
                  )}
                  {comment.isResolved && (
                    <span className="text-xs text-gray-400">Resolved</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      {canApprove && (
        <div className="flex items-center justify-end gap-3">
          <Button variant="danger" onClick={handleReject}>
            Reject
          </Button>
          <Button variant="primary" onClick={handleApprove}>
            Approve &amp; Merge
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers — extract original/modified from unified diff
// =============================================================================

function extractOriginal(unifiedDiff: string): string {
  if (!unifiedDiff) return '';
  const lines = unifiedDiff.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) continue;
    if (line.startsWith('+')) continue; // added in modified
    if (line.startsWith('-')) {
      result.push(line.substring(1));
    } else if (line.startsWith(' ')) {
      result.push(line.substring(1));
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

function extractModified(unifiedDiff: string): string {
  if (!unifiedDiff) return '';
  const lines = unifiedDiff.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) continue;
    if (line.startsWith('-')) continue; // removed from original
    if (line.startsWith('+')) {
      result.push(line.substring(1));
    } else if (line.startsWith(' ')) {
      result.push(line.substring(1));
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}
