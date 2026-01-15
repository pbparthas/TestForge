/**
 * Dashboard Types
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'lead' | 'qae' | 'viewer';
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  framework?: string;
  language?: string;
  repositoryUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: 'manual' | 'automated' | 'hybrid';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  steps: TestStep[];
  expectedResult?: string;
  tags: string[];
  linkedRequirementIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestStep {
  order: number;
  action: string;
  expectedResult?: string;
  data?: Record<string, unknown>;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  testCaseIds: string[];
  createdAt: string;
}

export interface Requirement {
  id: string;
  projectId: string;
  externalId?: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'approved' | 'implemented' | 'verified';
  source?: string;
  createdAt: string;
}

export interface Execution {
  id: string;
  projectId: string;
  suiteId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggerType: 'manual' | 'scheduled' | 'ci';
  startedAt?: string;
  completedAt?: string;
  summary?: ExecutionSummary;
  createdAt: string;
}

export interface ExecutionSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export interface ExecutionResult {
  id: string;
  executionId: string;
  testCaseId?: string;
  status: 'passed' | 'failed' | 'skipped' | 'blocked';
  durationMs?: number;
  errorMessage?: string;
  errorStack?: string;
  screenshot?: string;
}

export interface Bug {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
  priority: 'low' | 'medium' | 'high' | 'critical';
  linkedTestCaseId?: string;
  linkedExecutionId?: string;
  externalId?: string;
  createdAt: string;
}

export interface CoverageData {
  totalRequirements: number;
  coveredRequirements: number;
  coveragePercentage: number;
  byPriority: Record<string, { total: number; covered: number }>;
}

export interface AiUsageSummary {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostInr: number;
  byAgent: Record<string, { calls: number; tokens: number; costUsd: number }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
