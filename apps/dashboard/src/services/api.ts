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
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    return data;
  }

  async register(email: string, password: string, name: string) {
    const { data } = await this.client.post('/auth/register', { email, password, name });
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

  // Requirements
  async getRequirements(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/requirements', { params: { page, limit, projectId } });
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
}

export const api = new ApiClient();
