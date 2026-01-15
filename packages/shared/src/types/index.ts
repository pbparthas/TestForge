/**
 * Shared types for TestForge
 */

// User roles
export type UserRole = 'admin' | 'lead' | 'qae' | 'dev';

// Common status types
export type Status = 'active' | 'inactive' | 'archived';

// Priority levels
export type Priority = 'low' | 'medium' | 'high' | 'critical';

// Test execution status
export type ExecutionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';

// API response types
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Base entity with timestamps
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// User types
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// Auth types
export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// Project types
export interface Project extends BaseEntity {
  name: string;
  description: string | null;
  repositoryUrl: string | null;
  framework: 'playwright' | 'cypress';
  language: 'typescript' | 'javascript';
  createdById: string;
}

// Test case types
export interface TestStep {
  order: number;
  action: string;
  expected: string;
  data?: string;
}

export interface TestCase extends BaseEntity {
  projectId: string;
  requirementId: string | null;
  title: string;
  description: string | null;
  preconditions: string | null;
  steps: TestStep[];
  expectedResult: string | null;
  priority: Priority;
  status: Status;
  type: 'functional' | 'integration' | 'e2e' | 'api' | 'performance';
  isAutomated: boolean;
  createdById: string;
}

// AI agent metadata
export interface AgentMetadata {
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    cached?: number;
  };
  costUsd: number;
  costInr: number;
  durationMs: number;
  timestamp: string;
}
