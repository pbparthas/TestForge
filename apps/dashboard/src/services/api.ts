/**
 * API Client
 * Centralized HTTP client with auth handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(identifier: string, password: string) {
    const { data } = await this.client.post('/auth/login', { identifier, password });
    return data;
  }

  async register(email: string, username: string, password: string, name: string) {
    const { data } = await this.client.post('/auth/register', { email, username, password, name });
    return data;
  }

  async getMe() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  // Projects
  async getProjects(page = 1, limit = 10) {
    const { data } = await this.client.get('/projects', { params: { page, limit } });
    return data;
  }

  async getProject(id: string) {
    const { data } = await this.client.get(`/projects/${id}`);
    return data;
  }

  async createProject(project: { name: string; description?: string; framework?: string; language?: string }) {
    const { data } = await this.client.post('/projects', project);
    return data;
  }

  // Test Cases
  async getTestCases(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/test-cases', { params: { page, limit, projectId } });
    return data;
  }

  async getTestCase(id: string) {
    const { data } = await this.client.get(`/test-cases/${id}`);
    return data;
  }

  async createTestCase(testCase: { projectId: string; title: string; description?: string; steps?: unknown[] }) {
    const { data } = await this.client.post('/test-cases', testCase);
    return data;
  }

  async updateTestCase(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/test-cases/${id}`, updates);
    return data;
  }

  // Test Suites
  async getTestSuites(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/test-suites', { params: { page, limit, projectId } });
    return data;
  }

  async getTestSuite(id: string) {
    const { data } = await this.client.get(`/test-suites/${id}`);
    return data;
  }

  async getTestSuiteWithCases(id: string) {
    const { data } = await this.client.get(`/test-suites/${id}/with-cases`);
    return data;
  }

  async createTestSuite(suite: { projectId: string; name: string; description?: string; tags?: string[] }) {
    const { data } = await this.client.post('/test-suites', suite);
    return data;
  }

  async updateTestSuite(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/test-suites/${id}`, updates);
    return data;
  }

  async duplicateTestSuite(id: string) {
    const { data } = await this.client.post(`/test-suites/${id}/duplicate`);
    return data;
  }

  // Requirements
  async getRequirements(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/requirements', { params: { page, limit, projectId } });
    return data;
  }

  async getRequirement(id: string) {
    const { data } = await this.client.get(`/requirements/${id}`);
    return data;
  }

  async createRequirement(requirement: { projectId: string; title: string; description?: string; priority?: string; source?: string; externalId?: string }) {
    const { data } = await this.client.post('/requirements', requirement);
    return data;
  }

  async updateRequirement(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/requirements/${id}`, updates);
    return data;
  }

  // Executions
  async getExecutions(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/executions', { params: { page, limit, projectId } });
    return data;
  }

  async triggerExecution(projectId: string, suiteId?: string) {
    const { data } = await this.client.post('/executions/trigger', { projectId, suiteId });
    return data;
  }

  async getExecutionStats(projectId: string, days = 30) {
    const { data } = await this.client.get(`/executions/project/${projectId}/stats`, { params: { days } });
    return data;
  }

  // Traceability
  async getCoverage(projectId: string) {
    const { data } = await this.client.get(`/traceability/coverage/${projectId}`);
    return data;
  }

  async getCoverageGaps(projectId: string) {
    const { data } = await this.client.get(`/traceability/gaps/${projectId}`);
    return data;
  }

  // Bugs
  async getBugs(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/bugs', { params: { page, limit, projectId } });
    return data;
  }

  async getBugStats(projectId: string) {
    const { data } = await this.client.get(`/bugs/project/${projectId}/stats`);
    return data;
  }

  // AI Agents
  async generateTestCases(projectId: string, specification: string, inputMethod = 'natural_language') {
    const { data } = await this.client.post('/ai/test-weaver/generate', { projectId, specification, inputMethod });
    return data;
  }

  async generateScript(projectId: string, testCase: { title: string; steps: unknown[] }) {
    const { data } = await this.client.post('/ai/script-smith/generate', { projectId, inputMethod: 'test_case', testCase });
    return data;
  }

  async getAiUsageSummary(projectId: string) {
    const { data } = await this.client.get(`/ai/usage/summary/${projectId}`);
    return data;
  }

  async getAiDailyCosts(projectId: string, days = 30) {
    const { data } = await this.client.get(`/ai/usage/daily/${projectId}`, { params: { days } });
    return data;
  }

  // Framework Agent
  async analyzeFramework(projectId: string, codeSnippet: string, language: string) {
    const { data } = await this.client.post('/ai/framework/analyze', { projectId, codeSnippet, language });
    return data;
  }

  async reviewCode(projectId: string, codeSnippet: string, language: string, reviewType: string) {
    const { data } = await this.client.post('/ai/framework/review', { projectId, codeSnippet, language, reviewType });
    return data;
  }

  // Self-Healing Agent
  async diagnoseFailure(projectId: string, testCaseId: string, errorMessage: string, screenshot?: string) {
    const { data } = await this.client.post('/ai/self-healing/diagnose', { projectId, testCaseId, errorMessage, screenshot });
    return data;
  }

  async fixLocator(projectId: string, testCaseId: string, oldLocator: string, pageHtml?: string) {
    const { data } = await this.client.post('/ai/self-healing/fix', { projectId, testCaseId, oldLocator, pageHtml });
    return data;
  }

  // FlowPilot Agent
  async generateApiTests(projectId: string, openApiSpec: string, endpoints?: string[]) {
    const { data } = await this.client.post('/ai/flow-pilot/generate', { projectId, openApiSpec, endpoints });
    return data;
  }

  async generateApiChain(projectId: string, userFlow: string, endpoints: { method: string; path: string; description: string }[]) {
    const { data } = await this.client.post('/ai/flow-pilot/chain', { projectId, userFlow, endpoints });
    return data;
  }

  // CodeGuardian Agent
  async generateUnitTests(projectId: string, sourceCode: string, language: string, framework?: string) {
    const { data } = await this.client.post('/ai/code-guardian/generate', { projectId, sourceCode, language, framework });
    return data;
  }

  async analyzeTestCoverage(projectId: string, sourceCode: string, existingTests: string) {
    const { data } = await this.client.post('/ai/code-guardian/analyze', { projectId, sourceCode, existingTests });
    return data;
  }

  // Bugs - Create
  async createBug(bug: { projectId: string; title: string; description?: string; priority?: string; linkedTestCaseId?: string }) {
    const { data } = await this.client.post('/bugs', bug);
    return data;
  }

  async updateBug(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/bugs/${id}`, updates);
    return data;
  }

  // TestWeaver - Evolve test cases
  async evolveTestCases(projectId: string, existingTests: string, feedback: string) {
    const { data } = await this.client.post('/ai/test-weaver/evolve', { projectId, existingTests, feedback });
    return data;
  }

  // FlowPilot - Validate API flow
  async validateApiFlow(projectId: string, apiFlow: string, baseUrl?: string) {
    const { data } = await this.client.post('/ai/flow-pilot/validate', { projectId, apiFlow, baseUrl });
    return data;
  }

  // Generic HTTP methods for Sprint 8 features
  async post<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<{ data: T }> {
    const { data } = await this.client.post(path, body);
    return { data };
  }

  async get<T = Record<string, unknown>>(path: string, params?: Record<string, unknown>): Promise<{ data: T }> {
    const { data } = await this.client.get(path, { params });
    return { data };
  }
}

export const api = new ApiClient();
