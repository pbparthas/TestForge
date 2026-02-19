/**
 * React Query Hooks
 * Shared query/mutation hooks with key factory
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { TestCase, TestSuite, Requirement, Bug, Project, CoverageData, ExecutionSummary } from '../types';

// =========================================================================
// Query Key Factory
// =========================================================================

export const queryKeys = {
  testCases: (projectId: string, page = 1) => ['testCases', projectId, page] as const,
  testSuites: (projectId: string) => ['testSuites', projectId] as const,
  requirements: (projectId: string, page = 1) => ['requirements', projectId, page] as const,
  executions: (projectId: string) => ['executions', projectId] as const,
  bugs: (projectId: string) => ['bugs', projectId] as const,
  environments: (projectId: string) => ['environments', projectId] as const,
  // Dashboard & Coverage
  projects: () => ['projects'] as const,
  dashboardStats: (projectId: string) => ['dashboardStats', projectId] as const,
  coverage: (projectId: string) => ['coverage', projectId] as const,
  coverageGaps: (projectId: string) => ['coverageGaps', projectId] as const,
  // Flaky Tests
  flakyTests: (projectId: string) => ['flakyTests', projectId] as const,
  flakySummary: (projectId: string) => ['flakySummary', projectId] as const,
  flakyPatterns: (projectId: string) => ['flakyPatterns', projectId] as const,
  flakyTrends: (projectId: string, days: number) => ['flakyTrends', projectId, days] as const,
  // Audit Logs
  auditLogs: (page: number, filters: Record<string, string>) => ['auditLogs', page, filters] as const,
  // Reports & Quality Gates
  reports: (projectId: string) => ['reports', projectId] as const,
  reportTemplates: (projectId: string) => ['reportTemplates', projectId] as const,
  reportSchedules: (projectId: string) => ['reportSchedules', projectId] as const,
  qualityGates: (projectId: string) => ['qualityGates', projectId] as const,
  qualityGateSummary: (projectId: string) => ['qualityGateSummary', projectId] as const,
  // Approvals
  reviewQueue: () => ['reviewQueue'] as const,
  artifacts: (projectId: string) => ['artifacts', projectId] as const,
  // Jenkins
  jenkinsIntegrations: (projectId: string) => ['jenkinsIntegrations', projectId] as const,
  jenkinsBuilds: (integrationId: string) => ['jenkinsBuilds', integrationId] as const,
  // Admin Feedback
  adminConversations: (filters: Record<string, string>) => ['adminConversations', filters] as const,
  conversation: (id: string) => ['conversation', id] as const,
};

// =========================================================================
// Response normalization — API returns varying shapes
// =========================================================================

function extractItems<T>(response: Record<string, unknown>): { items: T[]; total: number } {
  const data = response.data as Record<string, unknown> | unknown[] | undefined;
  const items = (data as Record<string, unknown>)?.data
    || (data as Record<string, unknown>)?.items
    || data
    || [];
  const arr = Array.isArray(items) ? items as T[] : [];
  const total = ((data as Record<string, unknown>)?.total as number) || arr.length;
  return { items: arr, total };
}

// =========================================================================
// Test Cases
// =========================================================================

export function useTestCases(projectId: string | undefined, page = 1) {
  return useQuery({
    queryKey: queryKeys.testCases(projectId!, page),
    queryFn: async () => {
      const response = await api.getTestCases(page, 100, projectId);
      return extractItems<TestCase>(response);
    },
    enabled: !!projectId,
  });
}

export function useCreateTestCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; title: string; description?: string; steps?: unknown[]; type?: string; priority?: string; expectedResult?: string }) =>
      api.createTestCase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
    },
  });
}

export function useUpdateTestCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.updateTestCase(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
    },
  });
}

// =========================================================================
// Test Suites
// =========================================================================

export function useTestSuites(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.testSuites(projectId!),
    queryFn: async () => {
      const response = await api.getTestSuites(1, 100, projectId);
      return extractItems<TestSuite>(response);
    },
    enabled: !!projectId,
  });
}

export function useCreateTestSuite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; name: string; description?: string; tags?: string[] }) =>
      api.createTestSuite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testSuites'] });
    },
  });
}

export function useUpdateTestSuite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.updateTestSuite(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testSuites'] });
    },
  });
}

export function useDuplicateTestSuite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.duplicateTestSuite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testSuites'] });
    },
  });
}

// =========================================================================
// Requirements
// =========================================================================

export function useRequirements(projectId: string | undefined, page = 1) {
  return useQuery({
    queryKey: queryKeys.requirements(projectId!, page),
    queryFn: async () => {
      const response = await api.getRequirements(page, 50, projectId);
      return extractItems<Requirement>(response);
    },
    enabled: !!projectId,
  });
}

export function useCreateRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; title: string; description?: string; priority?: string; source?: string; externalId?: string }) =>
      api.createRequirement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
    },
  });
}

export function useUpdateRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.updateRequirement(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
    },
  });
}

// =========================================================================
// Executions
// =========================================================================

interface Environment {
  id: string;
  name: string;
  baseUrl: string;
}

interface ExecutionTestSuite {
  id: string;
  name: string;
  testCount: number;
}

interface ExecutionRecord {
  id: string;
  status: string;
  triggerType: string;
  startedAt?: string;
  completedAt?: string;
  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration?: number;
  };
  environment?: { name: string };
  device?: string;
  browser?: string;
}

export function useExecutions(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.executions(projectId!),
    queryFn: async () => {
      const response = await api.getExecutions(1, 50, projectId);
      return extractItems<ExecutionRecord>(response);
    },
    enabled: !!projectId,
  });
}

export function useEnvironments(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.environments(projectId!),
    queryFn: async () => {
      try {
        const response = await api.get<{ data: Environment[] }>('/environments', {
          projectId: projectId!,
        });
        const items = response.data?.data || response.data || [];
        return Array.isArray(items) ? items : [];
      } catch {
        // Provide default environments for demo
        return [
          { id: 'dev', name: 'Development', baseUrl: 'http://localhost:3000' },
          { id: 'staging', name: 'Staging', baseUrl: 'https://staging.example.com' },
          { id: 'prod', name: 'Production', baseUrl: 'https://example.com' },
        ];
      }
    },
    enabled: !!projectId,
  });
}

export function useExecutionTestSuites(projectId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.testSuites(projectId!), 'forExecution'] as const,
    queryFn: async () => {
      const response = await api.getTestSuites(1, 20, projectId);
      const { items } = extractItems<{ id: string; name: string; testCases?: unknown[] }>(response);
      return items.map((s) => ({
        id: s.id,
        name: s.name,
        testCount: s.testCases?.length || 0,
      })) as ExecutionTestSuite[];
    },
    enabled: !!projectId,
  });
}

export function useTriggerExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, suiteId }: { projectId: string; suiteId?: string }) =>
      api.triggerExecution(projectId, suiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });
}

// =========================================================================
// Bugs
// =========================================================================

export function useBugs(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bugs(projectId!),
    queryFn: async () => {
      const response = await api.getBugs(1, 50, projectId);
      return extractItems<Bug>(response);
    },
    enabled: !!projectId,
  });
}

// =========================================================================
// Projects (Dashboard)
// =========================================================================

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects(),
    queryFn: async () => {
      const response = await api.getProjects();
      const list = response.data?.data || response.data?.items || response.data || [];
      return Array.isArray(list) ? list as Project[] : [];
    },
  });
}

export function useDashboardStats(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dashboardStats(projectId!),
    queryFn: async () => {
      const [coverageRes, execRes, bugRes] = await Promise.all([
        api.getCoverage(projectId!).catch(() => null),
        api.getExecutionStats(projectId!).catch(() => null),
        api.getBugStats(projectId!).catch(() => null),
      ]);
      return {
        coverage: coverageRes?.data as CoverageData | undefined,
        executions: execRes?.data as ExecutionSummary | undefined,
        bugs: bugRes?.data as { open: number; total: number } | undefined,
      };
    },
    enabled: !!projectId,
  });
}

// =========================================================================
// Coverage
// =========================================================================

export function useCoverage(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coverage(projectId!),
    queryFn: async () => {
      const response = await api.getCoverage(projectId!);
      return response.data as CoverageData;
    },
    enabled: !!projectId,
  });
}

export function useCoverageGaps(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.coverageGaps(projectId!),
    queryFn: async () => {
      const response = await api.getCoverageGaps(projectId!);
      return (response.data?.requirements || []) as { id: string; title: string; priority: string }[];
    },
    enabled: !!projectId,
  });
}

// =========================================================================
// Flaky Tests
// =========================================================================

export function useFlakyTests(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.flakyTests(projectId!),
    queryFn: async () => {
      const response = await api.getFlakyTests(projectId!);
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useFlakySummary(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.flakySummary(projectId!),
    queryFn: async () => {
      const response = await api.getFlakyTestSummary(projectId!);
      return response.data || null;
    },
    enabled: !!projectId,
  });
}

export function useFlakyPatterns(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.flakyPatterns(projectId!),
    queryFn: async () => {
      const response = await api.getFlakyPatterns(projectId!);
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useFlakyTrends(projectId: string | undefined, days = 14) {
  return useQuery({
    queryKey: queryKeys.flakyTrends(projectId!, days),
    queryFn: async () => {
      const response = await api.getFlakyTestTrends(projectId!, days);
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useQuarantineTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, reason }: { testId: string; reason: string }) =>
      api.quarantineTest(testId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flakyTests'] });
      queryClient.invalidateQueries({ queryKey: ['flakySummary'] });
    },
  });
}

export function useUnquarantineTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => api.unquarantineTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flakyTests'] });
      queryClient.invalidateQueries({ queryKey: ['flakySummary'] });
    },
  });
}

export function useMarkTestFixed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => api.markTestAsFixed(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flakyTests'] });
      queryClient.invalidateQueries({ queryKey: ['flakySummary'] });
    },
  });
}

// =========================================================================
// Audit Logs
// =========================================================================

export function useAuditLogs(page: number, limit: number, filters: { category?: string; severity?: string; action?: string }) {
  const filterKey = { category: filters.category || '', severity: filters.severity || '', action: filters.action || '' };
  return useQuery({
    queryKey: queryKeys.auditLogs(page, filterKey),
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit };
      if (filters.category) params.category = filters.category;
      if (filters.severity) params.severity = filters.severity;
      if (filters.action) params.action = filters.action;
      const response = await api.get<{ data: unknown[]; total: number }>('/audit', { params });
      return { logs: response.data.data, total: response.data.total };
    },
  });
}

// =========================================================================
// Reports
// =========================================================================

export function useReports(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reports(projectId!),
    queryFn: async () => {
      const response = await api.getReports({ projectId: projectId!, limit: 20 });
      return response.data?.data || [];
    },
    enabled: !!projectId,
  });
}

export function useReportTemplates(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reportTemplates(projectId!),
    queryFn: async () => {
      const response = await api.getReportTemplates(projectId!);
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useReportSchedules(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reportSchedules(projectId!),
    queryFn: async () => {
      const response = await api.getReportSchedules(projectId!);
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useQualityGates(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.qualityGates(projectId!),
    queryFn: async () => {
      const response = await api.getProjectQualityGates(projectId!);
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useQualityGateSummary(projectId: string | undefined, days = 30) {
  return useQuery({
    queryKey: queryKeys.qualityGateSummary(projectId!),
    queryFn: async () => {
      const response = await api.getQualityGateSummary(projectId!, days);
      return response.data || null;
    },
    enabled: !!projectId,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; type: string; format: string; title: string; parameters?: Record<string, unknown> }) =>
      api.generateReport(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useCreateQualityGate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      projectId: string;
      name: string;
      description?: string;
      conditions: Array<{ metric: string; operator: string; threshold: number; severity: string }>;
    }) => api.createQualityGate(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualityGates'] });
      queryClient.invalidateQueries({ queryKey: ['qualityGateSummary'] });
    },
  });
}

export function useSetDefaultQualityGate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.setDefaultQualityGate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualityGates'] });
    },
  });
}

export function useDeleteQualityGate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteQualityGate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualityGates'] });
      queryClient.invalidateQueries({ queryKey: ['qualityGateSummary'] });
    },
  });
}

// =========================================================================
// Approvals
// =========================================================================

export function useReviewQueue() {
  return useQuery({
    queryKey: queryKeys.reviewQueue(),
    queryFn: async () => {
      const response = await api.getReviewQueue();
      return response.data;
    },
  });
}

export function useArtifacts(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.artifacts(projectId!),
    queryFn: async () => {
      const response = await api.getArtifacts({ projectId, limit: 50 });
      return response.data?.data || [];
    },
    enabled: !!projectId,
  });
}

export function useClaimArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.claimArtifact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
    },
  });
}

export function useApproveArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.approveArtifact(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
    },
  });
}

export function useRejectArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, findings }: { id: string; reason: string; findings: Array<{ category: string; severity: string; description: string }> }) =>
      api.rejectArtifact(id, reason, findings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
    },
  });
}

// =========================================================================
// Jenkins Integrations
// =========================================================================

export function useJenkinsIntegrations(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.jenkinsIntegrations(projectId!),
    queryFn: async () => {
      const response = await api.getProjectJenkinsIntegrations(projectId!);
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useJenkinsBuilds(integrationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.jenkinsBuilds(integrationId!),
    queryFn: async () => {
      const response = await api.getJenkinsBuilds(integrationId!, { limit: 20 });
      return response.data || [];
    },
    enabled: !!integrationId,
  });
}

export function useCreateJenkinsIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createJenkinsIntegration(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jenkinsIntegrations'] });
    },
  });
}

export function useUpdateJenkinsIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateJenkinsIntegration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jenkinsIntegrations'] });
    },
  });
}

export function useDeleteJenkinsIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJenkinsIntegration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jenkinsIntegrations'] });
    },
  });
}

export function useTriggerJenkinsBuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ integrationId, params }: { integrationId: string; params?: Record<string, unknown> }) =>
      api.triggerJenkinsBuild(integrationId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jenkinsBuilds'] });
    },
  });
}

// =========================================================================
// Admin Feedback
// =========================================================================

export function useAdminConversations(filters: { category?: string; status?: string }) {
  const filterKey = { category: filters.category || '', status: filters.status || '' };
  return useQuery({
    queryKey: queryKeys.adminConversations(filterKey),
    queryFn: async () => {
      const params: Record<string, string> = { limit: '100' };
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      const response = await api.get<{ data: unknown[]; total: number }>('/chat/conversations/admin', { params });
      return response.data.data || [];
    },
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversation(id!),
    queryFn: async () => {
      const response = await api.getConversation(id!);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useAdminReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      api.post(`/chat/conversations/${conversationId}/admin-reply`, { content }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['adminConversations'] });
    },
  });
}

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, status }: { conversationId: string; status: string }) =>
      api.patch(`/chat/conversations/${conversationId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminConversations'] });
    },
  });
}

// =========================================================================
// ScriptSmith Pro
// =========================================================================

export function useScriptSmithSessions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['scriptSmithSessions', projectId] as const,
    queryFn: async () => {
      const response = await api.getScriptSmithSessions({ projectId, limit: 10 });
      return response.data || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateScriptSmithSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createScriptSmithSession(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scriptSmithSessions'] });
    },
  });
}

export function useDeleteScriptSmithSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteScriptSmithSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scriptSmithSessions'] });
    },
  });
}

export function useUpdateScriptSmithInput() {
  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: Record<string, unknown> }) =>
      api.updateScriptSmithSessionInput(sessionId, input),
  });
}

export function useTransformScriptSmithSession() {
  return useMutation({
    mutationFn: ({ sessionId, projectId, options }: { sessionId: string; projectId: string; options?: Record<string, unknown> }) =>
      api.transformScriptSmithSession(sessionId, projectId, options),
  });
}

export function useSaveScriptSmithSession() {
  return useMutation({
    mutationFn: ({ sessionId, targetDir, overwrite }: { sessionId: string; targetDir: string; overwrite?: boolean }) =>
      api.saveScriptSmithSession(sessionId, targetDir, overwrite),
  });
}

// =========================================================================
// AI Generator (Test Weaver)
// =========================================================================

export function useGenerateTestWeaver() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/ai/test-weaver/generate', payload),
  });
}

export function useBatchTestWeaver() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/ai/test-weaver/batch', payload),
  });
}

export function useEvolveTestCases() {
  return useMutation({
    mutationFn: ({ projectId, existingTests, feedback }: { projectId: string; existingTests: unknown; feedback: string }) =>
      api.evolveTestCases(projectId, existingTests as string, feedback),
  });
}

// =========================================================================
// Code Guardian
// =========================================================================

export function useGenerateUnitTests() {
  return useMutation({
    mutationFn: (args: Parameters<typeof api.generateUnitTests>) =>
      api.generateUnitTests(...args),
  });
}

// =========================================================================
// Self Healing
// =========================================================================

export function useDiagnoseFailure() {
  return useMutation({
    mutationFn: ({ projectId, testCaseId, errorMessage, screenshot }: { projectId: string; testCaseId: string; errorMessage: string; screenshot?: string }) =>
      api.diagnoseFailure(projectId, testCaseId, errorMessage, screenshot),
  });
}

export function useFixLocator() {
  return useMutation({
    mutationFn: ({ projectId, testCaseId, oldLocator, pageHtml }: { projectId: string; testCaseId: string; oldLocator: string; pageHtml?: string }) =>
      api.fixLocator(projectId, testCaseId, oldLocator, pageHtml),
  });
}

// =========================================================================
// Recorder
// =========================================================================

export function useRecorderConvert() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/recorder/convert', payload),
  });
}

export function useRecorderOptimize() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/recorder/optimize', payload),
  });
}

export function useRecorderAssertions() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/recorder/assertions', payload),
  });
}

export function useRecorderProcess() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/recorder/process', payload),
  });
}

// =========================================================================
// Visual Testing
// =========================================================================

export function useVisualCompare() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/visual/compare', payload),
  });
}

export function useVisualAnalyzeRegression() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/visual/analyze-regression', payload),
  });
}

export function useVisualDetectElements() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/visual/detect-elements', payload),
  });
}

export function useVisualGenerateTestCase() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/visual/generate-test-case', payload),
  });
}

// =========================================================================
// Bug Patterns
// =========================================================================

export function useBugPatternAnalyze() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/bug-patterns/analyze', payload),
  });
}

export function useBugPatternRootCause() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/bug-patterns/root-cause', payload),
  });
}

export function useBugPatternPredict() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/bug-patterns/predict', payload),
  });
}

export function useBugPatternReport() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/bug-patterns/report', payload),
  });
}

export function useBugPatternCluster() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/bug-patterns/cluster', payload),
  });
}

// =========================================================================
// Code Analysis
// =========================================================================

export function useCodeAnalysisComplexity() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/code-analysis/complexity', payload),
  });
}

export function useCodeAnalysisArchitecture() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/code-analysis/architecture', payload),
  });
}

export function useCodeAnalysisBestPractices() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/code-analysis/best-practices', payload),
  });
}

export function useCodeAnalysisTechnicalDebt() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/code-analysis/technical-debt', payload),
  });
}

// =========================================================================
// Test Evolution
// =========================================================================

export function useTestEvolutionHealth() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/test-evolution/health', payload),
  });
}

export function useTestEvolutionCoverage() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/test-evolution/coverage', payload),
  });
}

export function useTestEvolutionStale() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/test-evolution/stale', payload),
  });
}

export function useTestEvolutionRisk() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/test-evolution/risk', payload),
  });
}

// =========================================================================
// Test Pilot
// =========================================================================

export function useTestPilotWorkflows(projectId: string | undefined) {
  return useQuery({
    queryKey: ['testPilotWorkflows', projectId] as const,
    queryFn: async () => {
      const response = await api.get<{ data: unknown[] }>('/testpilot/workflows', { projectId });
      return response.data?.data || [];
    },
    enabled: !!projectId,
  });
}

export function useTestPilotExecutions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['testPilotExecutions', projectId] as const,
    queryFn: async () => {
      const response = await api.get<{ data: unknown[] }>('/testpilot/executions', { projectId, limit: 20 });
      return response.data?.data || [];
    },
    enabled: !!projectId,
  });
}

export function useTestPilotCustomWorkflows(projectId: string | undefined) {
  return useQuery({
    queryKey: ['testPilotCustomWorkflows', projectId] as const,
    queryFn: async () => {
      const response = await api.get<{ data: unknown[] }>('/testpilot/workflows', { projectId, custom: true });
      return response.data?.data || [];
    },
    enabled: !!projectId,
  });
}

export function useTestPilotEstimate() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/testpilot/estimate', payload),
  });
}

export function useTestPilotExecute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/testpilot/execute', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testPilotExecutions'] });
    },
  });
}

export function useCreateTestPilotWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/testpilot/workflows', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testPilotWorkflows'] });
      queryClient.invalidateQueries({ queryKey: ['testPilotCustomWorkflows'] });
    },
  });
}

export function useDeleteTestPilotWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/testpilot/workflows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testPilotWorkflows'] });
      queryClient.invalidateQueries({ queryKey: ['testPilotCustomWorkflows'] });
    },
  });
}
