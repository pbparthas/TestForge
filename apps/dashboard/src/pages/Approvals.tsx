/**
 * Approvals Page
 * Sprint 18: HITL Approval Workflows - Review queue, artifacts, SLA tracking
 */

import { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/project';
import { api } from '../services/api';
import { Card, Badge, Button, Input } from '../components/ui';

// Types
interface Artifact {
  id: string;
  projectId: string;
  type: 'test_case' | 'script' | 'bug_analysis' | 'chat_suggestion' | 'self_healing_fix';
  state: 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'archived';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string | null;
  riskScore: number;
  aiConfidenceScore: number | null;
  sourceAgent: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  workflow?: {
    requiredApprovals: number;
    currentApprovals: number;
    autoApproved: boolean;
  };
  slaTracking?: {
    status: 'within_sla' | 'approaching_sla' | 'breached' | 'escalated';
    deadline: string;
    deadlineHours: number;
  };
}

interface ReviewQueue {
  pending: Artifact[];
  inReview: Artifact[];
  recentlyReviewed: Artifact[];
}

// Colors by state
const STATE_COLORS: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  pending_review: { variant: 'warning', label: 'Pending Review' },
  in_review: { variant: 'info', label: 'In Review' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
  archived: { variant: 'default', label: 'Archived' },
};

// Colors by risk level
const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-800' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800' },
  critical: { bg: 'bg-red-100', text: 'text-red-800' },
};

// Artifact type labels
const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  test_case: 'Test Case',
  script: 'Script',
  bug_analysis: 'Bug Analysis',
  chat_suggestion: 'Chat Suggestion',
  self_healing_fix: 'Self-Healing Fix',
};

// SLA status colors
const SLA_COLORS: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  within_sla: { variant: 'success', label: 'On Track' },
  approaching_sla: { variant: 'warning', label: 'Approaching' },
  breached: { variant: 'danger', label: 'Breached' },
  escalated: { variant: 'danger', label: 'Escalated' },
};

export function ApprovalsPage() {
  const { currentProject } = useProjectStore();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'all' | 'sla'>('queue');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [queueRes, artifactsRes] = await Promise.all([
        api.getReviewQueue(),
        api.getArtifacts({ projectId: currentProject?.id, limit: 50 }),
      ]);
      setReviewQueue(queueRes.data);
      setArtifacts(artifactsRes.data?.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (artifact: Artifact) => {
    setProcessing(true);
    try {
      await api.claimArtifact(artifact.id);
      loadData();
    } catch (error) {
      console.error('Failed to claim:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedArtifact) return;
    setProcessing(true);
    try {
      await api.approveArtifact(selectedArtifact.id, reviewComment);
      setShowReviewModal(false);
      setSelectedArtifact(null);
      setReviewComment('');
      loadData();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedArtifact || !rejectionReason) return;
    setProcessing(true);
    try {
      await api.rejectArtifact(selectedArtifact.id, rejectionReason, [
        { category: 'other', severity: 'moderate', description: rejectionReason },
      ]);
      setShowReviewModal(false);
      setSelectedArtifact(null);
      setReviewComment('');
      setRejectionReason('');
      loadData();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setProcessing(false);
    }
  };

  const openReviewModal = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setShowReviewModal(true);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const dl = new Date(deadline);
    const diffMs = dl.getTime() - now.getTime();
    if (diffMs < 0) return 'Overdue';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const renderArtifactCard = (artifact: Artifact, showActions = true) => (
    <Card key={artifact.id} className="mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-gray-900">{artifact.title}</h3>
            <Badge variant={STATE_COLORS[artifact.state]?.variant || 'default'}>
              {STATE_COLORS[artifact.state]?.label || artifact.state}
            </Badge>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_COLORS[artifact.riskLevel]?.bg} ${RISK_COLORS[artifact.riskLevel]?.text}`}>
              {artifact.riskLevel.toUpperCase()} RISK
            </span>
            <Badge variant="default">
              {ARTIFACT_TYPE_LABELS[artifact.type] || artifact.type}
            </Badge>
          </div>
          {artifact.description && (
            <p className="text-sm text-gray-600 mb-2">{artifact.description}</p>
          )}
          <div className="flex gap-4 text-sm text-gray-500">
            <span>Risk Score: {artifact.riskScore}%</span>
            {artifact.aiConfidenceScore && <span>AI Confidence: {artifact.aiConfidenceScore}%</span>}
            <span>Source: {artifact.sourceAgent}</span>
            <span>Created: {formatDate(artifact.createdAt)}</span>
          </div>
          {artifact.workflow && (
            <div className="mt-2 text-sm text-gray-600">
              Approvals: {artifact.workflow.currentApprovals}/{artifact.workflow.requiredApprovals}
              {artifact.workflow.autoApproved && <span className="ml-2 text-green-600">(Auto-approved)</span>}
            </div>
          )}
          {artifact.slaTracking && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={SLA_COLORS[artifact.slaTracking.status]?.variant || 'default'}>
                SLA: {SLA_COLORS[artifact.slaTracking.status]?.label}
              </Badge>
              <span className="text-sm text-gray-500">
                {getTimeRemaining(artifact.slaTracking.deadline)} remaining
              </span>
            </div>
          )}
        </div>
        {showActions && (
          <div className="flex gap-2 ml-4">
            {artifact.state === 'pending_review' && (
              <Button size="sm" onClick={() => handleClaim(artifact)} disabled={processing}>
                Claim
              </Button>
            )}
            {artifact.state === 'in_review' && (
              <Button size="sm" onClick={() => openReviewModal(artifact)}>
                Review
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  if (!currentProject) {
    return (
      <div className="p-8">
        <Card>
          <p className="text-gray-500">Please select a project to view approvals.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Approval Workflows</h1>
        <p className="text-gray-600 mt-1">Review and approve AI-generated artifacts</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { id: 'queue', label: 'Review Queue', count: (reviewQueue?.pending.length || 0) + (reviewQueue?.inReview.length || 0) },
          { id: 'all', label: 'All Artifacts', count: artifacts.length },
          { id: 'sla', label: 'SLA Tracking', count: artifacts.filter(a => a.slaTracking?.status === 'approaching_sla' || a.slaTracking?.status === 'breached').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      ) : (
        <>
          {/* Review Queue Tab */}
          {activeTab === 'queue' && reviewQueue && (
            <div className="space-y-6">
              {/* Pending Review */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Pending Review ({reviewQueue.pending.length})
                </h2>
                {reviewQueue.pending.length === 0 ? (
                  <Card>
                    <p className="text-gray-500 text-center py-4">No artifacts pending review</p>
                  </Card>
                ) : (
                  reviewQueue.pending.map((artifact) => renderArtifactCard(artifact))
                )}
              </div>

              {/* In Review */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  In Review ({reviewQueue.inReview.length})
                </h2>
                {reviewQueue.inReview.length === 0 ? (
                  <Card>
                    <p className="text-gray-500 text-center py-4">No artifacts currently being reviewed</p>
                  </Card>
                ) : (
                  reviewQueue.inReview.map((artifact) => renderArtifactCard(artifact))
                )}
              </div>

              {/* Recently Reviewed */}
              {reviewQueue.recentlyReviewed.length > 0 && (
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Recently Reviewed ({reviewQueue.recentlyReviewed.length})
                  </h2>
                  {reviewQueue.recentlyReviewed.map((artifact) => renderArtifactCard(artifact, false))}
                </div>
              )}
            </div>
          )}

          {/* All Artifacts Tab */}
          {activeTab === 'all' && (
            <div>
              {artifacts.length === 0 ? (
                <Card>
                  <p className="text-gray-500 text-center py-8">No artifacts found</p>
                </Card>
              ) : (
                artifacts.map((artifact) => renderArtifactCard(artifact))
              )}
            </div>
          )}

          {/* SLA Tracking Tab */}
          {activeTab === 'sla' && (
            <div className="space-y-6">
              {/* Breached */}
              <div>
                <h2 className="text-lg font-medium text-red-600 mb-4">
                  SLA Breached ({artifacts.filter(a => a.slaTracking?.status === 'breached' || a.slaTracking?.status === 'escalated').length})
                </h2>
                {artifacts.filter(a => a.slaTracking?.status === 'breached' || a.slaTracking?.status === 'escalated').length === 0 ? (
                  <Card>
                    <p className="text-gray-500 text-center py-4">No breached SLAs</p>
                  </Card>
                ) : (
                  artifacts
                    .filter(a => a.slaTracking?.status === 'breached' || a.slaTracking?.status === 'escalated')
                    .map((artifact) => renderArtifactCard(artifact))
                )}
              </div>

              {/* Approaching */}
              <div>
                <h2 className="text-lg font-medium text-yellow-600 mb-4">
                  Approaching Deadline ({artifacts.filter(a => a.slaTracking?.status === 'approaching_sla').length})
                </h2>
                {artifacts.filter(a => a.slaTracking?.status === 'approaching_sla').length === 0 ? (
                  <Card>
                    <p className="text-gray-500 text-center py-4">No approaching deadlines</p>
                  </Card>
                ) : (
                  artifacts
                    .filter(a => a.slaTracking?.status === 'approaching_sla')
                    .map((artifact) => renderArtifactCard(artifact))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedArtifact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Review Artifact</h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900">{selectedArtifact.title}</h3>
              <div className="flex gap-2 mt-2">
                <Badge variant={STATE_COLORS[selectedArtifact.state]?.variant || 'default'}>
                  {STATE_COLORS[selectedArtifact.state]?.label}
                </Badge>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_COLORS[selectedArtifact.riskLevel]?.bg} ${RISK_COLORS[selectedArtifact.riskLevel]?.text}`}>
                  {selectedArtifact.riskLevel.toUpperCase()} RISK
                </span>
              </div>
              {selectedArtifact.description && (
                <p className="text-sm text-gray-600 mt-2">{selectedArtifact.description}</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
                <Input
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add a review comment..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason (required for reject)
                </label>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejection..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowReviewModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={processing || !rejectionReason}
              >
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={processing}>
                Approve
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
