/**
 * React Query Hooks
 * Shared query/mutation hooks with key factory
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { TestCase, TestSuite, Requirement, Bug } from '../types';

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
